import { UserAccountProviderEnum } from './UserAccountProviderEnum';
import { User } from './User';

export type UserAccount = {
  id?: number;
  user_id: number;
  provider: UserAccountProviderEnum;
  provider_user_id: string;
  email?: string;
  scopes?: string;
  refresh_token?: any;
  token_expires_at?: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}