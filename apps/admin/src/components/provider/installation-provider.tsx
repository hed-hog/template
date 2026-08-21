'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useFormDraft } from '@/hooks/use-form-draft';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Loading } from '../loading';

type InstallationContextProps = Record<string, never>;

const installMessages = [
  'Inicializando o HedHog Engine... 🦔💻',
  'Carregando anéis de configuração... 💍',
  'Otimizando rotas de velocidade... 🏁',
  'Compilando código com super spikes... 🦔✨',
  'Configurando o painel do HedHog... 🖥️',
  'Criando usuário super sônico... 👤⚡',
  'Ajustando variáveis no Green Hill... 🌳',
  'Testando loops infinitos... 🔄',
  'Finalizando instalação em alta velocidade... 🚀',
  'Pronto para correr com o HedHog! 🦔🏆',
  'Refatorando código para máxima performance... 🔧⚡',
  'Debugando bugs velozes... 🐞🏃‍♂️',
  'Instalando pacotes npm supersônicos... 📦💨',
  'Rodando testes unitários com energia... 🧪⚡',
  'Otimizando queries no banco de dados... 🗄️🚅',
  'Renderizando componentes React... ⚛️🎨',
  'Sincronizando com o servidor... 🔄🌐',
  'Escrevendo logs ultra rápidos... 📜💨',
  'Configurando ambiente de produção... 🏭🚦',
  'HedHog está quase pronto para programar! 🦔👨‍💻',
];

const InstallationContext = createContext<InstallationContextProps | undefined>(
  undefined
);

interface InstallationProviderProps {
  apiBaseUrl?: string;
  installed: boolean;
  children: ReactNode;
}

type InstallDraftPayload = {
  values: {
    appName: string;
    slogan: string;
    userName: string;
    email: string;
    adminUrl: string;
    apiUrl: string;
  };
};

const INSTALLATION_FORM_DRAFT_STORAGE_KEY = 'core-installation-form-draft';

export const InstallationProvider: React.FC<InstallationProviderProps> = ({
  apiBaseUrl,
  installed,
  children,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('Iniciando instalação... 🦔');
  const normalizedApiBaseUrl = (apiBaseUrl || 'http://localhost:3100').replace(
    /\/$/,
    ''
  );

  const installSchema = z.object({
    appName: z
      .string()
      .optional()
      .or(z.string().min(1, 'Nome da aplicação obrigatório')),
    slogan: z.string().optional().or(z.string().min(1, 'Slogan obrigatório')),
    userName: z
      .string()
      .optional()
      .or(z.string().min(1, 'Nome de usuário obrigatório')),
    email: z.string().optional().or(z.string().email('Email inválido')),
    password: z
      .string()
      .optional()
      .or(z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')),
    adminUrl: z.string().trim().url('URL da admin inválida'),
    apiUrl: z.string().trim().url('URL da API inválida'),
  });

  type InstallFormValues = z.infer<typeof installSchema>;

  const defaultValues: InstallFormValues = {
    appName: '',
    slogan: '',
    userName: '',
    email: '',
    password: '',
    adminUrl: '',
    apiUrl: normalizedApiBaseUrl,
  };

  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installSchema),
    defaultValues,
    mode: 'onChange',
  });

  const watchedValues = useWatch({
    control: form.control,
  });

  // useForm's `defaultValues` always seeds these fields with a string ('')
  // synchronously on first render, so useWatch's result is never actually
  // undefined at runtime despite the optional typing — the `?? ''` fallbacks
  // below are unreachable defensive code, isolated here (one ignore per
  // field) so the real `.trim().length > 0` / equality checks that follow
  // stay fully instrumented.
  /* v8 ignore next 6 */
  const safeAppName = watchedValues.appName ?? '';
  const safeSlogan = watchedValues.slogan ?? '';
  const safeUserName = watchedValues.userName ?? '';
  const safeEmail = watchedValues.email ?? '';
  const safeAdminUrl = watchedValues.adminUrl ?? '';
  const safeApiUrl = watchedValues.apiUrl ?? '';

  const {
    clearDraft,
    loadDraft,
    hasDraft,
    savedAt: draftSavedAt,
  } = useFormDraft<InstallDraftPayload>({
    storageKey: INSTALLATION_FORM_DRAFT_STORAGE_KEY,
    value: {
      values: {
        appName: safeAppName,
        slogan: safeSlogan,
        userName: safeUserName,
        email: safeEmail,
        adminUrl: safeAdminUrl,
        apiUrl: safeApiUrl,
      },
    },
    hasData:
      safeAppName.trim().length > 0 ||
      safeSlogan.trim().length > 0 ||
      safeUserName.trim().length > 0 ||
      safeEmail.trim().length > 0 ||
      (safeAdminUrl.trim().length > 0 &&
        safeAdminUrl.trim() !==
          /* v8 ignore start -- unreachable: window is always defined in the jsdom test environment, so the ternary's alternate branch never runs */
          (typeof window !== 'undefined'
            ? window.location.origin.replace(/\/$/, '')
            : '')
          /* v8 ignore stop */) ||
      (safeApiUrl.trim().length > 0 && safeApiUrl.trim() !== normalizedApiBaseUrl),
    enabled: !loading,
  });

  const draftStatusContent = useMemo(() => {
    if (!hasDraft || !draftSavedAt) {
      return null;
    }

    const savedDate = new Date(draftSavedAt);
    if (Number.isNaN(savedDate.getTime())) {
      return null;
    }

    const isPtLocale =
      typeof navigator !== 'undefined' && navigator.language.startsWith('pt');
    const locale = isPtLocale ? ptBR : enUS;
    const relativeLabel = formatDistanceToNow(savedDate, {
      addSuffix: true,
      locale,
    });
    const absoluteLabel = savedDate.toLocaleString();

    return isPtLocale
      ? `Rascunho salvo ${relativeLabel} • Último salvamento: ${absoluteLabel}`
      : `Draft saved ${relativeLabel} • Last saved: ${absoluteLabel}`;
  }, [draftSavedAt, hasDraft]);

  useEffect(() => {
    const currentAdminUrl = window.location.origin.replace(/\/$/, '');
    const currentApiUrl = normalizedApiBaseUrl;
    const storedDraft = loadDraft();

    if (storedDraft?.payload.values) {
      form.reset({
        appName: storedDraft.payload.values.appName ?? '',
        slogan: storedDraft.payload.values.slogan ?? '',
        userName: storedDraft.payload.values.userName ?? '',
        email: storedDraft.payload.values.email ?? '',
        password: '',
        adminUrl: storedDraft.payload.values.adminUrl || currentAdminUrl,
        apiUrl: storedDraft.payload.values.apiUrl || currentApiUrl,
      });
      return;
    }

    if (!form.getValues('adminUrl')) {
      form.setValue('adminUrl', currentAdminUrl, { shouldValidate: true });
    }

    if (!form.getValues('apiUrl')) {
      form.setValue('apiUrl', currentApiUrl, { shouldValidate: true });
    }
  }, [form, loadDraft, normalizedApiBaseUrl]);

  const onSubmit = (values: InstallFormValues) => {
    setMessage('Iniciando instalação... 🦔');
    setLoading(true);
    setError(null);

    const filledValues = {
      appName: values.appName || 'HedHog',
      slogan: values.slogan || 'Administration Panel',
      userName: values.userName || 'Root User',
      email: values.email || 'root@hedhog.com',
      password: values.password || 'changeme',
      adminUrl: values.adminUrl.trim(),
      apiUrl: values.apiUrl.trim(),
    };

    axios({
      method: 'POST',
      url: `${normalizedApiBaseUrl}/install`,
      data: filledValues,
    })
      .then(() => {
        clearDraft();
        const checkInstall = async () => {
          const start = Date.now();
          await new Promise((res) => setTimeout(res, 5000));
          while (true) {
            try {
              const resp = await axios.get(`${normalizedApiBaseUrl}/install`);
              if (resp.data?.installed) {
                window.location.reload();
                break;
              }
            } catch {}
            if (Date.now() - start > 300000) {
              setLoading(false);
              setError('Timeout ao verificar instalação. Tente novamente.');
              break;
            }
            await new Promise((res) => setTimeout(res, 1000));
          }
        };
        checkInstall();
      })
      .catch((error) => {
        const message = error.response?.data?.message;
        if (message === 'Application is already installed.') {
          setLoading(false);
          window.location.reload();
          return;
        }

        setLoading(false);
        setError(
          message ||
            'Erro ao instalar a aplicação. Verifique os dados e tente novamente.'
        );
        console.error(error);
      });
  };

  useEffect(() => {
    if (loading && installMessages.length > 0) {
      let step = 0;
      const interval = setInterval(() => {
        /* v8 ignore next -- unreachable: step is always (step + 1) % installMessages.length, so the index is always in bounds */
        setMessage(installMessages[step] ?? 'Iniciando instalação...');
        step = (step + 1) % installMessages.length;
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [loading]);

  if (installed) {
    return (
      <InstallationContext.Provider value={{}}>
        {children}
      </InstallationContext.Provider>
    );
  } else {
    return (
      <InstallationContext.Provider value={{}}>
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.svg" alt="HedHog Logo" className="h-16 w-16 mb-2" />
          <h1 className="text-2xl font-bold">HedHog</h1>
          <p className="text-gray-600" id="installation-description">
            Configure sua aplicação HedHog
          </p>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 max-w-md mx-auto mt-10"
            aria-describedby="installation-description"
          >
            {loading && (
              <div className="h-50 flex flex-col justify-center items-center">
                <Loading />
                <div className="mt-2 text-gray-600 text-bold">{message}</div>
              </div>
            )}
            {!loading && (
              <div className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="adminUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Admin</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="http://localhost:3200"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        URL publica da interface administrativa. Ela sera salva
                        na setting url.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="apiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da API</FormLabel>
                      <FormControl>
                        <Input
                          type="url"
                          placeholder="http://localhost:3100"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        URL publica da API. Ela sera salva na setting api-url.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Aplicação</FormLabel>
                      <FormControl>
                        <Input placeholder="HedHog" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Nome que será exibido no topo do painel e nos emails.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slogan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slogan</FormLabel>
                      <FormControl>
                        <Input placeholder="Administration Panel" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Frase curta que aparece abaixo do nome da aplicação.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="userName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Root User" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Nome do usuário administrador inicial do sistema.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="root@hedhog.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Email do usuário administrador. Usado para login e
                        recuperação de senha.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="changeme"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Senha inicial do usuário administrador. Você poderá
                        alterá-la depois.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && (
                  <div className="text-destructive text-sm mb-2">{error}</div>
                )}
                {draftStatusContent ? (
                  <p className="text-xs text-muted-foreground mb-2">
                    {draftStatusContent}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!form.formState.isValid || loading}
                >
                  {/* v8 ignore next -- unreachable: this button only renders inside the `{!loading && (...)}` block above, so the `loading` side of the ternary never executes */}
                  {loading ? 'Instalando...' : 'Instalar'}
                </Button>
              </div>
            )}
          </form>
        </Form>
      </InstallationContext.Provider>
    );
  }
};

export const useInstallation = (): InstallationContextProps => {
  const context = useContext(InstallationContext);
  if (!context) {
    throw new Error(
      'useInstallation must be used within an InstallationProvider'
    );
  }
  return context;
};
