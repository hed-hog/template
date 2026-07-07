import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { InputMoney } from './input-money';

// React's synthetic `onBeforeInput` is emulated from legacy
// compositionend/keypress/textInput/paste native events — it never listens
// to the modern native "beforeinput" event (see react-dom's
// registerTwoPhaseEvent("onBeforeInput", ["compositionend","keypress","textInput","paste"])).
// So dispatching a real `beforeinput` DOM event (with `inputType`/`data`, as
// real browsers do) never reaches this component's onBeforeInput prop in
// jsdom+RTL. To exercise `handleBeforeInput`'s branches we invoke the prop
// function directly (as React itself would, just with a plain object standing
// in for the SyntheticEvent) via React's internal per-fiber props, which is
// the only way to reach this handler at all in a DOM-testing environment.
function getReactProps(el: Element): Record<string, unknown> {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
  if (!key) {
    throw new Error('React internal props key not found on element');
  }
  return (el as unknown as Record<string, Record<string, unknown>>)[key];
}

function fireBeforeInput(
  input: HTMLInputElement,
  init: { inputType: string; data?: string | null }
) {
  const props = getReactProps(input);
  const onBeforeInput = props.onBeforeInput as (event: unknown) => void;

  const fakeEvent = {
    currentTarget: input,
    target: input,
    nativeEvent: { inputType: init.inputType, data: init.data ?? undefined },
    defaultPrevented: false,
    preventDefault() {
      fakeEvent.defaultPrevented = true;
    },
  };

  act(() => {
    onBeforeInput(fakeEvent);
  });
  return fakeEvent;
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('InputMoney - funções puras de formatação (via comportamento do input)', () => {
  it('modo não controlado: começa vazio e formata dígitos digitados', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '123456' } });
    expect(input.value).toBe('1.234,56');
  });

  it('formata defaultValue numérico no modo não controlado', () => {
    render(<InputMoney defaultValue={1234.5} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1.234,50');
  });

  it('formata defaultValue string com vírgula/ponto no modo não controlado', () => {
    render(<InputMoney defaultValue="1.234,56" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1.234,56');
  });

  it('sem defaultValue, defaultValue formatado é undefined (fica controlado por internalValue)', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('value controlado numérico é formatado a cada render', () => {
    function Controlled() {
      const [value, setValue] = React.useState(99.9);
      return (
        <InputMoney
          value={value}
          onChange={(e) => {
            // keep it controlled; masking handled internally
            setValue((prev) => prev);
          }}
        />
      );
    }
    render(<Controlled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('99,90');
  });

  it('value controlado com NaN retorna string vazia', () => {
    render(<InputMoney value={NaN} onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('value controlado com tipo não string/number (array) retorna string vazia', () => {
    render(
      <InputMoney
        value={[] as unknown as string}
        onChange={() => {}}
      />
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('value controlado string vazia retorna vazio', () => {
    render(<InputMoney value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('value controlado string com vírgula/ponto inválido cai para dígitos', () => {
    // "1,2,3" -> replace(/\./g,'') -> "1,2,3" -> replace first ',' -> "1.2,3" -> NaN
    // falls through to onlyDigits path: "123" -> 1,23
    render(<InputMoney value="1,2,3" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('1,23');
  });

  it('value controlado string somente com letras (sem dígitos) fica vazio', () => {
    render(<InputMoney value="abc" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('value controlado string sem separador com dígitos formata via centavos', () => {
    render(<InputMoney value="500" onChange={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('5,00');
  });
});

describe('InputMoney - onChange / onValueChange', () => {
  it('dispara onChange e onValueChange com número ao digitar (não controlado)', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(<InputMoney onChange={onChange} onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '1000' } });

    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith(10);
    expect(input.value).toBe('10,00');
  });

  it('dispara onValueChange com null quando o valor mascarado fica vazio', () => {
    const onValueChange = vi.fn();
    render(<InputMoney onValueChange={onValueChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });

    expect(onValueChange).toHaveBeenCalledWith(null);
    expect(input.value).toBe('');
  });

  it('funciona sem onChange/onValueChange informados (não quebra)', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(() => {
      fireEvent.change(input, { target: { value: '250' } });
    }).not.toThrow();
    expect(input.value).toBe('2,50');
  });

  it('modo controlado não atualiza internalValue automaticamente, mas ainda chama callbacks', () => {
    const onChange = vi.fn();
    const onValueChange = vi.fn();
    render(
      <InputMoney value={10} onChange={onChange} onValueChange={onValueChange} />
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('10,00');

    fireEvent.change(input, { target: { value: '99999' } });

    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith(999.99);
    // stays controlled by the `value` prop (10), not by what was typed
    expect(input.value).toBe('10,00');
  });
});

describe('InputMoney - refs', () => {
  it('aceita ref de callback', () => {
    let node: HTMLInputElement | null = null;
    render(<InputMoney ref={(el) => (node = el)} />);
    expect(node).toBeInstanceOf(HTMLInputElement);
  });

  it('aceita ref de objeto (useRef)', () => {
    function Wrapper() {
      const ref = React.useRef<HTMLInputElement>(null);
      return <InputMoney ref={ref} />;
    }
    render(<Wrapper />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('funciona sem nenhum ref', () => {
    expect(() => render(<InputMoney />)).not.toThrow();
  });
});

describe('InputMoney - onBeforeInput (máscara "calculadora")', () => {
  it('bloqueia caracteres não numéricos digitados (insertText sem dígitos)', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    const event = fireBeforeInput(input, { inputType: 'insertText', data: ',' });
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
  });

  it('bloqueia insertText sem nativeEvent.data (undefined)', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    const event = fireBeforeInput(input, { inputType: 'insertText', data: undefined });
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('');
  });

  it('insere dígitos via insertText acumulando no valor atual', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 0);

    fireBeforeInput(input, { inputType: 'insertText', data: '5' });
    expect(input.value).toBe('0,05');
  });

  it('insertCompositionText também é tratado como inserção de dígitos', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireBeforeInput(input, {
      inputType: 'insertCompositionText',
      data: '7',
    });
    expect(input.value).toBe('0,07');
  });

  it('substitui o valor inteiro quando há seleção total (hasFullSelection)', () => {
    render(<InputMoney defaultValue={123.45} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, input.value.length);

    fireBeforeInput(input, { inputType: 'insertText', data: '9' });
    expect(input.value).toBe('0,09');
  });

  it('deleteContentBackward remove o último dígito', () => {
    render(<InputMoney defaultValue={1.23} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireBeforeInput(input, { inputType: 'deleteContentBackward' });
    expect(input.value).toBe('0,12');
  });

  it('deleteContentForward também remove o último dígito', () => {
    render(<InputMoney defaultValue={1.23} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireBeforeInput(input, { inputType: 'deleteContentForward' });
    expect(input.value).toBe('0,12');
  });

  it('deleteContentBackward com seleção total apaga tudo', () => {
    render(<InputMoney defaultValue={1.23} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, input.value.length);

    fireBeforeInput(input, { inputType: 'deleteContentBackward' });
    expect(input.value).toBe('');
  });

  it('inputType desconhecido (ex.: paste) não é interceptado, deixa handleChange remascarar', () => {
    render(<InputMoney />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    const event = fireBeforeInput(input, { inputType: 'insertFromPaste' });
    expect(event.defaultPrevented).toBe(false);

    fireEvent.change(input, { target: { value: '3000' } });
    expect(input.value).toBe('30,00');
  });

  it('respeita onBeforeInput customizado que previne o default', () => {
    const onBeforeInput = vi.fn((e: React.InputEvent<HTMLInputElement>) => {
      e.preventDefault();
    });
    render(<InputMoney onBeforeInput={onBeforeInput} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireBeforeInput(input, { inputType: 'insertText', data: '5' });

    expect(onBeforeInput).toHaveBeenCalled();
    // handleBeforeInput returns early after onBeforeInput prevented default,
    // so no masking side effect happens beyond the caller's own preventDefault.
    expect(input.value).toBe('');
  });

  it('chama onBeforeInput customizado que não previne o default (fluxo normal continua)', () => {
    const onBeforeInput = vi.fn();
    render(<InputMoney onBeforeInput={onBeforeInput} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireBeforeInput(input, { inputType: 'insertText', data: '5' });

    expect(onBeforeInput).toHaveBeenCalled();
    expect(input.value).toBe('0,05');
  });
});

describe('InputMoney - foco e ponteiro', () => {
  it('move o caret para o fim ao focar e chama onFocus customizado', () => {
    const onFocus = vi.fn();
    render(<InputMoney defaultValue={12.3} onFocus={onFocus} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.focus(input);

    expect(onFocus).toHaveBeenCalled();
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('funciona sem onFocus informado', () => {
    render(<InputMoney defaultValue={12.3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(() => fireEvent.focus(input)).not.toThrow();
  });

  it('pointerUp move o caret para o fim quando não há seleção de arraste', () => {
    render(<InputMoney defaultValue={12.3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(0, 0);

    fireEvent.pointerUp(input);

    expect(input.selectionStart).toBe(input.value.length);
  });

  it('pointerUp preserva seleção de arraste (selectionStart !== selectionEnd)', () => {
    render(<InputMoney defaultValue={12.3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(0, 1);

    fireEvent.pointerUp(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
  });

  it('chama onPointerUp customizado', () => {
    const onPointerUp = vi.fn();
    render(<InputMoney defaultValue={12.3} onPointerUp={onPointerUp} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.pointerUp(input);

    expect(onPointerUp).toHaveBeenCalled();
  });

  it('funciona sem onPointerUp informado', () => {
    render(<InputMoney defaultValue={12.3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(() => fireEvent.pointerUp(input)).not.toThrow();
  });

  it('captura erro de setSelectionRange (moveCaretToEnd) sem quebrar', () => {
    const spy = vi
      .spyOn(HTMLInputElement.prototype, 'setSelectionRange')
      .mockImplementation(() => {
        throw new Error('not focused/visible');
      });

    render(<InputMoney defaultValue={12.3} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(() => fireEvent.focus(input)).not.toThrow();

    spy.mockRestore();
  });
});

describe('InputMoney - efeito de reposicionamento de caret (controlado)', () => {
  it('mantém o caret no fim quando o valor formatado muda com o elemento focado', () => {
    function Controlled() {
      const [value, setValue] = React.useState(1);
      return (
        <div>
          <InputMoney
            value={value}
            onValueChange={(v) => setValue(v ?? 0)}
          />
          <button type="button" onClick={() => setValue(999)}>
            change
          </button>
        </div>
      );
    }
    render(<Controlled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.focus();

    fireEvent.click(screen.getByRole('button', { name: 'change' }));

    expect(input.value).toBe('999,00');
    expect(input.selectionStart).toBe(input.value.length);
  });

  it('não move o caret quando o elemento não está focado', () => {
    function Controlled() {
      const [value, setValue] = React.useState(1);
      return (
        <div>
          <InputMoney value={value} onValueChange={(v) => setValue(v ?? 0)} />
          <button type="button" onClick={() => setValue(555)}>
            change
          </button>
        </div>
      );
    }
    render(<Controlled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    // deliberately not focusing the input
    fireEvent.click(screen.getByRole('button', { name: 'change' }));

    expect(input.value).toBe('555,00');
  });
});
