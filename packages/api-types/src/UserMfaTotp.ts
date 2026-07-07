import { UserMfa } from './UserMfa';

export type UserMfaTotp = {
  id?: number;
  user_mfa_id: number;
  secret: any;
  created_at?: string;
  updated_at?: string;
  user_mfa?: UserMfa;
}