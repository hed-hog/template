import '@testing-library/jest-dom/vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The real `input-otp` OTPInput relies on DOM measurement APIs not available
// in jsdom; we mock it with a plain input and reuse the same context object
// the source component consumes so InputOTPSlot can be exercised directly.
// `vi.mock` factories are hoisted above imports, so the context must be
// created via `vi.hoisted` to avoid a temporal-dead-zone reference error.
const { OTPInputContext } = vi.hoisted(() => {
  const React = require('react')
  return { OTPInputContext: React.createContext(undefined) }
})

vi.mock('input-otp', () => ({
  OTPInput: ({ containerClassName, className, ...props }: any) => (
    <input
      data-testid="otp-input"
      data-container-class={containerClassName}
      className={className}
      {...props}
    />
  ),
  OTPInputContext,
}))

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from './input-otp'

describe('InputOTP', () => {
  it('renderiza o input repassando classes do container e do input', () => {
    render(
      <InputOTP
        maxLength={6}
        containerClassName="my-container"
        className="my-input"
      />,
    )
    const input = screen.getByTestId('otp-input')
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'my-input')
    expect(input.getAttribute('data-container-class')).toContain(
      'my-container',
    )
    expect(input.getAttribute('data-container-class')).toContain(
      'has-disabled:opacity-50',
    )
  })
})

describe('InputOTPGroup', () => {
  it('renderiza um grupo de slots', () => {
    render(<InputOTPGroup data-testid="otp-group" />)
    expect(screen.getByTestId('otp-group')).toHaveAttribute(
      'data-slot',
      'input-otp-group',
    )
  })
})

describe('InputOTPSlot', () => {
  it('renderiza o caractere e o fake caret quando o slot está ativo', () => {
    render(
      <OTPInputContext.Provider
        value={{ slots: [{ char: '1', hasFakeCaret: true, isActive: true }] }}
      >
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>,
    )
    const slot = screen.getByText('1')
    expect(slot).toHaveAttribute('data-active', 'true')
    expect(slot.querySelector('.animate-caret-blink')).toBeInTheDocument()
  })

  it('não renderiza o fake caret quando o slot está inativo', () => {
    render(
      <OTPInputContext.Provider
        value={{
          slots: [{ char: '2', hasFakeCaret: false, isActive: false }],
        }}
      >
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>,
    )
    const slot = screen.getByText('2')
    expect(slot).toHaveAttribute('data-active', 'false')
    expect(slot.querySelector('.animate-caret-blink')).not.toBeInTheDocument()
  })

  it('lida com a ausência de contexto sem quebrar', () => {
    render(<InputOTPSlot index={0} data-testid="otp-slot-no-context" />)
    const slot = screen.getByTestId('otp-slot-no-context')
    expect(slot).toHaveAttribute('data-slot', 'input-otp-slot')
    expect(slot).not.toHaveAttribute('data-active')
  })
})

describe('InputOTPSeparator', () => {
  it('renderiza o separador com o ícone', () => {
    render(<InputOTPSeparator />)
    const separator = screen.getByRole('separator')
    expect(separator).toHaveAttribute('data-slot', 'input-otp-separator')
    expect(separator.querySelector('svg')).toBeInTheDocument()
  })
})
