import { UserMfa } from './UserMfa';

export type UserMfaChallenge = {
  id?: number;
  user_mfa_id: number;
  hash: string;
  expires_at: string;
  verified_at?: string;
  attempts?: number;
  created_at?: string;
  updated_at?: string;
  user_mfa?: UserMfa;
}