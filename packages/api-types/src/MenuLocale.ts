import { Locale } from './Locale';
import { Menu } from './Menu';

export type MenuLocale = {
  id?: number;
  locale_id: number;
  menu_id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  menu?: Menu;
}