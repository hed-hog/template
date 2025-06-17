'use client';

import PasswordField from '@/components/field/password-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconSettingsUp } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSystem } from '../provider/system-provider';
import { useRouter } from 'next/navigation';
import { IconFormField } from '../field/icon-field';
import { ImageFormField } from '../field/image-uploader-field';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    __colorInput?: HTMLInputElement | null;
  }
}

export const COLOR_OPTIONS = [
  { value: 'blue', label: 'Azul', color: 'bg-blue-500' },
  { value: 'green', label: 'Verde', color: 'bg-green-500' },
  { value: 'purple', label: 'Roxo', color: 'bg-purple-500' },
  { value: 'red', label: 'Vermelho', color: 'bg-red-500' },
  { value: 'amber', label: 'Amber', color: 'bg-amber-500' },
];

const FormSchema = z.object({
  appName: z.string().min(1, 'O nome da aplicação é obrigatório.'),
  primaryColor: z.string().regex(/^#([0-9A-F]{3}){1,2}$/i, 'Cor inválida.'),
  rootEmail: z.string().email('E-mail inválido.'),
  rootPassword: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  logoIcon: z.string().optional(),
  logoFull: z.string().optional(),
});

export const InstallPage = () => {
  const router = useRouter();
  const colorRef = useRef<HTMLInputElement>(null);
  const { request } = useSystem();
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      appName: 'HedHog',
      primaryColor: '#FF760C',
      rootEmail: 'root@hedhog.com',
      rootPassword: 'changeme',
      logoIcon: '',
      logoFull: '',
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    request({
      url: '/install',
      method: 'POST',
      data,
    })
      .then(() => {
        //window.location.reload();
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
                    <div className="flex gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            colorRef.current?.click();
                          }}
                          style={{
                            backgroundColor: form.watch('primaryColor'),
                          }}
                          className={cn(
                            `w-8 h-8 rounded-full border-2 transition-all`,
                            COLOR_OPTIONS.map((v) => v.color).includes(
                              form.watch('primaryColor'),
                            )
                              ? 'border-foreground scale-110'
                              : 'border-muted-foreground/30 hover:scale-105',
                          )}
                          title="Escolher outra cor"
                        />
                        <input
                          type="color"
                          style={{ visibility: 'hidden', height: 0, width: 0 }}
                          ref={colorRef}
                          value={form.watch('primaryColor')}
                          onChange={(e) => {
                            console.log('Color changed:', e.target.value);
                            form.setValue('primaryColor', e.target.value);
                          }}
                          tabIndex={-1}
                        />
                      </div>
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => {
                            form.setValue('primaryColor', color.value);
                          }}
                          className={cn(
                            'w-8 h-8 rounded-full border-2 transition-all',
                            color.color,
                            form.watch('primaryColor') === color.value
                              ? 'border-foreground scale-110'
                              : 'border-muted-foreground/30 hover:scale-105',
                          )}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <IconFormField
                      control={form.control}
                      name="logoIcon"
                      label="Ícone do Logo"
                      description="Imagem quadrada para o ícone do logo (recomendado 128x128px)"
                      size={64}
                      accept="image/png"
                      helperText="Imagem PNG com fundo transparente é recomendada."
                    />
                  </div>

                  <div className="space-y-2">
                    <ImageFormField
                      control={form.control}
                      name="logoFull"
                      label="Logo Horizontal"
                      description="Imagem para o logo horizontal (recomendado 512x128px)"
                      width={256}
                      height={64}
                      accept="image/png"
                      helperText="Imagem PNG com fundo transparente é recomendada."
                    />
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
