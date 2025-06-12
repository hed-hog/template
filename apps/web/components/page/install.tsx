'use client';

import PasswordField from '@/components/field/password-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconSettingsUp } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSystem } from '../provider/system-provider';
import { useRouter } from 'next/navigation';

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en-US', label: 'Inglês (EUA)' },
  { value: 'es-ES', label: 'Espanhol (Espanha)' },
  { value: 'fr-FR', label: 'Francês (França)' },
  { value: 'de-DE', label: 'Alemão (Alemanha)' },
] as const;

const FormSchema = z.object({
  appName: z.string().min(1, 'O nome da aplicação é obrigatório.'),
  primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Cor inválida.'),
  language: z
    .array(z.enum(LANGUAGES.map((l) => l.value) as [string, ...string[]]))
    .optional(),
  rootEmail: z.string().email('E-mail inválido.'),
  rootPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
});

export const InstallPage = () => {
  const router = useRouter();
  const { request } = useSystem();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      appName: 'Hcode',
      primaryColor: '#FF760C',
      language: ['pt-BR', 'en-US'],
      rootEmail: 'joao@hcode.com.br',
      rootPassword: '35qg,4)XZ,NX',
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const formData = new FormData();
    formData.append('appName', data.appName);
    formData.append('primaryColor', data.primaryColor);

    data.language?.forEach((lang) => formData.append('language', lang));

    formData.append('rootEmail', data.rootEmail);
    formData.append('rootPassword', data.rootPassword);

    form.clearErrors();

    request({
      url: '/install',
      method: 'POST',
      data: formData,
    })
      .then(() => {
        process.env.INSTALLED = 'true';
        window.location.reload();
      })
      .catch((error) => {
        form.setError('root', {
          type: 'manual',
          message:
            error?.response?.data?.message || 'Erro ao configurar o sistema',
        });
      });
  }

  useEffect(() => {
    if (Object.keys(form.formState.errors).length) {
      // Log errors only if present
      console.log(form.formState.errors);
    }
  }, [form.formState.errors]);

  return (
    <div className="relative min-w-[360px] min-h-screen bg-gradient-to-br from-gray-900 via-gray-700 to-gray-900 text-foreground flex items-center justify-center p-6">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 justify-start">
          <div className="text-center md:text-left">
            <div className="md:fixed md:top-0 md:left-0 mt-4 md:h-full md:w-1/2 flex items-center justify-center md:justify-start">
              <div className="px-4 pr-10">
                <img
                  src="/logo.svg"
                  alt="HedHog Logo"
                  className="w-full md:w-32 h-16 mb-4"
                />
                <h1 className="text-4xl font-bold text-white mb-4 text-shadow-lg">
                  Bem-vindo ao HedHog!
                </h1>
                <p className="text-lg text-white/90 text-shadow-lg">
                  Configure os primeiros detalhes do seu sistema para começar.
                </p>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="w-full space-y-6"
            >
              <Card className="w-full shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">
                    Configuração Inicial
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Preencha as informações abaixo para continuar.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Nome da Aplicação</Label>
                    <Input
                      id="appName"
                      placeholder="Ex: HedHog Class"
                      {...form.register('appName')}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Cor Primária</Label>
                    <Input
                      id="primaryColor"
                      type="color"
                      {...form.register('primaryColor')}
                      className="h-10 w-24 p-0 border-none bg-transparent"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logoIcon">
                      Ícone do Logo{' '}
                      <span className="text-gray-500">
                        (SVG ou PNG de 512x512 recomendado)
                      </span>
                    </Label>
                    <Input
                      id="logoIcon"
                      type="file"
                      accept="image/png,image/svg+xml"
                      {...form.register('logoIcon')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="logoFull">
                      Logotipo Completo{' '}
                      <span className="text-gray-500">
                        (SVG ou PNG de 1280x512 recomendado)
                      </span>
                    </Label>
                    <Input
                      id="logoFull"
                      type="file"
                      accept="image/png,image/svg+xml"
                      {...form.register('logoFull')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Idioma do Sistema</Label>
                    <div className="space-y-1">
                      {LANGUAGES.map(({ value, label }) => (
                        <div
                          className="flex items-center space-x-2"
                          key={value}
                        >
                          <Checkbox
                            id={`language-${value}`}
                            value={value}
                            {...form.register('language')}
                            defaultChecked={form
                              .getValues('language')
                              ?.includes(value)}
                          />
                          <Label
                            htmlFor={`language-${value}`}
                            className="text-sm"
                          >
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">
                      Usuário Root
                    </Label>
                    <div className="space-y-2">
                      <Label htmlFor="rootEmail">E-mail</Label>
                      <Input
                        id="rootEmail"
                        type="email"
                        placeholder="exemplo@dominio.com"
                        required
                        {...form.register('rootEmail')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootPassword">Senha</Label>
                      <PasswordField
                        id="rootPassword"
                        placeholder="Digite uma senha segura"
                        required
                        {...form.register('rootPassword')}
                      />
                    </div>
                  </div>

                  {form.formState.errors.root && (
                    <div className="mb-4 rounded bg-red-100 p-2">
                      <p className="text-sm text-red-600">
                        {form.formState.errors.root.message}
                      </p>
                    </div>
                  )}

                  <Button type="submit" className="w-full mt-4 flex gap-2">
                    <IconSettingsUp className="h-4 w-4" /> Configurar HedHog
                  </Button>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
};
