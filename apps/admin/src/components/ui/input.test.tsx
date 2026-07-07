import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Input } from './input'

describe('Input', () => {
  it('renderiza um input de texto com classes padrão e atributos repassados', () => {
    render(<Input placeholder="Digite seu nome" />)
    const input = screen.getByPlaceholderText('Digite seu nome')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('data-slot', 'input')
    expect(input).toHaveClass('h-9', 'w-full', 'rounded-md')
  })

  it('repassa o type e mescla className customizada', () => {
    render(<Input type="password" className="my-extra-class" data-testid="pwd" />)
    const input = screen.getByTestId('pwd')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveClass('my-extra-class')
  })

  it('fica desabilitado quando disabled é true', () => {
    render(<Input disabled data-testid="disabled-input" />)
    expect(screen.getByTestId('disabled-input')).toBeDisabled()
  })
})
