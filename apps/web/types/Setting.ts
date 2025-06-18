import { SettingTypeEnum } from '../enums/SettingTypeEnum';
import { SettingGroup } from './SettingGroup';
import { SettingUser } from './SettingUser';
import { SettingLocale } from './SettingLocale';
import { SettingComponentEnum } from '@/enums/SettingComponentEnum';

export type Setting = {
  id?: number;
  group_id: number;
  slug: string;
  type?: SettingTypeEnum;
  component?: SettingComponentEnum;
  value?: string;
  user_override?: boolean;
  created_at?: string;
  updated_at?: string;
  setting_group?: SettingGroup;
  setting_user?: SettingUser[];
  setting_locale?: SettingLocale[];
  description?: string;
  name?: string;
}