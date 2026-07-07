import { User } from './User';

export type UserActivity = {
  id?: number;
  user_id: number;
  action: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}