import { UserCredentialTypeEnum } from './UserCredentialTypeEnum';
import { User } from './User';

export type UserCredential = {
  id?: number;
  user_id: number;
  type: UserCredentialTypeEnum;
  hash: string;
  revoked_at?: string;
  expires_at?: string;
  requires_reset?: boolean;
  created_at?: string;
  updated_at?: string;
  user?: User;
}