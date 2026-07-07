import { SettingComponentEnum } from './SettingComponentEnum';
import { SettingGroup } from './SettingGroup';
import { SettingList } from './SettingList';
import { SettingLocale } from './SettingLocale';
import { SettingSubgroup } from './SettingSubgroup';
import { SettingTypeEnum } from './SettingTypeEnum';
import { SettingUser } from './SettingUser';

export type Setting = {
  id?: number;
  group_id: number;
  subgroupId?: number | null;
  slug: string;
  type?: SettingTypeEnum;
  component?: SettingComponentEnum;
  value?: string;
  user_override?: boolean;
  created_at?: string;
  updated_at?: string;
  setting_group?: SettingGroup;
  setting_subgroup?: SettingSubgroup | null;
  setting_locale?: SettingLocale[];
  setting_list?: SettingList[];
  setting_user?: SettingUser[];
  description?: string;
  name?: string;
}