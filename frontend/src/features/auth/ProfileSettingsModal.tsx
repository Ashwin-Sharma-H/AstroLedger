import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { User } from '../../types';
import { apiRequest } from '../../core/api/client';
import { UserCheck, KeyRound, Check, AlertCircle } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onProfileUpdated: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Form State
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    bio: '',
  });

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        title: currentUser.title || 'Vedic Astrologer',
        phone: currentUser.phone || '',
        timezone: currentUser.timezone || 'Asia/Kolkata',
        bio: currentUser.bio || '',
      });
    }
  }, [currentUser]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      await apiRequest('/api/auth/me/', {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      setStatusMessage({ type: 'success', text: 'Astrologer profile updated successfully!' });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (passwordData.new_password !== passwordData.confirm_password) {
      setStatusMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/auth/change-password/', {
        method: 'POST',
        body: JSON.stringify({
          old_password: passwordData.old_password,
          new_password: passwordData.new_password,
        }),
      });
      setStatusMessage({ type: 'success', text: 'Password successfully changed!' });
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Astrologer Account & Security"
      maxWidth="620px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tab switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setStatusMessage(null);
            }}
            className="btn"
            style={{
              flex: 1,
              justifyContent: 'center',
              background: activeTab === 'profile' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: activeTab === 'profile' ? '#fbbf24' : 'var(--text-secondary)',
              border: activeTab === 'profile' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
              padding: '8px 12px',
              fontSize: '0.85rem',
            }}
          >
            <UserCheck size={16} />
            Profile Details
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('security');
              setStatusMessage(null);
            }}
            className="btn"
            style={{
              flex: 1,
              justifyContent: 'center',
              background: activeTab === 'security' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: activeTab === 'security' ? '#fbbf24' : 'var(--text-secondary)',
              border: activeTab === 'security' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
              padding: '8px 12px',
              fontSize: '0.85rem',
            }}
          >
            <KeyRound size={16} />
            Change Password
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background:
                statusMessage.type === 'success'
                  ? 'rgba(52, 211, 153, 0.12)'
                  : 'rgba(251, 113, 133, 0.12)',
              border:
                statusMessage.type === 'success'
                  ? '1px solid rgba(52, 211, 153, 0.3)'
                  : '1px solid rgba(251, 113, 133, 0.3)',
              color: statusMessage.type === 'success' ? '#34d399' : '#fb7185',
              fontSize: '0.85rem',
            }}
          >
            {statusMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label">Astrologer Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-control"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Professional Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Vedic Astrologer"
                  className="input-control"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label">Account Email (Permanent)</label>
                <input
                  type="email"
                  disabled
                  value={currentUser?.email || ''}
                  className="input-control"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Contact Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="input-control"
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Consultation Timezone</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="input-control"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC">UTC (+0:00)</option>
                <option value="America/New_York">America/New York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Astrological Bio / Consultation Specialty</label>
              <textarea
                rows={3}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Parashara astrology, Jaimini, Prashna, Gemstone recommendations..."
                className="input-control"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary modal-action-btn">
                {isSubmitting ? 'Updating...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Current Password *</label>
              <input
                type="password"
                required
                value={passwordData.old_password}
                onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                placeholder="••••••••"
                className="input-control"
              />
            </div>

            <div className="input-group">
              <label className="input-label">New Password (minimum 8 characters) *</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                placeholder="••••••••"
                className="input-control"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                placeholder="••••••••"
                className="input-control"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" disabled={isSubmitting} className="btn btn-primary modal-action-btn">
                {isSubmitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
