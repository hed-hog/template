import { DashboardLocale } from './DashboardLocale';
import { DashboardComponentLocale } from './DashboardComponentLocale';
import { FileProviderLocale } from './FileProviderLocale';
import { MailLocale } from './MailLocale';
import { MenuLocale } from './MenuLocale';
import { RoleLocale } from './RoleLocale';
import { ScreenLocale } from './ScreenLocale';
import { SettingLocale } from './SettingLocale';
import { SettingGroupLocale } from './SettingGroupLocale';
import { Translation } from './Translation';

export type Locale = {
  id?: number;
  name: string;
  code: string;
  region: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  dashboard_locale?: DashboardLocale[];
  dashboard_component_locale?: DashboardComponentLocale[];
  file_provider_locale?: FileProviderLocale[];
  mail_locale?: MailLocale[];
  menu_locale?: MenuLocale[];
  role_locale?: RoleLocale[];
  screen_locale?: ScreenLocale[];
  setting_locale?: SettingLocale[];
  setting_group_locale?: SettingGroupLocale[];
  translation?: Translation[];
}