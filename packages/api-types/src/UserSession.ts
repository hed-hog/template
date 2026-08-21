import { User } from './User';

export type UserSession = {
  id?: number;
  user_id: number;
  hash: string;
  ip_address: string;
  location: {
    city: string;
    country: string;
  };
  user_agent: string;
  revoked_at?: string;
  expires_at: string;
  created_at?: string;
  updated_at?: string;
  user?: User;
  /**
   * Preenchido quando a sessao e um acesso simulado. Nao ha relacao Prisma para
   * `impersonator` (a coluna e INT puro, sem FK, para nao renomear
   * `user.user_session`), entao o backend anexa o nome por consulta separada.
   */
  impersonator_user_id?: number | null;
  impersonation_reason?: string | null;
  impersonator?: { id: number; name: string } | null;
}