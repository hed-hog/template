import { UserMfa } from './UserMfa';

export type UserMfaWebauthn = {
  id?: number;
  user_mfa_id: number;
  credential_id: any;
  public_key: any;
  sign_count: number;
  last_used_at?: string;
  created_at?: string;
  updated_at?: string;
  user_mfa?: UserMfa;
}