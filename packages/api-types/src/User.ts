import { DashboardUser } from './DashboardUser';
import { File } from './File';
import { RoleUser } from './RoleUser';
import { SettingUser } from './SettingUser';
import { UserAccount } from './UserAccount';
import { UserActivity } from './UserActivity';
import { UserCredential } from './UserCredential';
import { UserIdentifier } from './UserIdentifier';
import { UserMfa } from './UserMfa';
import { UserRecoveryCode } from './UserRecoveryCode';
import { UserSession } from './UserSession';

export type User = {
  id?: number;
  name: string;
  photo_id?: number;
  suspended_until?: string;
  suspended_reason?: string;
  deactivated_at?: string;
  requires_password_reset?: boolean;
  created_at?: string;
  updated_at?: string;
  file?: File;
  dashboard_user?: DashboardUser[];
  role_user?: RoleUser[];
  setting_user?: SettingUser[];
  user_account?: UserAccount[];
  user_activity?: UserActivity[];
  user_credential?: UserCredential[];
  user_identifier?: UserIdentifier[];
  user_mfa?: UserMfa[];
  user_recovery_code?: UserRecoveryCode[];
  user_session?: UserSession[];
}