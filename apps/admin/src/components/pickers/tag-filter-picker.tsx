'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Check, Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type TagPickerOption = {
  slug: string;
  color?: string | null;
  usageCount?: number;
};

export type TagFilterPickerProps = {
  // Slugs — é a única identidade que as tags catalogadas e as livres (gravadas
  // pelo formulário de pessoa em person_metadata) compartilham.
  value: string[];
  onChange: (next: string[]) => void;
  loadOptions: (args: { search: string }) => Promise<TagPickerOption[]>;
  label: string;
  searchPlaceholder: string;
  emptyLabel: string;
  loadingLabel: string;
  clearLabel: string;
  disabled?: boolean;
  className?: string;
  // Quando o termo digitado não existe no catálogo, oferece adicioná-lo como
  // tag nova. Para edição de cadastro, onde a tag ainda não existe até alguém
  // usá-la pela primeira vez; um filtro não tem o que fazer com isso.
  allowCreate?: boolean;
  createLabel?: (term: string) => string;
  // Substitui o botão "Tags (N)" por outro gatilho. Para campos de formulário,
  // onde as escolhidas já aparecem como badges ao lado e o gatilho vira só um
  // "+"; um filtro precisa do rótulo e do contador no próprio botão.
  trigger?: ReactNode;
  // Espia o catálogo recém-buscado. Serve a quem desenha as selecionadas fora
  // do popover e precisa da cor de cada tag, que só o catálogo conhece.
  onOptionsLoaded?: (options: TagPickerOption[]) => void;
};

/**
 * Faceta "tem alguma destas tags" com busca no servidor. Substitui o
 * {@link ./tag-filter-popover} nas telas onde o catálogo é grande demais para
 * caber numa lista fixa: abre sugerindo as mais usadas e digitar busca o resto.
 *
 * Ao contrário do popover antigo, este nunca se esconde por falta de opções —
 * sumir era o que fazia o filtro parecer inexistente numa base sem tags
 * catalogadas.
 */
export function TagFilterPicker({
  value,
  onChange,
  loadOptions,
  label,
  searchPlaceholder,
  emptyLabel,
  loadingLabel,
  clearLabel,
  disabled,
  className,
  allowCreate = false,
  createLabel,
  trigger,
  onOptionsLoaded,
}: TagFilterPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<TagPickerOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedSearch = useDebounce(search);
  // Descarta respostas de buscas que já foram substituídas por outra mais nova.
  const requestIdRef = useRef(0);
  // Via ref para o callback não entrar nas deps de `fetchOptions`: um pai que
  // recrie a função a cada render dispararia uma busca nova sem necessidade.
  const onOptionsLoadedRef = useRef(onOptionsLoaded);
  useEffect(() => {
    onOptionsLoadedRef.current = onOptionsLoaded;
  });

  const fetchOptions = useCallback(
    async (term: string) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);

      try {
        const result = await loadOptions({ search: term });
        if (requestIdRef.current !== requestId) return;
        setOptions(result);
        onOptionsLoadedRef.current?.(result);
      } catch {
        if (requestIdRef.current !== requestId) return;
        setOptions([]);
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false);
      }
    },
    [loadOptions]
  );

  useEffect(() => {
    if (!open) return;
    void fetchOptions(debouncedSearch.trim());
  }, [open, debouncedSearch, fetchOptions]);

  const toggle = (slug: string) => {
    onChange(
      value.includes(slug)
        ? value.filter((item) => item !== slug)
        : [...value, slug]
    );
  };

  // As selecionadas ficam no topo mesmo quando a busca não as devolve — sem
  // isso o admin perde de vista o que já marcou assim que começa a digitar.
  const selectedOptions: TagPickerOption[] = value.map(
    (slug) => options.find((option) => option.slug === slug) ?? { slug }
  );
  const unselectedOptions = options.filter(
    (option) => !value.includes(option.slug)
  );

  const trimmedSearch = search.trim();
  const canCreate =
    allowCreate &&
    trimmedSearch.length > 0 &&
    !isLoading &&
    ![...options.map((option) => option.slug), ...value].some(
      (slug) => slug.toLowerCase() === trimmedSearch.toLowerCase()
    );

  const renderItem = (option: TagPickerOption, checked: boolean) => (
    <CommandItem
      key={option.slug}
      value={option.slug}
      onSelect={() => toggle(option.slug)}
      className="cursor-pointer"
    >
      {/* O CommandItem já pinta svg sem cor própria de muted-foreground e
          destaca a linha com bg-accent — daí o check discreto sem CSS extra. */}
      <Check
        className={cn(
          'mr-2 size-4 shrink-0',
          checked ? 'opacity-100' : 'opacity-0'
        )}
      />
      {option.color ? (
        <span
          className="mr-1.5 inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: option.color }}
        />
      ) : null}
      <span className="truncate">{option.slug}</span>
      {option.usageCount ? (
        <span className="ml-auto pl-2 text-xs text-muted-foreground">
          {option.usageCount}
        </span>
      ) : null}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn('gap-1.5', className)}
          >
            <TagIcon className="size-3.5" />
            {label}
            {value.length > 0 ? (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 justify-center px-1 text-[10px]"
              >
                {value.length}
              </Badge>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {/* shouldFilter={false}: quem filtra é o servidor. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList onWheel={(event) => event.stopPropagation()}>
            {canCreate ? (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmedSearch}`}
                  onSelect={() => {
                    toggle(trimmedSearch);
                    setSearch('');
                  }}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 size-3.5 shrink-0" />
                  <span className="truncate">
                    {createLabel?.(trimmedSearch) ?? `Criar "${trimmedSearch}"`}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}

            {selectedOptions.length > 0 ? (
              <CommandGroup>
                {selectedOptions.map((option) => renderItem(option, true))}
              </CommandGroup>
            ) : null}

            {isLoading && options.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {loadingLabel}
              </div>
            ) : unselectedOptions.length > 0 ? (
              <CommandGroup>
                {unselectedOptions.map((option) => renderItem(option, false))}
              </CommandGroup>
            ) : selectedOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </div>
            ) : null}
          </CommandList>

          {value.length > 0 ? (
            <div className="border-t p-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full cursor-pointer"
                onClick={() => onChange([])}
              >
                {clearLabel}
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
