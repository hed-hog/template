import { User } from './User';

export type UserRecoveryCode = {
  id?: number;
  user_id: number;
  hash: string;
  used_at?: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}