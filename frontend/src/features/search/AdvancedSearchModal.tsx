import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/Modal';
import { Search, ChevronRight, SlidersHorizontal, Phone, Calendar } from 'lucide-react';
import { Client } from '../../types';
import { Badge } from '../../components/Badge';
import { NAKSHATRAS, RASHIS } from '../../core/constants/astrology';
import { apiRequest } from '../../core/api/client';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSelectClient: (client: Client) => void;
}

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  clients,
  onSelectClient,
}) => {
  const [filters, setFilters] = useState({
    q: '',
    name: '',
    phone: '',
    dob: '',
    birth_place: '',
    birth_star: '',
    rashi: '',
  });

  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all');
  const [results, setResults] = useState<Client[]>(clients);
  const [isSearching, setIsSearching] = useState(false);

  // Trigger search on filter changes with debounce
  useEffect(() => {
    if (!isOpen) return;

    const hasAnyInput = Object.values(filters).some((v) => v.trim() !== '');
    if (!hasAnyInput) {
      setResults(clients);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const queryParams = new URLSearchParams();
        if (filters.q) queryParams.append('q', filters.q);
        if (filters.name) queryParams.append('name', filters.name);
        if (filters.phone) queryParams.append('phone', filters.phone);
        if (filters.dob) queryParams.append('dob', filters.dob);
        if (filters.birth_place) queryParams.append('birth_place', filters.birth_place);
        if (filters.birth_star) queryParams.append('birth_star', filters.birth_star);
        if (filters.rashi) queryParams.append('rashi', filters.rashi);
        queryParams.append('mode', matchMode);

        const data = await apiRequest(`/api/clients/search/?${queryParams.toString()}`);
        setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        // Fallback to local filtering if offline
        const localMatches = clients.filter((c) => {
          if (filters.name && !c.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
          if (filters.phone && (!c.phone || !c.phone.includes(filters.phone))) return false;
          if (filters.dob && c.dob !== filters.dob) return false;
          if (filters.birth_place && (!c.birth_place || !c.birth_place.toLowerCase().includes(filters.birth_place.toLowerCase()))) return false;
          if (filters.birth_star && (!c.birth_star || !c.birth_star.toLowerCase().includes(filters.birth_star.toLowerCase()))) return false;
          if (filters.rashi && (!c.rashi || !c.rashi.toLowerCase().includes(filters.rashi.toLowerCase()))) return false;
          return true;
        });
        setResults(localMatches);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [filters, matchMode, isOpen, clients]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFilters({
      q: '',
      name: '',
      phone: '',
      dob: '',
      birth_place: '',
      birth_star: '',
      rashi: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Advanced Multi-Attribute Jyotish Search"
      maxWidth="820px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <button onClick={handleClear} className="btn btn-ghost">
            Reset Filters
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {isSearching ? 'Searching...' : `Found ${results.length} matching profile(s)`}
          </span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Universal Search & Match Mode Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 'min(100%, 240px)' }}>
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              name="q"
              value={filters.q}
              onChange={handleChange}
              placeholder="Instant search across Name, Phone, Code, Nakshatra, or City..."
              className="input-control"
              style={{ paddingLeft: '42px' }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setMatchMode('all')}
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                background: matchMode === 'all' ? '#f59e0b' : 'transparent',
                color: matchMode === 'all' ? '#07090e' : 'var(--text-secondary)',
              }}
            >
              Match ALL (AND)
            </button>
            <button
              type="button"
              onClick={() => setMatchMode('any')}
              className="btn"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                background: matchMode === 'any' ? '#f59e0b' : 'transparent',
                color: matchMode === 'any' ? '#07090e' : 'var(--text-secondary)',
              }}
            >
              Match ANY (OR)
            </button>
          </div>
        </div>

        {/* Multi-Field Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px' }}>
          <div className="input-group">
            <label className="input-label">Name (Partial match supported)</label>
            <input
              name="name"
              value={filters.name}
              onChange={handleChange}
              placeholder="e.g. Ramesh, Sunita"
              className="input-control"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Phone Number</label>
            <input
              name="phone"
              value={filters.phone}
              onChange={handleChange}
              placeholder="e.g. 9840"
              className="input-control"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Date of Birth</label>
            <input
              type="date"
              name="dob"
              value={filters.dob}
              onChange={handleChange}
              className="input-control"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Place of Birth / City</label>
            <input
              name="birth_place"
              value={filters.birth_place}
              onChange={handleChange}
              placeholder="e.g. Kozhikode, Palakkad"
              className="input-control"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Nakshatra (Birth Star / നാൾ)</label>
            <input
              list="search-nakshatras"
              name="birth_star"
              value={filters.birth_star}
              onChange={handleChange}
              placeholder="e.g. Aswathy, Thiruvonam..."
              className="input-control"
            />
            <datalist id="search-nakshatras">
              {NAKSHATRAS.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          <div className="input-group">
            <label className="input-label">Rashi / Malayalam Month (രാശി / മാസം)</label>
            <input
              list="search-rashis"
              name="rashi"
              value={filters.rashi}
              onChange={handleChange}
              placeholder="e.g. Chingam, Kanni, Thulam..."
              className="input-control"
            />
            <datalist id="search-rashis">
              {RASHIS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Quick Filters:</span>
          {['Aswathy (അശ്വതി)', 'Rohini (രോഹിണി)', 'Thiruvonam (തിരുവോണം)', 'Chingam (ചിങ്ങം)', 'Kanni (കന്നി)'].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                if (chip.includes('Chingam') || chip.includes('Kanni')) {
                  setFilters((prev) => ({ ...prev, rashi: chip }));
                } else {
                  setFilters((prev) => ({ ...prev, birth_star: chip }));
                }
              }}
              style={{
                fontSize: '0.75rem',
                padding: '3px 10px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              + {chip.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Search Results Display */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="#fbbf24" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                Results Ranked by Relevance ({results.length})
              </h4>
            </div>
            {isSearching && (
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)' }}>Searching...</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
            {results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', border: '1px dashed var(--border-subtle)', borderRadius: '12px' }}>
                {hasActiveFilters ? 'No client profiles match this search query.' : 'Enter search terms above to search registry.'}
              </div>
            ) : (
              results.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    onClose();
                    onSelectClient(c);
                  }}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '12px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.name}</span>
                      <Badge variant="gold">{c.client_code}</Badge>
                      {c.birth_star && <Badge variant="mystic">{c.birth_star}</Badge>}
                      
                      {/* Matched fields badges */}
                      {c.matched_fields && c.matched_fields.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {c.matched_fields.map((mf: string) => (
                            <span
                              key={mf}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(52, 211, 153, 0.15)',
                                color: '#34d399',
                              }}
                            >
                              Matched {mf}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Phone size={12} /> {c.phone}</span>}
                      {c.dob && <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={12} /> DOB: {c.dob}</span>}
                      {c.rashi && <span>Rashi: {c.rashi}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {c.relevance_score ? (
                      <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                        Score: {c.relevance_score}
                      </span>
                    ) : null}
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
