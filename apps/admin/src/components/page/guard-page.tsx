'use client';

import { Role } from '@hed-hog/api-types';
import { useApp, useQuery } from '@hed-hog/next-app-provider';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ForbiddenPage } from './forbbiden-page';
import { LoadingPage } from './loading-page';
import { LoginPage } from './login-page';

const CACHED_ROLES_KEY = 'cached-auth-roles';

const getCachedRoles = (): Role[] => {
  /* v8 ignore next 3 -- SSR guard: window is always defined under the jsdom test environment */
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CACHED_ROLES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Role[]) : [];
  } catch {
    return [];
  }
};

const setCachedRoles = (roles: Role[]) => {
  /* v8 ignore next 3 -- SSR guard: window is always defined under the jsdom test environment */
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CACHED_ROLES_KEY, JSON.stringify(roles));
  } catch {
    // Ignore storage failures.
  }
};

type GuardPage = {
  children: React.ReactNode;
};

export const GuardPage = ({ children }: GuardPage) => {
  const { request, accessToken, setUrlAfterLogin, user } = useApp();
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const forcePasswordPath = '/core/account/password';
  const requiresPasswordReset =
    (user as { requires_password_reset?: boolean } | null)
      ?.requires_password_reset === true;

  const { data, isLoading: isLoadingRoles } = useQuery<{ roles: Role[] }>({
    queryKey: ['roles', accessToken],
    queryFn: async () => {
      try {
        const response = await request<{ roles: Role[] }>({
          url: '/auth/roles',
          showErrors: false,
        });
        const roles = response.data?.roles ?? [];
        setCachedRoles(roles);
        return { roles };
      } catch (error) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return { roles: getCachedRoles() };
        }

        throw error;
      }
    },
    enabled: !!accessToken,
    retry: (failureCount, error: any) => {
      const statusCode = error?.response?.status;
      if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
        return false;
      }

      return failureCount < 1;
    },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setUrlAfterLogin(pathname);
  }, [pathname, setUrlAfterLogin]);

  useEffect(() => {
    if (!accessToken || !requiresPasswordReset) return;
    if (pathname === forcePasswordPath) return;
    router.replace(`${forcePasswordPath}?required=1`);
  }, [accessToken, requiresPasswordReset, pathname, router]);

  /* v8 ignore next 3 -- pre-hydration frame: React Testing Library's act-wrapped
     render always flushes the mount effect (setIsClient(true)) synchronously
     before assertions run, so this branch is never observable in tests. */
  if (!isClient) {
    return null;
  }

  if (!accessToken) {
    return <LoginPage />;
  }

  if (isLoadingRoles) {
    return <LoadingPage />;
  }

  if (requiresPasswordReset && pathname !== forcePasswordPath) {
    return <LoadingPage />;
  }

  const roles = data?.roles ?? [];
  const hasAdminAccess = roles.some((role) => role.slug?.startsWith('admin'));

  if (!hasAdminAccess) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
};
