import type { ScaffoldPlan } from '../types';
import {
  defaultValueLiteral,
  entityNames,
  formFieldJsx,
  generateTypesFile,
  scalarColumns,
  zodSchemaLine,
  type TemplateOutput,
} from './shared';

/**
 * Página de formulário único (estilo "configurações do módulo"): carrega o
 * recurso em `GET <api>` e salva com `PATCH <api>`. Não tem listagem.
 */
function buildPage(plan: ScaffoldPlan): string {
  const names = entityNames(plan);
  const columns = scalarColumns(plan);
  const hasEnum = columns.some((column) => column.type === 'enum');
  const hasBoolean = columns.some((column) => column.type === 'boolean');
  const hasTextarea = columns.some((column) => column.type === 'text');

  const defaults = columns
    .map((column) => `  ${column.name}: ${defaultValueLiteral(column)},`)
    .join('\n');

  const fromEntity = columns
    .map((column) => `        ${column.name}: data.${column.name},`)
    .join('\n');

  return [
    "'use client';",
    '',
    "import { Page, PageHeader } from '@/components/entity-list';",
    "import { Card, CardContent } from '@/components/ui/card';",
    "import {\n  Form,\n  FormControl,\n  FormField,\n  FormItem,\n  FormLabel,\n  FormMessage,\n} from '@/components/ui/form';",
    "import { FormActions } from '@/components/ui/form-actions';",
    "import { Input } from '@/components/ui/input';",
    ...(hasEnum
      ? [
          "import {\n  Select,\n  SelectContent,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n} from '@/components/ui/select';",
        ]
      : []),
    "import { Skeleton } from '@/components/ui/skeleton';",
    ...(hasBoolean ? ["import { Switch } from '@/components/ui/switch';"] : []),
    ...(hasTextarea ? ["import { Textarea } from '@/components/ui/textarea';"] : []),
    "import { useApp, useQuery } from '@hed-hog/next-app-provider';",
    "import { zodResolver } from '@hookform/resolvers/zod';",
    "import { useTranslations } from 'next-intl';",
    "import { useEffect, useState } from 'react';",
    "import { useForm } from 'react-hook-form';",
    "import { toast } from 'sonner';",
    "import { z } from 'zod';",
    `import type { ${names.pascal}, ${names.pascal}FormValues } from './_components/${names.typesModule}';`,
    '',
    'const formSchema = z.object({',
    ...columns.map(zodSchemaLine),
    '});',
    '',
    `const emptyValues: ${names.pascal}FormValues = {`,
    defaults,
    '};',
    '',
    `export default function ${names.pageComponent}() {`,
    `  const t = useTranslations('${plan.library}.${names.pascal}Page');`,
    '  const { request } = useApp();',
    '  const [isSubmitting, setIsSubmitting] = useState(false);',
    '',
    `  const { data, isLoading, refetch } = useQuery<${names.pascal} | null>({`,
    `    queryKey: ['${plan.library}-${names.kebab}-detail'],`,
    '    queryFn: async () => {',
    `      const response = await request<${names.pascal}>({`,
    `        url: '${plan.apiBasePath}',`,
    "        method: 'GET',",
    '      });',
    '',
    '      return response.data ?? null;',
    '    },',
    '  });',
    '',
    `  const form = useForm<${names.pascal}FormValues>({`,
    '    resolver: zodResolver(formSchema),',
    '    defaultValues: emptyValues,',
    '  });',
    '',
    '  useEffect(() => {',
    '    if (data) {',
    '      form.reset({',
    fromEntity,
    '      });',
    '    }',
    '  }, [data, form]);',
    '',
    `  const handleSubmit = async (values: ${names.pascal}FormValues) => {`,
    '    try {',
    '      setIsSubmitting(true);',
    '',
    '      await request({',
    `        url: '${plan.apiBasePath}',`,
    "        method: 'PATCH',",
    '        data: values,',
    '      });',
    '',
    "      toast.success(t('editSuccess'));",
    '      await refetch();',
    '    } catch {',
    "      toast.error(t('saveError'));",
    '    } finally {',
    '      setIsSubmitting(false);',
    '    }',
    '  };',
    '',
    '  return (',
    '    <Page>',
    '      <PageHeader',
    '        breadcrumbs={[',
    "          { label: t('breadcrumbHome'), href: '/' },",
    "          { label: t('title') },",
    '        ]}',
    "        title={t('title')}",
    "        description={t('description')}",
    '      />',
    '',
    '      <Card className="border-border/70">',
    '        <CardContent className="p-4">',
    '          {isLoading ? (',
    '            <div className="space-y-3">',
    '              {Array.from({ length: 4 }).map((_, index) => (',
    '                <Skeleton key={index} className="h-10 w-full" />',
    '              ))}',
    '            </div>',
    '          ) : (',
    '            <Form {...form}>',
    '              <form',
    '                onSubmit={form.handleSubmit(handleSubmit)}',
    '                className="space-y-4"',
    '              >',
    columns.map(formFieldJsx).join('\n\n'),
    '',
    '                <FormActions',
    '                  submitType="submit"',
    "                  submitLabel={isSubmitting ? t('saving') : t('save')}",
    '                  submitDisabled={isSubmitting}',
    '                />',
    '              </form>',
    '            </Form>',
    '          )}',
    '        </CardContent>',
    '      </Card>',
    '    </Page>',
    '  );',
    '}',
    '',
  ].join('\n');
}

export function renderDetailFormTemplate(plan: ScaffoldPlan): TemplateOutput {
  const names = entityNames(plan);

  return {
    page: buildPage(plan),
    components: [
      {
        relativePath: `_components/${names.typesModule}.ts`,
        contents: generateTypesFile(plan),
      },
    ],
  };
}
