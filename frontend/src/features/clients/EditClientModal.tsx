import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Client } from '../../types';
import { NAKSHATRAS, RASHIS } from '../../core/constants/astrology';
import { Save, Trash2, AlertTriangle, User, Sparkles, ShieldAlert } from 'lucide-react';
import { checkClientDuplicates, DuplicateMatch } from '../../core/api/client';

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (id: string, data: Partial<Client>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const EditClientModal: React.FC<EditClientModalProps> = ({
  isOpen,
  onClose,
  client,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Partial<Client>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        phone: client.phone || '',
        alternate_phone: client.alternate_phone || '',
        email: client.email || '',
        gender: client.gender || 'Male',
        address: client.address || '',
        dob: client.dob || '',
        birth_time: client.birth_time || '',
        birth_place: client.birth_place || '',
        birth_star: client.birth_star || '',
        rashi: client.rashi || '',
        notes: client.notes || '',
      });
      setConfirmDelete(false);
      setDuplicateMatches([]);
    }
  }, [client, isOpen]);

  // Check duplicates on edit (excluding current client id)
  useEffect(() => {
    if (!client || (!formData.name && !formData.phone)) {
      setDuplicateMatches([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      try {
        const result = await checkClientDuplicates({
          name: formData.name,
          phone: formData.phone,
          alternate_phone: formData.alternate_phone,
          dob: formData.dob,
          birth_time: formData.birth_time,
          birth_place: formData.birth_place,
          birth_star: formData.birth_star,
          rashi: formData.rashi,
          exclude_client_id: client.id,
        });
        setDuplicateMatches(result.matches || []);
      } catch (err) {
        console.error('Failed to verify duplicates during edit:', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [
    client?.id,
    formData.name,
    formData.phone,
    formData.alternate_phone,
    formData.dob,
    formData.birth_star,
  ]);


  if (!client) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const diffMs = Date.now() - dob.getTime();
    const ageDt = new Date(diffMs);
    return Math.abs(ageDt.getUTCFullYear() - 1970);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      await onSave(client.id, formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(client.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Client Profile — ${client.name} (${client.client_code})`}
      maxWidth="1100px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div>
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="btn btn-ghost"
                style={{ color: '#fb7185' }}
              >
                <Trash2 size={16} /> Delete Profile
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={14} color="#fb7185" />
                <span style={{ fontSize: '0.8rem', color: '#fb7185' }}>Confirm archive?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="btn"
                  style={{ background: '#e11d48', color: '#fff', padding: '6px 12px' }}
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 10px' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="modal-footer-actions">
            <span className="modal-footer-hint" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Revision: v{client.version}
            </span>
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || !formData.name}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Responsive Form Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Personal Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <User size={16} /> 1. Personal & Contact Information
            </div>

            {/* Conflict Warning if details match another registered client */}
            {duplicateMatches.length > 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.78rem',
                  color: '#fca5a5',
                }}
              >
                <ShieldAlert size={15} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Possible Conflict:</strong> Matches existing client{' '}
                  <strong>{duplicateMatches[0].client.name}</strong> ({duplicateMatches[0].client.client_code}) — {duplicateMatches[0].match_reasons.join(', ')}.
                </span>
              </div>
            )}

            {isCheckingDuplicates && duplicateMatches.length === 0 && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Checking contact uniqueness...
              </div>
            )}

            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Full Name *</label>
              <input
                required
                name="name"
                value={formData.name || ''}
                onChange={handleChange}
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            <div className="modal-form-grid-2">
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Primary Phone</label>
                <input
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>WhatsApp / Alt</label>
                <input
                  name="alternate_phone"
                  value={formData.alternate_phone || ''}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div className="modal-form-grid-1-4">
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Gender</label>
                <select
                  name="gender"
                  value={formData.gender || 'Male'}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Address & Residence</label>
              <input
                name="address"
                value={formData.address || ''}
                onChange={handleChange}
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Astrologer Permanent Notes</label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes || ''}
                onChange={handleChange}
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.85rem', resize: 'none' }}
              />
            </div>
          </div>

          {/* Right Column: Horoscopic Attributes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Sparkles size={16} /> 2. Birth & Jyotish Coordinates (ജ്യോതിഷ വിവരങ്ങൾ)
            </div>

            <div className="modal-form-grid-2">
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Date of Birth (ജനന തീയതി)</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob || ''}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Time of Birth (ജനന സമയം)</label>
                <input
                  type="time"
                  name="birth_time"
                  value={formData.birth_time || ''}
                  onChange={handleChange}
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Place of Birth (ജനന സ്ഥലം)</label>
              <input
                name="birth_place"
                value={formData.birth_place || ''}
                onChange={handleChange}
                placeholder="e.g. Kozhikode, Thrissur, Ernakulam, Trivandrum..."
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            <div className="modal-form-grid-2">
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Nakshatra (ജനന നാൾ / നക്ഷത്രം)</label>
                <input
                  list="edit-horiz-nakshatras"
                  name="birth_star"
                  value={formData.birth_star || ''}
                  onChange={handleChange}
                  placeholder="Select Nakshatra..."
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
                <datalist id="edit-horiz-nakshatras">
                  {NAKSHATRAS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Rashi / Month (രാശി / മാസം)</label>
                <input
                  list="edit-horiz-rashis"
                  name="rashi"
                  value={formData.rashi || ''}
                  onChange={handleChange}
                  placeholder="Select Rashi / Month..."
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
                <datalist id="edit-horiz-rashis">
                  {RASHIS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Compact Panchangam Live Preview Box */}
            <div
              style={{
                marginTop: '4px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Panchangam Snapshot
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Code: {client.client_code}{' '}
                  {formData.dob && calculateAge(formData.dob) !== null && `• ${calculateAge(formData.dob)} yrs`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 90px), 1fr))', gap: '8px' }}>
                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>NAKSHATRA (നാൾ)</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fef08a', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formData.birth_star || 'Not Selected'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RASHI / MONTH</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#93c5fd', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formData.rashi || 'Not Selected'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>BIRTH PLACE</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formData.birth_place || 'Not Recorded'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🌿 Traditional Kerala Nirayana astrology standard: 27 Malayalam Panchangam Nakshatras & 12 Kollam months.
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
