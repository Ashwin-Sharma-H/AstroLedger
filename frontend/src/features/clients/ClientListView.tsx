import React, { useState } from 'react';
import { Search, PlusCircle, Phone, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { Client } from '../../types';
import { Badge } from '../../components/Badge';

interface ClientListViewProps {
  clients: Client[];
  isLoading: boolean;
  onSelectClient: (client: Client) => void;
  onOpenNewClient: () => void;
  onOpenAdvancedSearch: () => void;
}

export const ClientListView: React.FC<ClientListViewProps> = ({
  clients,
  isLoading,
  onSelectClient,
  onOpenNewClient,
  onOpenAdvancedSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = clients.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.client_code && c.client_code.toLowerCase().includes(term)) ||
      (c.birth_star && c.birth_star.toLowerCase().includes(term)) ||
      (c.birth_place && c.birth_place.toLowerCase().includes(term))
    );
  });

  return (
    <div className="client-directory-container" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'hidden' }}>
      {/* Pinned Top Section: Header & Search Bar */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Dedicated Page Header Banner */}
        <div
          className="glass-panel dashboard-hero-banner"
          style={{
            padding: '24px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2 className="dashboard-hero-title" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Client & Horoscope Registry
            </h2>
            <p className="dashboard-hero-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Permanent astrologer client dossiers, Vedic birth coordinates, and consultation history ({clients.length} profiles registered).
            </p>
          </div>

          <button
            onClick={onOpenNewClient}
            className="btn btn-primary dashboard-hero-action"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px' }}
          >
            <PlusCircle size={16} /> Add Client
          </button>
        </div>

        {/* Search & Advanced Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 'min(100%, 200px)',
            }}
          >
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search by name, phone, Nakshatra, city, or client code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-control"
              style={{ paddingLeft: '42px' }}
            />
          </div>

          <button
            onClick={onOpenAdvancedSearch}
            className="btn btn-secondary client-search-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Search size={15} /> Advanced Search
          </button>
        </div>
      </div>

      {/* Scrollable Contents Below: Client Cards List */}
      <div className="client-list-scroll-area" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading astrologer client records...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="glass-panel"
            style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}
          >
            <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No matching client profiles found</p>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Try adjusting your search criteria or register a new client profile.
            </span>
          </div>
        ) : (
          filtered.map((client) => (
            <div
              key={client.id}
              onClick={() => onSelectClient(client)}
              className="glass-panel glass-panel-hover client-list-card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              {/* Primary Info */}
              <div className="client-list-card-main" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#fbbf24',
                    flexShrink: 0,
                  }}
                >
                  {client.name.charAt(0).toUpperCase()}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, wordBreak: 'break-word' }}>{client.name}</h4>
                    <Badge variant="gold">{client.client_code}</Badge>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {client.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <Phone size={13} /> {client.phone}
                      </span>
                    )}
                    {client.birth_place && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <MapPin size={13} /> {client.birth_place}
                      </span>
                    )}
                    {client.dob && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                        <Calendar size={13} /> DOB: {client.dob}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Astrological Snapshot & Visits */}
              <div className="client-list-card-sub" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'right' }}>
                  {client.birth_star && (
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--accent-gold-light)' }}>
                      ★ {client.birth_star}
                    </div>
                  )}
                  {client.rashi && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Rashi: {client.rashi}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Badge variant="mystic">{client.visit_count || 0} Visits</Badge>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
