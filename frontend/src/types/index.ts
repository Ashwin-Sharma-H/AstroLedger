export interface User {
  id: number;
  name: string;
  email: string;
  title?: string;
  phone?: string;
  bio?: string;
  timezone?: string;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  client_code: string;
  name: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  gender?: string;
  address?: string;
  dob?: string;
  birth_time?: string;
  birth_place?: string;
  birth_star?: string; // Nakshatra
  rashi?: string;
  notes?: string;
  extra_attributes?: Record<string, any>;
  version: number;
  is_deleted: boolean;
  visit_count: number;
  first_consultation_date?: string | null;
  last_consultation_date?: string | null;
  matched_fields?: string[];
  relevance_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  client: string; // client uuid
  client_name?: string;
  client_code?: string;
  consultation_date: string;
  consultation_time?: string | null;
  consultation_type: string;
  reason?: string;
  discussion?: string;
  summary?: string;
  advice?: string;
  follow_up_required: boolean;
  follow_up_date?: string | null;
  follow_up_notes?: string;
  follow_up_completed: boolean;
  version: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardMetrics {
  total_clients: number;
  total_consultations: number;
  new_clients_this_month: number;
  consultations_this_month: number;
  returning_clients: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recent_clients: Client[];
  recent_consultations: Consultation[];
  upcoming_follow_ups: Consultation[];
  sync_status: 'synced' | 'syncing' | 'offline';
}

export interface MonthlyMetric {
  month: string;
  label: string;
  count: number;
}

export interface CategoryMetric {
  category: string;
  count: number;
}

export interface WeekdayMetric {
  day_number: number;
  day: string;
  short_day: string;
  count: number;
}

export interface NakshatraMetric {
  nakshatra: string;
  count: number;
}

export interface FollowUpMetrics {
  overdue: number;
  upcoming: number;
  completed: number;
  completion_rate: number;
}

export interface PracticeMetrics {
  total_clients: number;
  total_consultations: number;
  avg_visits_per_client: number;
}

export interface DashboardAnalytics {
  monthly_consultations: MonthlyMetric[];
  monthly_new_clients: MonthlyMetric[];
  category_distribution: CategoryMetric[];
  busiest_weekdays: WeekdayMetric[];
  top_nakshatras: NakshatraMetric[];
  follow_up_metrics: FollowUpMetrics;
  practice_metrics: PracticeMetrics;
}


export interface ChangeEvent {
  id: string;
  device_id: string;
  entity_type: 'client' | 'consultation';
  entity_id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  version: number;
  idempotency_key: string;
  payload: any;
  timestamp?: string;
}
