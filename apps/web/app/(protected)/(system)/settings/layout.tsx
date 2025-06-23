'use client';

import { LayoutProps } from '@/.next/types/app/layout';
import { useSystem } from '@/components/provider/system-provider';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { Check, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SystemSettings } from './types';
import { SettingsProvider } from './context/settings-context';
import { SettingsTitle } from './components/settings-title';

export default function Layout({ children }: LayoutProps) {
  const { request, token } = useSystem();
  const { data: settings } = useQuery<{ data: any[] }>({
    queryKey: ['settings-group'],
    queryFn: () =>
      request({
        url: `/setting/group`,
      }),
    enabled: token !== null,
  });

  const [activeTab, setActiveTab] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(true);
  const { toast } = useToast();

  // Simular carregamento das configurações
  useEffect(() => {
    const savedSettings = localStorage.getItem('systemSettings');
    if (savedSettings) {
      // setSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Auto-save quando as configurações mudam
  useEffect(() => {
    if (hasUnsavedChanges) {
      const timeoutId = setTimeout(() => {
        handleSave();
      }, 1000); // Auto-save após 1 segundo de inatividade

      return () => clearTimeout(timeoutId);
    }
  }, [settings, hasUnsavedChanges]);

  const handleUpdateSetting = (key: keyof SystemSettings, value: any) => {
    //setSettings((prev) => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Simular salvamento
    await new Promise((resolve) => setTimeout(resolve, 500));

    localStorage.setItem('systemSettings', JSON.stringify(settings));
    setHasUnsavedChanges(false);
    setIsSaving(false);

    toast({
      title: 'Configurações salvas',
      description: 'Suas configurações foram salvas automaticamente.',
    });
  };

  return (
    <SettingsProvider>
      <div className="p-6">
        <SettingsTitle />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 ">
          {/* Sidebar de Categorias */}
          <div className="lg:col-span-1">
            <div className="border rounded-lg bg-card p-4">
              <h2 className="font-semibold mb-4">Categorias</h2>
              <nav className="space-y-2">
                {(settings?.data ?? []).map((setting) => {
                  return (
                    <Link href={`/settings/${setting.slug}`} key={setting.slug}>
                      <button
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                          activeTab === setting.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <Icon
                          icon={setting.icon}
                          className="h-4 w-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">
                            {setting.name}
                          </div>
                          {setting.description && (
                            <div className="text-xs opacity-80 truncate">
                              {setting.description}
                            </div>
                          )}
                        </div>
                      </button>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Conteúdo das Configurações */}
          <div className="lg:col-span-3">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="pr-4">{children}</div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </SettingsProvider>
  );
}
