import { Locale } from './Locale';
import { FileProvider } from './FileProvider';

export type FileProviderLocale = {
  id?: number;
  locale_id: number;
  file_provider_id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  file_provider?: FileProvider;
}