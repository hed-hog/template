'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Columns3 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type ColumnsVisibilityMenuColumn = {
  id: string;
  label: string;
  /** `false` trava a coluna sempre visível (ex.: coluna de ações). Padrão `true`. */
  hideable?: boolean;
};

export type ColumnsVisibilityMenuProps = {
  columns: ColumnsVisibilityMenuColumn[];
  hidden: string[];
  onToggle: (id: string, visible: boolean) => void;
  onReset: () => void;
};

/**
 * Dropdown para escolher quais colunas de uma tabela ficam visíveis.
 *
 * A ordem das colunas na lista segue `columns` (já deve vir ordenada pelo
 * `columnOrder` de `useColumnPreferences`, para o menu refletir a posição atual).
 */
export function ColumnsVisibilityMenu({
  columns,
  hidden,
  onToggle,
  onReset,
}: ColumnsVisibilityMenuProps) {
  const t = useTranslations('core.ColumnsMenu');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Só o ícone, como o alternador de visualização ao lado: o nome vai no
            tooltip e no leitor de tela. */}
        <Button variant="outline" size="icon-sm" tooltip={t('trigger')}>
          <Columns3 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={!hidden.includes(column.id)}
            disabled={column.hideable === false}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => onToggle(column.id, !!checked)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset}>{t('reset')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
