import { Dashboard } from './Dashboard';
import { User } from './User';

export type DashboardUser = {
  id?: number;
  dashboard_id: number;
  user_id: number;
  created_at?: string;
  updated_at?: string;
  dashboard?: Dashboard;
  user?: User;
}