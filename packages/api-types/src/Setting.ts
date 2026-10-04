import { SettingComponentEnum } from './SettingComponentEnum';
import { SettingGroup } from './SettingGroup';
import { SettingList } from './SettingList';
import { SettingLocale } from './SettingLocale';
import { SettingSubgroup } from './SettingSubgroup';
import { SettingTypeEnum } from './SettingTypeEnum';
import { SettingUser } from './SettingUser';

/**
 * Filtro do `entity-picker` de uma setting: restringe quais registros a tela
 * pode escolher. Hoje só perfil de integração (`integration_profile`).
 *
 * As chaves são camelCase porque viajam cruas na query string de
 * `GET /integration-profile`; `excludeProviders` não existe na API e é
 * aplicado no cliente.
 */
export type SettingEntityFilter = {
  typeSlug?: string;
  providerSlug?: string;
  excludeProviders?: string[];
};

export type Setting = {
  id?: number;
  group_id: number;
  subgroupId?: number | null;
  slug: string;
  type?: SettingTypeEnum;
  component?: SettingComponentEnum;
  value?: string;
  /**
   * Coluna `jsonb`, declarada no `setting_group.yaml` da biblioteca dona da
   * setting. O union com `string` cobre instalação cuja coluna seja texto —
   * quem lê usa o parser defensivo do `setting-field`.
   */
  entity_filter?: SettingEntityFilter | string | null;
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