import { UserMfaTypeEnum } from './UserMfaTypeEnum';
import { User } from './User';
import { UserMfaChallenge } from './UserMfaChallenge';
import { UserMfaEmail } from './UserMfaEmail';
import { UserMfaPhone } from './UserMfaPhone';
import { UserMfaTotp } from './UserMfaTotp';
import { UserMfaWebauthn } from './UserMfaWebauthn';

export type UserMfa = {
  id?: number;
  user_id: number;
  type: UserMfaTypeEnum;
  name: string;
  verified_at?: string;
  suspended_until?: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  user_mfa_challenge?: UserMfaChallenge[];
  user_mfa_email?: UserMfaEmail[];
  user_mfa_phone?: UserMfaPhone[];
  user_mfa_totp?: UserMfaTotp[];
  user_mfa_webauthn?: UserMfaWebauthn[];
}