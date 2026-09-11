import React, { useState } from 'react';
import {
  Users,
  Calendar,
  UserPlus,
  Repeat,
  Clock,
  ArrowUpRight,
  Compass,
  TrendingUp,
  PieChart,
  AlertTriangle,
  Sparkles,
  Star,
  CalendarDays,
  Flame,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../core/api/client';
import { DashboardData, Client, Consultation, DashboardAnalytics } from '../../types';
import { Badge } from '../../components/Badge';

interface DashboardViewProps {
  data?: DashboardData;
  isLoading: boolean;
  onSelectClient: (client: Client) => void;
  onSelectConsultation: (consultation: Consultation) => void;
  onOpenNewClient: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Prashnam: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' },
  Porutham: { bg: 'rgba(129, 140, 248, 0.15)', text: '#a5b4fc', border: 'rgba(129, 140, 248, 0.4)' },
  Muhurtham: { bg: 'rgba(56, 189, 248, 0.15)', text: '#7dd3fc', border: 'rgba(56, 189, 248, 0.4)' },
  Pariharam: { bg: 'rgba(52, 211, 153, 0.15)', text: '#6ee7b7', border: 'rgba(52, 211, 153, 0.4)' },
  Kundali: { bg: 'rgba(244, 114, 182, 0.15)', text: '#f472b6', border: 'rgba(244, 114, 182, 0.4)' },
  Career: { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c', border: 'rgba(251, 146, 60, 0.4)' },
  Health: { bg: 'rgba(251, 113, 133, 0.15)', text: '#fda4af', border: 'rgba(251, 113, 133, 0.4)' },
  General: { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)' },
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  isLoading,
  onSelectClient,
  onSelectConsultation,
  onOpenNewClient,
}) => {
  const [chartMetric, setChartMetric] = useState<'consultations' | 'clients'>('consultations');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Fetch deep analytics from backend
  const { data: analytics, isLoading: isAnalyticsLoading } = useQuery<DashboardAnalytics>({
    queryKey: ['dashboard-analytics'],
    queryFn: () => apiRequest('/api/dashboard/analytics/'),
    staleTime: 60 * 1000,
  });

  const metrics = data?.metrics || {
    total_clients: 0,
    total_consultations: 0,
    new_clients_this_month: 0,
    consultations_this_month: 0,
    returning_clients: 0,
  };

  const statCards = [
    {
      title: 'Total Profiles',
      value: metrics.total_clients,
      icon: Users,
      color: '#f59e0b',
      sub: `${metrics.new_clients_this_month} registered this month`,
    },
    {
      title: 'Consultations Logged',
      value: metrics.total_consultations,
      icon: Calendar,
      color: '#38bdf8',
      sub: `${metrics.consultations_this_month} visits this month`,
    },
    {
      title: 'Returning Clients',
      value: metrics.returning_clients,
      icon: Repeat,
      color: '#34d399',
      sub: `${analytics?.practice_metrics?.avg_visits_per_client ?? 1.0} avg visits / client`,
    },
    {
      title: 'Pending Follow-ups',
      value: analytics?.follow_up_metrics?.upcoming ?? (data?.upcoming_follow_ups?.length || 0),
      icon: Clock,
      color: analytics?.follow_up_metrics?.overdue ? '#fb7185' : '#818cf8',
      sub: analytics?.follow_up_metrics?.overdue
        ? `${analytics.follow_up_metrics.overdue} overdue follow-up(s)`
        : 'All up-to-date',
    },
  ];

  // Active dataset for the 12-month bar chart
  const currentChartData =
    chartMetric === 'consultations'
      ? analytics?.monthly_consultations || []
      : analytics?.monthly_new_clients || [];

  const maxChartVal = Math.max(...currentChartData.map((d) => d.count), 1);
  const totalChartSum = currentChartData.reduce((acc, d) => acc + d.count, 0);
  const peakChartMonth = currentChartData.reduce(
    (max, d) => (d.count > max.count ? d : max),
    currentChartData[0] || { month: '', label: '', count: 0 }
  );

  // Peak weekday calculation
  const busiestDays = analytics?.busiest_weekdays || [];
  const peakWeekday = busiestDays.reduce(
    (max, d) => (d.count > max.count ? d : max),
    busiestDays[0] || { day_number: 1, day: 'None', short_day: 'N/A', count: 0 }
  );
  const maxWeekdayVal = Math.max(...busiestDays.map((d) => d.count), 1);

  // Category total calculation
  const categories = analytics?.category_distribution || [];
  const totalCategoryConsultations = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Welcome Banner */}
      <div
        className="glass-panel dashboard-hero-banner"
        style={{
          padding: '28px 32px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <Badge variant="gold">
              <Compass size={12} /> Jyotish Consultation Engine
            </Badge>
            <Badge variant="mystic">Practice Intelligence</Badge>
          </div>
          <h2 className="dashboard-hero-title" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>
            Astrologer Practice Overview
          </h2>
          <p className="dashboard-hero-subtitle" style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '650px' }}>
            Real-time analytics, client consultation trends, astrological distribution, and practice rhythm command center.
          </p>
        </div>

        <button onClick={onOpenNewClient} className="btn btn-primary dashboard-hero-action" style={{ padding: '10px 20px' }}>
          <UserPlus size={18} />
          Register New Client
        </button>
      </div>

      {/* Overdue Follow-ups Alert (if any) */}
      {(analytics?.follow_up_metrics?.overdue ?? 0) > 0 && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(225, 29, 72, 0.05) 100%)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(244, 63, 94, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fb7185',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#fecdd3', fontSize: '0.95rem' }}>
                {analytics!.follow_up_metrics.overdue} Overdue Consultation Follow-up
                {analytics!.follow_up_metrics.overdue > 1 ? 's' : ''} Require Attention
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(254, 205, 211, 0.75)', marginTop: '2px' }}>
                Past scheduled follow-up dates that have not been logged as completed yet.
              </div>
            </div>
          </div>
          <Badge variant="rose">Action Required</Badge>
        </div>
      )}

      {/* Primary KPI Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
        }}
      >
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="glass-panel glass-panel-hover"
              style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {card.title}
                </span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: `${card.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={18} color={card.color} />
                </div>
              </div>

              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {isLoading ? '...' : card.value}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Section: 12-Month Rolling Trend + Category Distribution */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
          gap: '20px',
        }}
      >
        {/* 12-Month Volume Trend Bar Chart */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-gold)',
                }}
              >
                <TrendingUp size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>12-Month Activity Volume</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Total {chartMetric === 'consultations' ? 'Consultations' : 'Registrations'}: {totalChartSum}
                  {peakChartMonth.count > 0 && ` • Peak: ${peakChartMonth.label} (${peakChartMonth.count})`}
                </div>
              </div>
            </div>

            {/* Metric Toggle Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setChartMetric('consultations')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: chartMetric === 'consultations' ? 'var(--accent-gold)' : 'transparent',
                  color: chartMetric === 'consultations' ? '#000' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Consultations
              </button>
              <button
                onClick={() => setChartMetric('clients')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: chartMetric === 'clients' ? 'var(--accent-emerald)' : 'transparent',
                  color: chartMetric === 'clients' ? '#000' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                New Clients
              </button>
            </div>
          </div>

          {/* Visual CSS Bar Chart */}
          <div style={{ position: 'relative', marginTop: '10px' }}>
            {isAnalyticsLoading ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Loading trend analytics...
              </div>
            ) : currentChartData.length === 0 ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No activity data recorded in the last 12 months.
              </div>
            ) : (
              <div className="mobile-scroll-chart">
                <div
                  className="mobile-scroll-chart-inner"
                  style={{
                    height: '190px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '8px',
                    paddingTop: '20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '8px',
                  }}
                >
                {currentChartData.map((item, idx) => {
                  const barHeightPct = Math.max((item.count / maxChartVal) * 100, 4); // min 4% for baseline
                  const isHovered = hoveredBarIndex === idx;
                  const barColor =
                    chartMetric === 'consultations'
                      ? 'linear-gradient(180deg, #f59e0b 0%, rgba(245, 158, 11, 0.4) 100%)'
                      : 'linear-gradient(180deg, #34d399 0%, rgba(52, 211, 153, 0.4) 100%)';
                  const glowColor =
                    chartMetric === 'consultations' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(52, 211, 153, 0.4)';

                  return (
                    <div
                      key={item.month}
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: '100%',
                        position: 'relative',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Tooltip on Hover */}
                      {isHovered && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '105%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#1e293b',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            whiteSpace: 'nowrap',
                            zIndex: 20,
                            pointerEvents: 'none',
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.label}</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.count} {chartMetric === 'consultations' ? 'visits' : 'clients'}
                          </div>
                        </div>
                      )}

                      {/* Bar Count Badge if count > 0 */}
                      {item.count > 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            marginBottom: '4px',
                            color: isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
                            transition: 'color 0.15s ease',
                          }}
                        >
                          {item.count}
                        </span>
                      )}

                      {/* Bar Fill Element */}
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '32px',
                          height: `${barHeightPct}%`,
                          background: barColor,
                          borderRadius: '4px 4px 0 0',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                          boxShadow: isHovered ? `0 0 16px ${glowColor}` : 'none',
                          opacity: hoveredBarIndex !== null && !isHovered ? 0.6 : 1,
                          filter: isHovered ? 'brightness(1.2)' : 'none',
                        }}
                      />

                      {/* Month Label */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: isHovered ? 'var(--accent-gold)' : 'var(--text-muted)',
                          marginTop: '8px',
                          transform: 'rotate(-40deg)',
                          transformOrigin: 'top left',
                          whiteSpace: 'nowrap',
                          fontWeight: isHovered ? 600 : 400,
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Consultation Categories Breakdown */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(129, 140, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-mystic)',
                }}
              >
                <PieChart size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Consultation Breakdown</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Categorization of all {totalCategoryConsultations} logged visits
                </div>
              </div>
            </div>
            <Badge variant="mystic">{categories.length} Types</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
            {isAnalyticsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                No consultation types logged yet.
              </div>
            ) : (
              categories.map((cat) => {
                const percentage = totalCategoryConsultations > 0
                  ? Math.round((cat.count / totalCategoryConsultations) * 100)
                  : 0;
                const styling = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.General;

                return (
                  <div key={cat.category} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: styling.text,
                          }}
                        />
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: styling.text }}>
                          {cat.category}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{cat.count}</strong> visits{' '}
                        <span style={{ color: 'var(--text-muted)' }}>({percentage}%)</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: '7px',
                        borderRadius: '999px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(percentage, 2)}%`,
                          height: '100%',
                          background: styling.text,
                          borderRadius: '999px',
                          transition: 'width 0.4s ease',
                          boxShadow: `0 0 10px ${styling.border}`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row: Busiest Days Heatmap + Top Nakshatras Leaderboard */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: '20px',
        }}
      >
        {/* Weekly Traffic Rhythm (Busiest Days) */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                }}
              >
                <CalendarDays size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Practice Rhythm</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Consultation frequency across days of the week
                </div>
              </div>
            </div>

            {peakWeekday.count > 0 && (
              <Badge variant="gold">
                <Flame size={12} /> Busiest: {peakWeekday.day}
              </Badge>
            )}
          </div>

          <div className="mobile-scroll-chart">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px',
                marginTop: '12px',
                minWidth: '320px',
              }}
            >
            {busiestDays.map((item) => {
              const isPeak = item.count === peakWeekday.count && item.count > 0;
              const intensity = item.count > 0 ? Math.max(item.count / maxWeekdayVal, 0.15) : 0.05;

              return (
                <div
                  key={item.day}
                  style={{
                    padding: '12px 6px',
                    borderRadius: 'var(--radius-md)',
                    background: isPeak
                      ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.08) 100%)'
                      : `rgba(56, 189, 248, ${intensity * 0.25})`,
                    border: isPeak
                      ? '1px solid rgba(245, 158, 11, 0.5)'
                      : '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isPeak && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-7px',
                        background: 'var(--accent-gold)',
                        color: '#000',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Star size={10} fill="#000" />
                    </div>
                  )}

                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isPeak ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    }}
                  >
                    {item.short_day}
                  </span>

                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      color: item.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {item.count}
                  </span>

                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>visits</span>
                </div>
              );
            })}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Follow-up Completion Rate</span>
            <strong style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
              {analytics?.follow_up_metrics?.completion_rate ?? 100}%
            </strong>
          </div>
        </div>

        {/* Top Nakshatras (Birth Stars) Leaderboard */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(244, 114, 182, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f472b6',
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Top Nakshatras</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Most frequent birth stars in client registry
                </div>
              </div>
            </div>
            <Badge variant="mystic">Astrological Distribution</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            {isAnalyticsLoading ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                Loading Nakshatras...
              </div>
            ) : (analytics?.top_nakshatras || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No client birth stars recorded yet.
              </div>
            ) : (
              (analytics?.top_nakshatras || []).slice(0, 6).map((nak, idx) => {
                const maxNakCount = analytics?.top_nakshatras[0]?.count || 1;
                const fillPct = Math.max((nak.count / maxNakCount) * 100, 8);

                return (
                  <div
                    key={nak.nakshatra}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Background Progress Fill */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${fillPct}%`,
                        background:
                          idx === 0
                            ? 'rgba(245, 158, 11, 0.1)'
                            : idx === 1
                            ? 'rgba(129, 140, 248, 0.08)'
                            : 'rgba(255, 255, 255, 0.03)',
                        pointerEvents: 'none',
                      }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 1 }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background:
                            idx === 0
                              ? 'var(--accent-gold)'
                              : idx === 1
                              ? 'rgba(148, 163, 184, 0.5)'
                              : idx === 2
                              ? 'rgba(180, 83, 9, 0.6)'
                              : 'rgba(255, 255, 255, 0.1)',
                          color: idx === 0 ? '#000' : 'var(--text-primary)',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{nak.nakshatra}</span>
                    </div>

                    <div style={{ zIndex: 1, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{nak.count}</strong> client
                      {nak.count > 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Clients & Scheduled Follow-ups */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: '20px',
        }}
      >
        {/* Recent Clients */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Recent Client Registrations</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest 5</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.recent_clients && data.recent_clients.length > 0 ? (
              data.recent_clients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => onSelectClient(client)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{client.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)' }}>
                        {client.client_code}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {client.phone || 'No phone'} {client.birth_star ? `• ${client.birth_star}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Badge variant="mystic">{client.visit_count || 0} visits</Badge>
                    <ArrowUpRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No clients registered yet.
              </div>
            )}
          </div>
        </div>

        {/* Scheduled Follow-ups */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Scheduled Follow-ups</h3>
            <Badge variant="gold">Action Items</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data?.upcoming_follow_ups && data.upcoming_follow_ups.length > 0 ? (
              data.upcoming_follow_ups.map((f) => (
                <div
                  key={f.id}
                  onClick={() => onSelectConsultation(f)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{f.client_name}</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold-light)', marginTop: '2px' }}>
                      Follow-up: {f.follow_up_date}
                    </div>
                    {f.follow_up_notes && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {f.follow_up_notes}
                      </div>
                    )}
                  </div>
                  <ArrowUpRight size={16} color="var(--text-muted)" />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                No pending follow-ups.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
