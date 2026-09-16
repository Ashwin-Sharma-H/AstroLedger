import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  size?: 'normal' | 'workspace';
  bodyStyle?: React.CSSProperties;
  showCloseButton?: boolean;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth,
  size = 'normal',
  bodyStyle,
  showCloseButton = true,
  zIndex,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCloseButton) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, showCloseButton]);

  if (!isOpen) return null;

  const modal = (
    <div className="modal-backdrop" style={zIndex ? { zIndex } : undefined} onClick={showCloseButton ? onClose : undefined}>
      <div
        className={`modal-dialog ${size === 'workspace' ? 'modal-workspace' : ''}`}
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );

  // Render above the application shell. This avoids Android WebView stacking
  // and overflow containers hiding a fixed modal opened from the mobile header.
  return createPortal(modal, document.body);
};
