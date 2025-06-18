import { DashboardComponentLocale } from './DashboardComponentLocale';
import { MultifactorLocale } from './MultifactorLocale';
import { DashboardLocale } from './DashboardLocale';
import { SettingGroupLocale } from './SettingGroupLocale';
import { RoleLocale } from './RoleLocale';
import { SettingLocale } from './SettingLocale';
import { PersonTypeLocale } from './PersonTypeLocale';
import { PersonDocumentTypeLocale } from './PersonDocumentTypeLocale';
import { PersonContactTypeLocale } from './PersonContactTypeLocale';
import { PersonAddressTypeLocale } from './PersonAddressTypeLocale';
import { PersonCustomTypeLocale } from './PersonCustomTypeLocale';
import { PersonCustomLocale } from './PersonCustomLocale';

export type Locale = {
  id?: number;
  code: string;
  region: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
  dashboard_component_locale?: DashboardComponentLocale[];
  multifactor_locale?: MultifactorLocale[];
  dashboard_locale?: DashboardLocale[];
  setting_group_locale?: SettingGroupLocale[];
  role_locale?: RoleLocale[];
  setting_locale?: SettingLocale[];
  person_type_locale?: PersonTypeLocale[];
  person_document_type_locale?: PersonDocumentTypeLocale[];
  person_contact_type_locale?: PersonContactTypeLocale[];
  person_address_type_locale?: PersonAddressTypeLocale[];
  person_custom_type_locale?: PersonCustomTypeLocale[];
  person_custom_locale?: PersonCustomLocale[];
}