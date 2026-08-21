import { User } from './User';

export type UserActivity = {
  id?: number;
  user_id: number;
  action: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  /** Quem provocou a atividade, quando nao foi o proprio usuario. */
  actor_user_id?: number | null;
  actor?: { id: number; name: string } | null;
}