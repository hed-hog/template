import { UserMfa } from './UserMfa';

export type UserMfaEmail = {
  id?: number;
  user_mfa_id: number;
  email: string;
  created_at?: string;
  updated_at?: string;
  user_mfa?: UserMfa;
}