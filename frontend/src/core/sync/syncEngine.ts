/**
 * SyncEngine — Real-time WebSocket synchronization & offline-first queue manager.
 *
 * Responsibilities:
 *  1. Connect to /ws/sync/?token=<jwt> with automatic reconnection & exponential backoff.
 *  2. On incoming sync_invalidation messages, invalidate TanStack Query caches.
 *  3. Flush offline mutation queue to /api/sync/push/ on reconnect.
 *  4. Expose sync status ('synced' | 'syncing' | 'offline') with subscriber pattern.
 */
import { apiRequest, getAccessToken, getBaseUrl } from '../api/client';
import { getQueuedOfflineEvents, removeQueuedOfflineEvent } from '../storage/indexedDB';
import { QueryClient } from '@tanstack/react-query';

export type SyncStatus = 'synced' | 'syncing' | 'offline';

type SyncStatusListener = (status: SyncStatus, pendingCount: number) => void;

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

  // ─── Status ────────────────────────────────────────────────────────

  public get status(): SyncStatus {
    return this._status;
  }

  public get pendingCount(): number {
    return this._pendingCount;
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    // Immediately notify the new subscriber of current state
    listener(this._status, this._pendingCount);
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
    this.listeners.forEach((fn) => fn(this._status, this._pendingCount));
  }

  // ─── Offline Queue Flush ───────────────────────────────────────────

  public async flushQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;
    this.setStatus('syncing');

    try {
      const queue = await getQueuedOfflineEvents();
      if (queue.length === 0) {
        this.isSyncing = false;
        this.setStatus(this.socket?.readyState === WebSocket.OPEN ? 'synced' : 'offline');
        this._pendingCount = 0;
        this.notifyListeners();
        return;
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

      if (response?.applied_keys) {
        for (const key of response.applied_keys) {
          await removeQueuedOfflineEvent(key);
        }
      }

      // Invalidate caches after successful sync
      this.invalidateAllCaches();

      await this.refreshPendingCount();
      this.setStatus(this.socket?.readyState === WebSocket.OPEN ? 'synced' : 'offline');
    } catch (err) {
      console.warn('Sync flush postponed:', err);
      this.setStatus('offline');
      await this.refreshPendingCount();
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
        this.stopHeartbeat();
        this.setStatus('offline');
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
    } catch {
      // Non-fatal background device heartbeat
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

  public disconnect() {
    this.stopHeartbeat();
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
