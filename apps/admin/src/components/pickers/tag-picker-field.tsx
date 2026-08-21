'use client';

import {
  TagFilterPicker,
  type TagFilterPickerProps,
  type TagPickerOption,
} from '@/components/pickers/tag-filter-picker';
import { Button } from '@/components/ui/button';
import {
  TagBadgeList,
  type TagBadgeItem,
} from '@/components/ui/tag-badge-list';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

export type TagPickerFieldProps = Omit<
  TagFilterPickerProps,
  'trigger' | 'onOptionsLoaded'
> & {
  /** Rótulo acessível do botão "+". */
  addLabel: string;
  /** Texto exibido quando nenhuma tag foi escolhida. */
  noneLabel?: string;
  /**
   * Tags já conhecidas pelo pai, com cor — tipicamente as que vieram salvas no
   * registro. Sem isto os badges só ganhariam cor depois da primeira abertura
   * do dropdown, que é a única outra fonte de cor.
   */
  knownTags?: TagBadgeItem[];
};

/**
 * Versão de formulário do {@link TagFilterPicker}: as tags escolhidas ficam
 * visíveis como badges e o gatilho vira um "+".
 *
 * O botão "Tags (N)" do picker serve a um filtro, onde o que importa é quantas
 * facetas estão ativas. Num campo de cadastro a pergunta é outra — "quais
 * são?" — e respondê-la exigia abrir o dropdown.
 */
export function TagPickerField({
  addLabel,
  noneLabel,
  knownTags,
  className,
  ...pickerProps
}: TagPickerFieldProps) {
  const { value, onChange, disabled } = pickerProps;

  // Cores vistas no catálogo enquanto o dropdown esteve aberto. Cobre as tags
  // escolhidas agora, que por definição vieram de uma busca já carregada.
  const [loadedColors, setLoadedColors] = useState<Record<string, string>>({});

  const handleOptionsLoaded = useCallback((options: TagPickerOption[]) => {
    setLoadedColors((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const option of options) {
        if (option.color && next[option.slug] !== option.color) {
          next[option.slug] = option.color;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const tags: TagBadgeItem[] = useMemo(() => {
    const colorBySlug = new Map<string, string>();
    for (const tag of knownTags ?? []) {
      if (tag.color) colorBySlug.set(tag.slug, tag.color);
    }
    for (const [slug, color] of Object.entries(loadedColors)) {
      colorBySlug.set(slug, color);
    }
    // Uma tag criada agora pelo `allowCreate` ainda não existe no catálogo:
    // fica sem cor até ser salva, e o TagBadgeList omite o ponto sozinho.
    return value.map((slug) => ({ slug, color: colorBySlug.get(slug) ?? null }));
  }, [value, knownTags, loadedColors]);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <TagBadgeList
        size="md"
        tags={tags}
        onRemove={
          disabled
            ? undefined
            : (slug) => onChange(value.filter((item) => item !== slug))
        }
      />

      {value.length === 0 && noneLabel ? (
        <span className="text-sm text-muted-foreground">{noneLabel}</span>
      ) : null}

      <TagFilterPicker
        {...pickerProps}
        onOptionsLoaded={handleOptionsLoaded}
        // Sem Tooltip aqui: o PopoverTrigger é `asChild` e clonaria o provider
        // do tooltip, que não repassa ref para elemento do DOM. `aria-label` +
        // `title` cobrem o mesmo, como no tag-selector-sheet.
        trigger={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            disabled={disabled}
            aria-label={addLabel}
            title={addLabel}
          >
            <Plus className="size-4" />
          </Button>
        }
      />
    </div>
  );
}
