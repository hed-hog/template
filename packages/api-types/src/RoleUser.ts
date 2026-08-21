import { Role } from './Role';
import { User } from './User';

export type RoleUser = {
  id?: number;
  role_id: number;
  user_id: number;
  created_at?: string;
  updated_at?: string;
  role?: Role;
  user?: User;
}