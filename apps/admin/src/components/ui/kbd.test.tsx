import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Kbd, KbdGroup } from './kbd'

describe('Kbd', () => {
  it('renderiza o elemento kbd com o conteúdo e slot corretos', () => {
    render(<Kbd>Ctrl</Kbd>)
    const kbd = screen.getByText('Ctrl')
    expect(kbd.tagName).toBe('KBD')
    expect(kbd).toHaveAttribute('data-slot', 'kbd')
  })

  it('mescla className customizada', () => {
    render(<Kbd className="my-kbd-class">Esc</Kbd>)
    expect(screen.getByText('Esc')).toHaveClass('my-kbd-class')
  })
})

describe('KbdGroup', () => {
  it('renderiza um agrupamento de kbd', () => {
    render(
      <KbdGroup data-testid="kbd-group">
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    )
    const group = screen.getByTestId('kbd-group')
    expect(group).toHaveAttribute('data-slot', 'kbd-group')
    expect(group.tagName).toBe('KBD')
  })

  it('mescla className customizada', () => {
    render(<KbdGroup className="my-group-class" data-testid="kbd-group-2" />)
    expect(screen.getByTestId('kbd-group-2')).toHaveClass('my-group-class')
  })
})
