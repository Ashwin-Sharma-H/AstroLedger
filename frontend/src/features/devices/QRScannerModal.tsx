import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, CheckCircle2, Link2 } from 'lucide-react';
import { Modal } from '../../components/Modal';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: { serverUrl: string; ticket?: string; accessToken?: string; refreshToken?: string }) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [cameraError, setCameraError] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [successPayload, setSuccessPayload] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');
  const [manualPin, setManualPin] = useState<string>('');
  const [isBarcodeSupported, setIsBarcodeSupported] = useState<boolean>(true);

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError('');
    setSuccessPayload(null);
    setIsBarcodeSupported('BarcodeDetector' in window);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        startDetection();
      }
    } catch (err: any) {
      console.warn('[QRScanner] Camera access error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your device settings.'
          : 'Unable to start camera. You can also manually enter the PC IP and PIN below.'
      );
    }
  };

  const parseQRContent = (text: string) => {
    const trimmed = text.trim();
    let serverUrl = '';
    let ticket: string | undefined;
    let accessToken: string | undefined;
    let refreshToken: string | undefined;

    // Format 1: JSON payload {"server": "...", "ticket": "...", "access": "..."}
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.server || parsed.server_url) {
          serverUrl = parsed.server || parsed.server_url;
          ticket = parsed.ticket || parsed.ticket_code;
          accessToken = parsed.access || parsed.access_token || parsed.token;
          refreshToken = parsed.refresh || parsed.refresh_token;
          return { serverUrl, ticket, accessToken, refreshToken };
        }
      }
    } catch {
      // Not JSON, continue to URL parser
    }

    // Format 2: URL with query parameters (?server=http://...&ticket=...&token=...&refresh=...)
    try {
      if (trimmed.includes('?')) {
        const urlObj = new URL(trimmed);
        const sParam = urlObj.searchParams.get('server');
        if (sParam) {
          serverUrl = sParam;
        } else {
          serverUrl = `${urlObj.protocol}//${urlObj.host}`;
        }
        // New Main-PC QR links use the compact `t` parameter. Keep `ticket`
        // for older generated QR codes so existing installations still pair.
        ticket = urlObj.searchParams.get('t') || urlObj.searchParams.get('ticket') || undefined;
        accessToken = urlObj.searchParams.get('token') || undefined;
        refreshToken = urlObj.searchParams.get('refresh') || undefined;
        return { serverUrl, ticket, accessToken, refreshToken };
      }
    } catch {
      // Continue to Format 3
    }

    // Format 3: Raw URL e.g. http://192.168.1.50:8000
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      serverUrl = trimmed.replace(/\/+$/, '');
      return { serverUrl };
    }

    return null;
  };

  const handleDetectedCode = (rawText: string) => {
    const parsed = parseQRContent(rawText);
    if (!parsed || !parsed.serverUrl) return;

    setSuccessPayload(parsed.serverUrl);
    stopCamera();

    // Trigger success callback after small feedback delay
    setTimeout(() => {
      onScanSuccess(parsed);
      onClose();
    }, 600);
  };

  const startDetection = () => {
    // Check if BarcodeDetector API is supported natively (Chrome / Android WebView)
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;

    if (hasBarcodeDetector) {
      try {
        const BarcodeDetectorClass = (window as any).BarcodeDetector;
        detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      } catch (e) {
        console.warn('[QRScanner] BarcodeDetector init error:', e);
      }
    }

    const checkFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(checkFrame);
        return;
      }

      if (detector) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue) {
              handleDetectedCode(rawValue);
              return;
            }
          }
        } catch {
          // Frame detection error, continue next frame
        }
      }

      animFrameRef.current = requestAnimationFrame(checkFrame);
    };

    animFrameRef.current = requestAnimationFrame(checkFrame);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    let cleanUrl = manualInput.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    if (!cleanUrl.includes(':8000') && !cleanUrl.includes(':5173')) {
      cleanUrl = `${cleanUrl}:8000`;
    }

    const cleanPin = manualPin.trim().replace(/\s+/g, '').replace(/-/g, '') || undefined;
    onScanSuccess({ serverUrl: cleanUrl, ticket: cleanPin });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan QR to Pair with PC"
      maxWidth="480px"
      // MobilePairingView is an intentional full-screen layer at z-index 9999.
      // The camera must be above it, not merely above the regular app shell.
      zIndex={10001}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        {/* Scanner Viewport */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '340px',
            height: '280px',
            background: '#07090e',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '2px solid rgba(245, 158, 11, 0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Scanning Reticle Overlay */}
          {scanning && !successPayload && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              {/* Target Square */}
              <div
                style={{
                  width: '200px',
                  height: '200px',
                  border: '2px solid #f59e0b',
                  borderRadius: '12px',
                  boxShadow: '0 0 0 4000px rgba(7, 9, 14, 0.65)',
                  position: 'relative',
                }}
              >
                {/* Laser scan line animation */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, #f59e0b, #fbbf24, transparent)',
                    boxShadow: '0 0 8px #f59e0b',
                    animation: 'scanLaser 2s linear infinite',
                  }}
                />
              </div>
            </div>
          )}

          {/* Success Overlay */}
          {successPayload && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(7, 9, 14, 0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                zIndex: 10,
              }}
            >
              <CheckCircle2 size={48} color="#34d399" />
              <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.95rem' }}>
                QR Code Detected!
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                {successPayload}
              </span>
            </div>
          )}

          {/* Camera Error / Placeholder */}
          {cameraError && !scanning && (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#fb7185',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                zIndex: 2,
              }}
            >
              <AlertCircle size={32} color="#fb7185" />
              <p style={{ fontSize: '0.82rem', margin: 0 }}>{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} /> Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Instructions & WebView Barcode Support Notice */}
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 6px 0' }}>
            Point your phone camera at the <strong>Device Sync (QR)</strong> screen on your computer.
          </p>
          {!isBarcodeSupported && (
            <div
              style={{
                fontSize: '0.74rem',
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '4px 8px',
                borderRadius: '6px',
                marginTop: '4px',
              }}
            >
              Camera QR auto-detect is disabled in this Android WebView. Please enter the 6-digit PIN below.
            </div>
          )}
        </div>

        {/* Manual Pairing IP + PIN Input Alternative */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '12px' }}>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Link2 size={13} color="#f59e0b" />
              Or enter PC Station IP &amp; 6-Digit PIN manually:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                placeholder="Station IP (e.g. 192.168.29.176)"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="input-control"
                style={{ fontSize: '0.82rem', padding: '8px 12px', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
              <input
                type="text"
                maxLength={8}
                placeholder="6-digit PIN (e.g. 582194)"
                value={manualPin}
                onChange={(e) => setManualPin(e.target.value)}
                className="input-control"
                style={{ fontSize: '1.15rem', padding: '8px 12px', textAlign: 'center', fontWeight: 700, letterSpacing: '4px', color: '#34d399', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: '0.86rem', padding: '10px 14px', width: '100%', boxSizing: 'border-box', marginTop: '2px' }}
            >
              Connect &amp; Link Phone
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 100%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
      `}</style>
    </Modal>
  );
};
