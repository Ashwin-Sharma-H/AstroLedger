import React, { useState } from 'react';
import { Client, Consultation } from '../../types';
import { X, Sparkles, FileText, AlertCircle } from 'lucide-react';

interface RecordConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onSubmit: (consultationData: Partial<Consultation>) => Promise<void>;
  onSuccess: () => void;
}

export const RecordConsultationModal: React.FC<RecordConsultationModalProps> = ({
  isOpen,
  onClose,
  client,
  onSubmit,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<Consultation>>({
    consultation_date: new Date().toISOString().split('T')[0],
    consultation_time: new Date().toTimeString().slice(0, 5),
    consultation_type: 'General Horoscope',
    reason: '',
    discussion: '',
    summary: '',
    advice: '',
    follow_up_required: false,
    follow_up_date: '',
    follow_up_notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.id) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: Partial<Consultation> = {
        ...formData,
        client: client.id,
        follow_up_required: !!formData.follow_up_required,
        follow_up_date: formData.follow_up_required && formData.follow_up_date ? formData.follow_up_date : null,
        consultation_time: formData.consultation_time ? formData.consultation_time : null,
        follow_up_notes: formData.follow_up_notes || '',
      };
      await onSubmit(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to record consultation:', err);
      setErrorMsg(err.message || 'Failed to record consultation. Please verify all inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const followUpPresets = [
    { label: '+7 Days', days: 7 },
    { label: '+14 Days', days: 14 },
    { label: '+21 Days', days: 21 },
    { label: '+41 Days (Mandalam)', days: 41 },
    { label: '+3 Months', days: 90 },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '780px', width: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={18} color="#fbbf24" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Record Astrological Consultation
              </h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Client: <strong style={{ color: '#fbbf24' }}>{client.name}</strong> ({client.client_code})
                {client.birth_star && ` • Star: ${client.birth_star}`}
                {client.rashi && ` • Rashi: ${client.rashi}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Row 1: Date, Time & Category */}
            <div className="modal-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: '12px' }}>
              <div className="input-group">
                <label className="input-label">Date of Visit *</label>
                <input
                  type="date"
                  name="consultation_date"
                  required
                  value={formData.consultation_date || ''}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Time</label>
                <input
                  type="time"
                  name="consultation_time"
                  value={formData.consultation_time || ''}
                  onChange={handleChange}
                  className="input-control"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Consultation Category (വിഭാഗം)</label>
                <select
                  name="consultation_type"
                  value={formData.consultation_type}
                  onChange={handleChange}
                  className="input-control"
                >
                  <option value="General Horoscope">General Horoscope (ജാതക നിരൂപണം)</option>
                  <option value="Kundali Matching">Kundali Matching / Porutham (പൊരുത്തം)</option>
                  <option value="Career & Business">Career & Business (തൊഴിൽ & വ്യാപാരം)</option>
                  <option value="Health & Longevity">Health & Longevity (ആരോഗ്യം & ആയുസ്സ്)</option>
                  <option value="Prashnam">Prashnam (പ്രശ്ന വിചാരം)</option>
                  <option value="Muhurtham">Muhurtham (ശുഭ മുഹൂർത്തം)</option>
                  <option value="Pariharam & Remedies">Pariharam & Remedies (പരിഹാര കർമ്മങ്ങൾ)</option>
                  <option value="Childbirth & Santana">Childbirth & Santana (സന്താന ഭാഗ്യം)</option>
                  <option value="Other">Other Specific Astrological Inquiry</option>
                </select>
              </div>
            </div>

            {/* Row 2: Client Inquiry / Reason */}
            <div className="input-group">
              <label className="input-label">Client Inquiry / Reason for Visit</label>
              <input
                type="text"
                name="reason"
                value={formData.reason || ''}
                onChange={handleChange}
                placeholder="e.g. Job transition timing, Sade Sati consultation, Auspicious marriage window..."
                className="input-control"
              />
            </div>

            {/* Row 3: Detailed Planetary Observations */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Detailed Astrological Analysis & Planetary Observations</span>
                <span style={{ fontSize: '0.72rem', color: '#93c5fd', textTransform: 'none', fontWeight: 500 }}>
                  Graha Gocharam, Dasha, Navamsha
                </span>
              </label>
              <textarea
                name="discussion"
                value={formData.discussion || ''}
                onChange={handleChange}
                rows={4}
                placeholder="Transits (Gocharam), current Dasha-Bhukti effects, planetary aspects, house lord placements, Navamsha observations..."
                className="input-control"
                style={{ resize: 'vertical', minHeight: '90px' }}
              />
            </div>

            {/* Row 4: Prescribed Remedies & Advice */}
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fbbf24' }}>Prescribed Remedies & Advice (പരിഹാരങ്ങൾ & ഉപദേശങ്ങൾ)</span>
                <span style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'none', fontWeight: 500 }}>
                  Poojas, Gemstones, Mantras
                </span>
              </label>
              <textarea
                name="advice"
                value={formData.advice || ''}
                onChange={handleChange}
                rows={4}
                placeholder="Recommended temple visits, poojas, archana, mantras, gemstones (weight & metal), lifestyle/dietary guidance..."
                className="input-control"
                style={{
                  resize: 'vertical',
                  minHeight: '90px',
                  borderColor: 'rgba(245, 158, 11, 0.35)',
                }}
              />
            </div>

            {/* Row 5: Follow-up Scheduling */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    name="follow_up_required"
                    checked={!!formData.follow_up_required}
                    onChange={handleChange}
                    style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                  />
                  <span>Schedule Follow-up Consultation (തുടർ സന്ദർശനം)</span>
                </label>

                {formData.follow_up_required && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {followUpPresets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const target = new Date();
                          target.setDate(target.getDate() + preset.days);
                          setFormData((prev) => ({
                            ...prev,
                            follow_up_date: target.toISOString().split('T')[0],
                          }));
                        }}
                        className="btn btn-ghost"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '4px',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {formData.follow_up_required && (
                <div className="modal-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '12px' }}>
                  <div className="input-group">
                    <label className="input-label">Follow-up Target Date</label>
                    <input
                      type="date"
                      name="follow_up_date"
                      value={formData.follow_up_date || ''}
                      onChange={handleChange}
                      className="input-control"
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Follow-up Instructions</label>
                    <input
                      type="text"
                      name="follow_up_notes"
                      value={formData.follow_up_notes || ''}
                      onChange={handleChange}
                      placeholder="e.g. Review planetary transit effects after 41-day mandala pooja"
                      className="input-control"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="modal-footer-actions">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.925rem' }}
              >
                <FileText size={16} />
                {isSubmitting ? 'Recording Visit...' : 'Save Consultation Record'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
