import { Locale } from './Locale';
import { DashboardComponent } from './DashboardComponent';

export type DashboardComponentLocale = {
  id?: number;
  locale_id: number;
  dashboard_component_id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  dashboard_component?: DashboardComponent;
}