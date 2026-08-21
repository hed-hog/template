import { Locale } from './Locale';
import { Screen } from './Screen';

export type ScreenLocale = {
  id?: number;
  locale_id: number;
  screen_id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  screen?: Screen;
}