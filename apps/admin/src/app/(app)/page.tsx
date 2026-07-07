'use client';

import { ComponentType, useEffect, useState } from 'react';

const CORE_LIBRARY_SLUG = 'core';

const PlaceholderHome = () => (
  <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
    <div className="w-full max-w-3xl rounded-xl border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">Dashboard indisponivel.</p>
    </div>
  </main>
);

export default function Page() {
  const [HomeComponent, setHomeComponent] = useState<ComponentType | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    const loadHomeComponent = async () => {
      try {
        const mod = await import(
          `@/app/(app)/(libraries)/${CORE_LIBRARY_SLUG}/dashboard/dashboard-home-tabs`
        );
        const component = mod.DashboardHomeTabs ?? mod.default;

        if (!isMounted || !component) return;
        setHomeComponent(() => component);
      } catch {
        if (!isMounted) return;
        setHomeComponent(null);
      }
    };

    void loadHomeComponent();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!HomeComponent) {
    return <PlaceholderHome />;
  }

  return <HomeComponent />;
}
