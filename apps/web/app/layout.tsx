import { QueryClientProvider } from '@/components/provider/query-client-provider';
import { SystemProvider } from '@/components/provider/system-provider';
import { ThemeProvider } from '@/components/provider/theme-provider';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type React from 'react';
import { InstallPage } from '@/components/page/install';
import { readFile, realpath } from 'fs/promises';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
let systemSetting: Record<any, any> = {};

async function getSystemSetting() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/setting-system`,
    );
    return Object.assign(
      {
        setting: {},
        locales: [],
      },
      res.json(),
    );
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

export async function getHedHogFile() {
  // Obtém o diretório raiz da aplicação Next.js
  const appRoot = process.cwd();
  try {
    const hedhogFilPath = await realpath(`${appRoot}/../../hedhog.json`);
    const content = await readFile(hedhogFilPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { installed: false };
  }
}

const developerMode = String(process.env.DEVELOPER_MODE) === 'true';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hedhogData = await getHedHogFile();

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>{systemSetting['system-name'] || 'HedHog'}</title>
        <meta
          name="theme-color"
          content={systemSetting['theme-primary'] || '26 100% 50%'}
        />
        <link rel="icon" href={systemSetting['icon-url'] || '/favicon.ico'} />
        <meta
          name="description"
          content={systemSetting['system-slogan'] || 'Administration Panel'}
        />
      </head>
      <body className={inter.className}>
        <QueryClientProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <SystemProvider
              developerMode={developerMode}
              installed={hedhogData.installed}
            >
              {hedhogData.installed ? children : <InstallPage />}
            </SystemProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
