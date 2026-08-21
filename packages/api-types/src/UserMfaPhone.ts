import { UserMfa } from './UserMfa';

export type UserMfaPhone = {
  id?: number;
  user_mfa_id: number;
  phone: string;
  created_at?: string;
  updated_at?: string;
  user_mfa?: UserMfa;
}