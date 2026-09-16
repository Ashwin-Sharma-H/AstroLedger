/**
 * Platform and Device Role Detection
 * Differentiates between the Main PC Station (Admin/Database Host) and Companion Devices (Mobile/Tablet APK).
 */

export const isCompanionDevice = (): boolean => {
  if (typeof window === 'undefined') return false;

  // 1. Explicit local override (for testing or switching mode)
  const forceRole = localStorage.getItem('astro_device_role');
  if (forceRole === 'companion') return true;
  if (forceRole === 'station') return false;

  // 2. Query param override
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'companion') return true;
    if (params.get('role') === 'station') return false;
  } catch (e) {
    // Ignore URL parse errors
  }

  // 3. Capacitor Native App environment (Android APK / iOS)
  const capacitor = (window as any).Capacitor;
  if (capacitor && typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform()) {
    return true;
  }

  // 4. Electron Desktop App environment (Strictly Main PC Station)
  if ((window as any).electronAPI || navigator.userAgent.toLowerCase().includes('electron')) {
    return false;
  }

  // 5. Mobile / Tablet User Agent
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  if (isMobileUA) {
    return true;
  }

  // 6. Touch-primary small screen viewport
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  if (isTouch && isSmallScreen) {
    return true;
  }

  return false;
};

export const getDeviceId = (): string => {
  let id = localStorage.getItem('astro_device_id');
  if (!id) {
    id = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem('astro_device_id', id);
  }
  return id;
};

export const getDeviceName = (): string => {
  const custom = localStorage.getItem('astro_device_name');
  if (custom && custom.trim()) return custom.trim();

  const ua = navigator.userAgent;
  if (/android/i.test(ua)) {
    const match = ua.match(/;\s*([^;]+)\s+Build\//);
    if (match && match[1]) return match[1].trim();
    return 'Android Companion';
  }
  if (/iphone/i.test(ua)) return 'iPhone Companion';
  if (/ipad/i.test(ua)) return 'iPad Companion';
  return 'Mobile Companion';
};

export const setDeviceRole = (role: 'companion' | 'station' | 'auto') => {
  if (role === 'auto') {
    localStorage.removeItem('astro_device_role');
  } else {
    localStorage.setItem('astro_device_role', role);
  }
};
