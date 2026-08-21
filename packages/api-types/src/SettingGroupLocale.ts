import { Locale } from './Locale';
import { SettingGroup } from './SettingGroup';

export type SettingGroupLocale = {
  id?: number;
  locale_id: number;
  setting_group_id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  setting_group?: SettingGroup;
}