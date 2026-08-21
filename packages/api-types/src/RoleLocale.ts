import { Locale } from './Locale';
import { Role } from './Role';

export type RoleLocale = {
  id?: number;
  locale_id: number;
  role_id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  role?: Role;
}