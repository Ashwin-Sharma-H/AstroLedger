/**
 * SyncEngine — Real-time WebSocket synchronization & offline-first queue manager.
 *
 * Responsibilities:
 *  1. Connect to /ws/sync/?token=<jwt> with automatic reconnection & exponential backoff.
 *  2. On incoming sync_invalidation messages, invalidate TanStack Query caches.
 *  3. Flush offline mutation queue to /api/sync/push/ on reconnect.
 *  4. Expose sync status ('synced' | 'syncing' | 'offline') with subscriber pattern.
 */
import { apiRequest, getAccessToken, getBaseUrl, handleDeviceRevocation } from '../api/client';
import { getQueuedOfflineEvents, removeQueuedOfflineEvent } from '../storage/indexedDB';
import { QueryClient } from '@tanstack/react-query';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface SyncHealth {
  status: SyncStatus;
  pendingCount: number;
  lastSuccessfulSync: Date | null;
  lastAttempt: Date | null;
  lastResult: { uploaded: number; received: number } | null;
  apiReachable: boolean;
  websocketConnected: boolean;
  stationUrl: string;
}

type SyncStatusListener = (status: SyncStatus, pendingCount: number, health: SyncHealth) => void;

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('astro_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('astro_device_id', deviceId);
  }
  return deviceId;
}

export function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'browser' {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|android|blackberry|iemobile|kindle/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function detectDeviceName(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/i.test(ua)) return 'iPhone (Safari)';
  if (/iPad/i.test(ua)) return 'iPad (Safari)';
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Macintosh/i.test(ua)) return 'MacBook';
  return 'Web Browser';
}

export class SyncEngine {
  private static instance: SyncEngine;
  private socket: WebSocket | null = null;
  private isSyncing = false;
  private queryClient: QueryClient | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private pullCursor: string | null = null;
  private apiReachable = false;
  private lastSuccessfulSync: Date | null = null;
  private lastAttempt: Date | null = null;
  private lastResult: { uploaded: number; received: number } | null = null;

  // Status management
  private _status: SyncStatus = 'offline';
  private _pendingCount = 0;
  private listeners: Set<SyncStatusListener> = new Set();

  private constructor() {
    window.addEventListener('online', () => {
      this.flushQueue();
      this.connectWebSocket();
    });
    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });
  }

  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  /** Inject the TanStack QueryClient for cache invalidation. */
  public setQueryClient(qc: QueryClient) {
    this.queryClient = qc;
  }

  /**
   * Starts LAN sync after a Main-PC login or companion pairing. WebSockets
   * provide instant updates where supported; authenticated API polling keeps
   * Android companions synchronized when their WebView drops ws:// traffic.
   */
  public start() {
    if (!getAccessToken()) return;
    this.startHeartbeat();
    this.startPolling();
    this.connectWebSocket();
    void this.flushQueue();
    void this.pollChanges();
  }

  public async syncNow() {
    this.setStatus('syncing');
    this.lastAttempt = new Date();
    const [uploaded, received] = await Promise.all([this.flushQueue(), this.pollChanges()]);
    this.lastResult = { uploaded, received };
    if (this.apiReachable) this.lastSuccessfulSync = new Date();
    this.notifyListeners();
    this.connectWebSocket();
    return this.lastResult;
  }

  // ─── Status ────────────────────────────────────────────────────────

  public get status(): SyncStatus {
    return this._status;
  }

  public get pendingCount(): number {
    return this._pendingCount;
  }

  public get health(): SyncHealth {
    return {
      status: this._status,
      pendingCount: this._pendingCount,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastAttempt: this.lastAttempt,
      lastResult: this.lastResult,
      apiReachable: this.apiReachable,
      websocketConnected: this.socket?.readyState === WebSocket.OPEN,
      stationUrl: getBaseUrl(),
    };
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify the new subscriber of current state
    listener(this._status, this._pendingCount, this.health);
    return () => this.listeners.delete(listener);
  }

  private setStatus(s: SyncStatus) {
    this._status = s;
    this.notifyListeners();
  }

  private async refreshPendingCount() {
    try {
      const queue = await getQueuedOfflineEvents();
      this._pendingCount = queue.length;
    } catch {
      this._pendingCount = 0;
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    const health = this.health;
    this.listeners.forEach((fn) => fn(this._status, this._pendingCount, health));
  }

  private isApiConnected() {
    return this.apiReachable || this.socket?.readyState === WebSocket.OPEN;
  }

  // ─── Offline Queue Flush ───────────────────────────────────────────

  public async flushQueue(): Promise<number> {
    if (this.isSyncing || !navigator.onLine) return 0;
    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      const queue = await getQueuedOfflineEvents();
      if (queue.length === 0) {
        this.isSyncing = false;
        this.setStatus(this.isApiConnected() ? 'synced' : 'offline');
        this._pendingCount = 0;
        this.notifyListeners();
        return 0;
      }

      this._pendingCount = queue.length;
      this.notifyListeners();

      const response = await apiRequest<{ applied_keys: string[] }>('/api/sync/push/', {
        method: 'POST',
        body: JSON.stringify({
          device_id: getDeviceId(),
          events: queue,
        }),
      });

      const uploaded = response?.applied_keys?.length || 0;
      if (response?.applied_keys) {
        for (const key of response.applied_keys) {
          await removeQueuedOfflineEvent(key);
        }
      }

      // Invalidate caches after successful sync
      this.invalidateAllCaches();

      await this.refreshPendingCount();
      this.setStatus(this.isApiConnected() ? 'synced' : 'offline');
      if (this.apiReachable) this.lastSuccessfulSync = new Date();
      return uploaded;
    } catch (err) {
      console.warn('Sync flush postponed:', err);
      this.setStatus('offline');
      await this.refreshPendingCount();
      return 0;
    } finally {
      this.isSyncing = false;
    }
  }

  // ─── WebSocket ─────────────────────────────────────────────────────

  public connectWebSocket() {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      // Can't connect without auth
      return;
    }

    // Heartbeat and REST polling do not depend on WebSocket availability.
    this.startHeartbeat();
    this.startPolling();

    const baseUrl = getBaseUrl();
    const wsBase = baseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    const wsUrl = `${wsBase}/ws/sync/?token=${token}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('synced');
        // Start device heartbeat loop
        this.startHeartbeat();
        // Flush any pending items now that we're connected
        this.flushQueue();
      };

      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.socket.onclose = () => {
        if (!this.apiReachable) this.setStatus('offline');
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        // onclose will fire after onerror
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  public async sendHeartbeat() {
    const token = getAccessToken();
    if (!token) return;

    try {
      await apiRequest('/api/sync/devices/heartbeat/', {
        method: 'POST',
        body: JSON.stringify({
          device_id: getDeviceId(),
          device_name: detectDeviceName(),
          device_type: detectDeviceType(),
        }),
      });
      this.apiReachable = true;
      if (!this.isSyncing) this.setStatus('synced');
    } catch {
      this.apiReachable = false;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.setStatus('offline');
      }
    }
  }

  public startHeartbeat() {
    this.sendHeartbeat();
    if (!this.heartbeatTimer) {
      this.heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, 60_000);
    }
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startPolling() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(() => {
      void this.pollChanges();
    }, 8_000);
  }

  private stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async pollChanges(): Promise<number> {
    if (!getAccessToken() || !navigator.onLine) return 0;
    try {
      const suffix = this.pullCursor ? `?cursor=${encodeURIComponent(this.pullCursor)}` : '';
      const result = await apiRequest<{ events: Array<{ entity_type: string }>; next_cursor: string | null }>(
        `/api/sync/pull/${suffix}`,
      );
      this.pullCursor = result.next_cursor || this.pullCursor;
      for (const event of result.events || []) {
        this.invalidateCachesForEntity(event.entity_type);
      }
      this.apiReachable = true;
      this.lastSuccessfulSync = new Date();
      if (!this.isSyncing) this.setStatus('synced');
      return result.events?.length || 0;
    } catch {
      this.apiReachable = false;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.setStatus('offline');
      }
      return 0;
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    this.stopPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null; // Prevent auto-reconnect
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('offline');
  }

  private scheduleReconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connectWebSocket(), delay);
  }

  // ─── Message Handling ──────────────────────────────────────────────

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'sync_invalidation') {
        this.invalidateCachesForEntity(data.entity_type);
      } else if (data.type === 'device_revoked') {
        handleDeviceRevocation();
        this.disconnect();
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private invalidateCachesForEntity(entityType: string) {
    if (!this.queryClient) return;

    if (entityType === 'client') {
      this.queryClient.invalidateQueries({ queryKey: ['clients'] });
    } else if (entityType === 'consultation') {
      this.queryClient.invalidateQueries({ queryKey: ['consultations'] });
    }

    // Always refresh dashboard on any mutation
    this.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    this.queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
  }

  private invalidateAllCaches() {
    if (!this.queryClient) return;
    this.queryClient.invalidateQueries({ queryKey: ['clients'] });
    this.queryClient.invalidateQueries({ queryKey: ['consultations'] });
    this.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    this.queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
  }
}
