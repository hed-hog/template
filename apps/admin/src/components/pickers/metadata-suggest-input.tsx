'use client';

import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type MetadataSuggestion = { value: string; usageCount?: number };

export type MetadataSuggestInputProps = {
  value: string;
  onChange: (next: string) => void;
  /**
   * Sem esta prop o campo é um input de texto puro — é assim que as telas que
   * ainda não expõem o endereço do catálogo continuam funcionando.
   */
  loadOptions?: (args: { search: string }) => Promise<MetadataSuggestion[]>;
  /**
   * Qualquer coisa fora do termo digitado que mude o resultado — para o campo de
   * valor, a chave da linha. `loadOptions` é lida por ref, então trocá-la sozinha
   * não recarrega nada: sem isso, uma função inline recriada a cada render faria
   * o efeito disparar em laço.
   */
  optionsKey?: string;
  placeholder?: string;
  ariaLabel?: string;
  loadingLabel?: string;
  /**
   * De que lado a lista cresce. Ela é mais larga que o campo de propósito —
   * "Fundamentos de Tecnologia" e "Fundamentos de IA" truncados na largura do
   * input viram a mesma linha — então o campo da direita precisa crescer para a
   * esquerda para não vazar do popover.
   */
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
};

/**
 * Campo de texto do filtro de metadados com sugestão do que já existe no banco.
 *
 * O filtro casa valor a valor, sem tolerância a grafia: sem a lista, digitar
 * "noite" onde foi gravado "Noite" devolve zero pessoas e nada na tela explica
 * o porquê. Digitação livre continua valendo — a lista sugere, não restringe.
 *
 * A lista é um `div` posicionado, não um `Popover`: estes campos vivem dentro do
 * popover do filtro, e um popover aninhado do Radix rouba o foco do input a cada
 * tecla.
 */
export function MetadataSuggestInput({
  value,
  onChange,
  loadOptions,
  optionsKey,
  placeholder,
  ariaLabel,
  loadingLabel,
  align = 'start',
  disabled,
  className,
}: MetadataSuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<MetadataSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedValue = useDebounce(value);
  // Descarta respostas de buscas já substituídas por outra mais nova.
  const requestIdRef = useRef(0);
  const loadOptionsRef = useRef(loadOptions);
  loadOptionsRef.current = loadOptions;

  const fetchOptions = useCallback(async (term: string) => {
    const load = loadOptionsRef.current;
    if (!load) return;

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const result = await load({ search: term });
      if (requestIdRef.current !== requestId) return;
      setOptions(result);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setOptions([]);
    } finally {
      if (requestIdRef.current === requestId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchOptions(debouncedValue.trim());
  }, [open, debouncedValue, optionsKey, fetchOptions]);

  // A opção idêntica ao que já está digitado não ajuda em nada e ainda empurra
  // as outras para fora da lista.
  const suggestions = options.filter(
    (option) => option.value.toLowerCase() !== value.trim().toLowerCase()
  );

  return (
    <div className="relative flex-1">
      <Input
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={cn('h-8 text-xs', className)}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      />

      {loadOptions && open && (isLoading || suggestions.length > 0) ? (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 max-h-48 w-max max-w-64 min-w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {isLoading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {loadingLabel}
            </div>
          ) : (
            suggestions.map((option) => (
              <button
                key={option.value}
                type="button"
                title={option.value}
                // O clique precisa chegar antes do blur, que fecharia a lista
                // e cancelaria a seleção.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              >
                <span className="truncate">{option.value}</span>
                {option.usageCount ? (
                  <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted-foreground">
                    {option.usageCount}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
