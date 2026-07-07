import { User } from './User';

export type UserSession = {
  id?: number;
  user_id: number;
  hash: string;
  ip_address: string;
  location: {
    city: string;
    country: string;
  };
  user_agent: string;
  revoked_at?: string;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}