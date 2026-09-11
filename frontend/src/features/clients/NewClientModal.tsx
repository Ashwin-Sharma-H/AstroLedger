import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Sparkles, User, ShieldAlert, ExternalLink, Check } from 'lucide-react';
import { Client } from '../../types';
import { NAKSHATRAS, RASHIS } from '../../core/constants/astrology';
import { checkClientDuplicates, DuplicateMatch } from '../../core/api/client';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (clientData: Partial<Client>) => Promise<void>;
  existingClients?: Client[];
  onSelectExistingClient?: (client: Client) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSelectExistingClient,
}) => {
  const [formData, setFormData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    alternate_phone: '',
    email: '',
    gender: 'Male',
    address: '',
    dob: '',
    birth_time: '',
    birth_place: '',
    birth_star: '',
    rashi: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [ignoredDuplicateIds, setIgnoredDuplicateIds] = useState<Set<string>>(new Set());

  // Debounced API-Driven Duplicate Detection
  useEffect(() => {
    const hasSearchCriteria = Boolean(
      (formData.name && formData.name.trim().length >= 2) ||
      (formData.phone && formData.phone.trim().length >= 4) ||
      (formData.alternate_phone && formData.alternate_phone.trim().length >= 4) ||
      formData.dob ||
      formData.birth_star
    );

    if (!hasSearchCriteria) {
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
        });
        setDuplicateMatches(result.matches || []);
      } catch (err) {
        console.error('Failed to verify duplicates:', err);
      } finally {
        setIsCheckingDuplicates(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [
    formData.name,
    formData.phone,
    formData.alternate_phone,
    formData.dob,
    formData.birth_time,
    formData.birth_place,
    formData.birth_star,
    formData.rashi,
  ]);

  // Filter out any matches astrologer chose to ignore
  const activeDuplicates = duplicateMatches.filter(
    (m) => !ignoredDuplicateIds.has(m.client.id)
  );
  const topMatch = activeDuplicates.length > 0 ? activeDuplicates[0] : null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Client Profile — Astrological Dossier"
      maxWidth="1100px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span className="modal-footer-hint" style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            All entries are indexed for multi-field cross-searching & duplicate detection.
          </span>
          <div className="modal-footer-actions">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Sparkles size={16} />
              {isSubmitting ? 'Saving...' : 'Create Client Profile'}
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Responsive Form Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '20px', alignItems: 'start' }}>
          {/* Left Column: Personal & Contact Details */}
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
              <User size={16} /> 1. Personal & Contact Details
            </div>

            {/* Live Duplicate & Similarity Disambiguation Card */}
            {topMatch && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    topMatch.confidence_level === 'HIGH'
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(245, 158, 11, 0.12) 100%)'
                      : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%)',
                  border:
                    topMatch.confidence_level === 'HIGH'
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid rgba(59, 130, 246, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert
                      size={16}
                      color={topMatch.confidence_level === 'HIGH' ? '#f87171' : '#60a5fa'}
                    />
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background:
                          topMatch.confidence_level === 'HIGH'
                            ? 'rgba(239, 68, 68, 0.25)'
                            : 'rgba(59, 130, 246, 0.25)',
                        color: topMatch.confidence_level === 'HIGH' ? '#fca5a5' : '#93c5fd',
                      }}
                    >
                      {topMatch.confidence_level} MATCH ({topMatch.confidence_score}%)
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Existing: {topMatch.client.name} ({topMatch.client.client_code})
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {onSelectExistingClient && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectExistingClient(topMatch.client);
                          onClose();
                        }}
                        className="btn btn-primary"
                        style={{
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <ExternalLink size={13} /> Open Existing
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setIgnoredDuplicateIds((prev) => new Set(prev).add(topMatch.client.id))
                      }
                      className="btn btn-ghost"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Ignore this match and proceed creating a separate record"
                    >
                      <Check size={13} /> Ignore & Proceed
                    </button>
                  </div>
                </div>

                {/* Match Reasons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem' }}>
                  {topMatch.match_reasons.map((reason, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: '#fef08a',
                      }}
                    >
                      ✓ {reason}
                    </span>
                  ))}
                  {activeDuplicates.length > 1 && (
                    <span style={{ color: 'var(--text-muted)', padding: '2px 4px' }}>
                      +{activeDuplicates.length - 1} other similar profile(s)
                    </span>
                  )}
                </div>
              </div>
            )}

            {isCheckingDuplicates && !topMatch && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Checking client registry for potential duplicates...
              </div>
            )}


            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Full Name *</label>
              <input
                required
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Anandha Krishnan"
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            <div className="modal-form-grid-2">
              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Primary Phone</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98470 12345"
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
                  placeholder="e.g. +91 94471 67890"
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
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="client@example.com"
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
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
                placeholder="House name, street, town, postal code..."
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.875rem' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.78rem' }}>Astrologer Profile Notes</label>
              <textarea
                name="notes"
                rows={2}
                value={formData.notes}
                onChange={handleChange}
                placeholder="Important permanent background notes about family, referral, or general circumstances..."
                className="input-control"
                style={{ padding: '8px 12px', fontSize: '0.85rem', resize: 'none' }}
              />
            </div>
          </div>

          {/* Right Column: Birth & Horoscopic Coordinates */}
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
                  value={formData.dob}
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
                  value={formData.birth_time}
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
                value={formData.birth_place}
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
                  list="horiz-nakshatras"
                  name="birth_star"
                  value={formData.birth_star}
                  onChange={handleChange}
                  placeholder="Select Nakshatra..."
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
                <datalist id="horiz-nakshatras">
                  {NAKSHATRAS.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontSize: '0.78rem' }}>Rashi / Month (രാശി / മാസം)</label>
                <input
                  list="horiz-rashis"
                  name="rashi"
                  value={formData.rashi}
                  onChange={handleChange}
                  placeholder="Select Rashi / Month..."
                  className="input-control"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                />
                <datalist id="horiz-rashis">
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
                {formData.dob && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    DOB: {formData.dob}{' '}
                    {calculateAge(formData.dob) !== null && `(${calculateAge(formData.dob)} yrs)`}
                  </span>
                )}
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
                    {formData.birth_place || 'Not Provided'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                🌿 Traditional Kerala Nirayana system: 27 Malayalam Nakshatras & 12 Kollam months.
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
