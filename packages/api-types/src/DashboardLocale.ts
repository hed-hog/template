import { Locale } from './Locale';
import { Dashboard } from './Dashboard';

export type DashboardLocale = {
  id?: number;
  locale_id: number;
  dashboard_id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  dashboard?: Dashboard;
}