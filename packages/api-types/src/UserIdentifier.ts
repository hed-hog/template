import { UserIdentifierTypeEnum } from './UserIdentifierTypeEnum';
import { User } from './User';

export type UserIdentifier = {
  id?: number;
  user_id: number;
  type: UserIdentifierTypeEnum;
  value: string;
  verified_at?: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
}