import { Role } from './Role';
import { Menu } from './Menu';

export type RoleMenu = {
  id?: number;
  role_id: number;
  menu_id: number;
  created_at?: string;
  updated_at?: string;
  role?: Role;
  menu?: Menu;
}