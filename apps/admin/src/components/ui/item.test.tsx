import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from './item'

describe('ItemGroup', () => {
  it('renderiza como uma lista', () => {
    render(<ItemGroup data-testid="item-group">conteúdo</ItemGroup>)
    const group = screen.getByTestId('item-group')
    expect(group).toHaveAttribute('role', 'list')
    expect(group).toHaveAttribute('data-slot', 'item-group')
  })
})

describe('ItemSeparator', () => {
  it('renderiza um separador horizontal', () => {
    render(<ItemSeparator data-testid="item-separator" />)
    expect(screen.getByTestId('item-separator')).toHaveAttribute(
      'data-slot',
      'item-separator',
    )
  })
})

describe('Item', () => {
  it('usa variant e size padrão quando não informados', () => {
    render(<Item data-testid="item">Item padrão</Item>)
    const item = screen.getByTestId('item')
    expect(item).toHaveAttribute('data-variant', 'default')
    expect(item).toHaveAttribute('data-size', 'default')
    expect(item.tagName).toBe('DIV')
  })

  it('aplica a variant outline', () => {
    render(
      <Item data-testid="item-outline" variant="outline">
        Outline
      </Item>,
    )
    expect(screen.getByTestId('item-outline')).toHaveAttribute(
      'data-variant',
      'outline',
    )
  })

  it('aplica a variant muted', () => {
    render(
      <Item data-testid="item-muted" variant="muted">
        Muted
      </Item>,
    )
    expect(screen.getByTestId('item-muted')).toHaveAttribute(
      'data-variant',
      'muted',
    )
  })

  it('aplica o size sm', () => {
    render(
      <Item data-testid="item-sm" size="sm">
        Pequeno
      </Item>,
    )
    expect(screen.getByTestId('item-sm')).toHaveAttribute('data-size', 'sm')
  })

  it('renderiza como Slot quando asChild é true', () => {
    render(
      <Item asChild data-testid="item-as-child">
        <a href="/destino">Link do item</a>
      </Item>,
    )
    const item = screen.getByTestId('item-as-child')
    expect(item.tagName).toBe('A')
    expect(item).toHaveAttribute('href', '/destino')
  })
})

describe('ItemMedia', () => {
  it('usa variant default por padrão', () => {
    render(<ItemMedia data-testid="item-media">🙂</ItemMedia>)
    expect(screen.getByTestId('item-media')).toHaveAttribute(
      'data-variant',
      'default',
    )
  })

  it('aplica a variant icon', () => {
    render(
      <ItemMedia data-testid="item-media-icon" variant="icon">
        🔔
      </ItemMedia>,
    )
    expect(screen.getByTestId('item-media-icon')).toHaveAttribute(
      'data-variant',
      'icon',
    )
  })

  it('aplica a variant image', () => {
    render(
      <ItemMedia data-testid="item-media-image" variant="image">
        <img src="/avatar.png" alt="avatar" />
      </ItemMedia>,
    )
    expect(screen.getByTestId('item-media-image')).toHaveAttribute(
      'data-variant',
      'image',
    )
  })
})

describe('ItemContent', () => {
  it('renderiza o conteúdo', () => {
    render(<ItemContent data-testid="item-content">conteúdo</ItemContent>)
    expect(screen.getByTestId('item-content')).toHaveAttribute(
      'data-slot',
      'item-content',
    )
  })
})

describe('ItemTitle', () => {
  it('renderiza o título', () => {
    render(<ItemTitle>Meu título</ItemTitle>)
    expect(screen.getByText('Meu título')).toHaveAttribute(
      'data-slot',
      'item-title',
    )
  })
})

describe('ItemDescription', () => {
  it('renderiza a descrição como parágrafo', () => {
    render(<ItemDescription>Minha descrição</ItemDescription>)
    const description = screen.getByText('Minha descrição')
    expect(description.tagName).toBe('P')
    expect(description).toHaveAttribute('data-slot', 'item-description')
  })
})

describe('ItemActions', () => {
  it('renderiza as ações', () => {
    render(<ItemActions data-testid="item-actions">ação</ItemActions>)
    expect(screen.getByTestId('item-actions')).toHaveAttribute(
      'data-slot',
      'item-actions',
    )
  })
})

describe('ItemHeader', () => {
  it('renderiza o cabeçalho', () => {
    render(<ItemHeader data-testid="item-header">cabeçalho</ItemHeader>)
    expect(screen.getByTestId('item-header')).toHaveAttribute(
      'data-slot',
      'item-header',
    )
  })
})

describe('ItemFooter', () => {
  it('renderiza o rodapé', () => {
    render(<ItemFooter data-testid="item-footer">rodapé</ItemFooter>)
    expect(screen.getByTestId('item-footer')).toHaveAttribute(
      'data-slot',
      'item-footer',
    )
  })
})
