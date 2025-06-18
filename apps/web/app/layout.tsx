import { QueryClientProvider } from '@/components/provider/query-client-provider';
import { SystemProvider } from '@/components/provider/system-provider';
import { ThemeProvider } from '@/components/provider/theme-provider';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type React from 'react';
import { InstallPage } from '@/components/page/install';
import { readFile, realpath } from 'fs/promises';
import ProgressProvider from '@/components/provider/progress-provider';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'] });
let systemSetting: Record<any, any> = {};

async function getSystemSetting() {
  if (Object.keys(systemSetting).length > 0) {
    return systemSetting;
  }
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/setting-system`,
    );

    return (systemSetting = Object.assign(
      {
        setting: {},
        locales: [],
      },
      res.json(),
    ));
  } catch (error) {
    return {
      setting: {},
      locales: [],
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  systemSetting = await getSystemSetting();

  return {
    title: systemSetting['setting']['system-name'] || 'HedHog',
    description:
      systemSetting['setting']['system-slogan'] || 'Administration Panel',
    generator: 'HedHog',
  };
}

type HedHogFile = {
  installed: boolean;
  developerMode: boolean;
};

export async function getHedHogFile(): Promise<HedHogFile> {
  const appRoot = process.cwd();
  const defaultOptions = {
    installed: false,
    developerMode: false,
  };
  try {
    const hedhogFilPath = await realpath(`${appRoot}/../../hedhog.json`);
    const content = await readFile(hedhogFilPath, 'utf-8');
    return { ...defaultOptions, ...JSON.parse(content) };
  } catch (err) {
    return { installed: false, developerMode: false };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  systemSetting = await getSystemSetting();
  const hedhogData = await getHedHogFile();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>{systemSetting['system-name'] || 'HedHog'}</title>
        <meta
          name="theme-color"
          content={systemSetting['theme-primary'] || '#ff6f00'}
        />
        <link rel="icon" href={systemSetting['icon-url'] || '/favicon.ico'} />
        <meta
          name="description"
          content={systemSetting['system-slogan'] || 'Administration Panel'}
        />
      </head>
      <body className={cn(inter.className, 'overflow-hidden')}>
        <ProgressProvider
          height="2px"
          color={systemSetting['theme-primary'] || '#ff6f00'}
        >
          <QueryClientProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <SystemProvider
                developerMode={hedhogData.developerMode}
                installed={hedhogData.installed}
              >
                {hedhogData.installed ? children : <InstallPage />}
              </SystemProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </ProgressProvider>
      </body>
    </html>
  );
}
