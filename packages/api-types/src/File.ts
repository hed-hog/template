import { FileProvider } from './FileProvider';
import { FileMimetype } from './FileMimetype';
import { User } from './User';

export type File = {
  id?: number;
  filename: string;
  path: string;
  provider_id: number;
  location: string;
  mimetype_id: number;
  size?: number;
  created_at?: string;
  updated_at?: string;
  file_provider?: FileProvider;
  file_mimetype?: FileMimetype;
  user?: User[];
}