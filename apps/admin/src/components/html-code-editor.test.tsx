import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// CodeMirror 6 depends on layout APIs jsdom does not implement, so the whole
// editor is replaced by a textarea. What we test here is THIS component's own
// logic: zoom persistence, theme resolution and the variable completion source.
const codeMirrorProps = vi.fn();

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: { value: string; onChange: (v: string) => void }) => {
    codeMirrorProps(props);
    return (
      <textarea
        aria-label="html-source"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

vi.mock('@codemirror/lang-html', () => ({
  html: () => ({}),
  htmlCompletionSource: () => null,
}));
vi.mock('@codemirror/view', () => ({ EditorView: { lineWrapping: {} } }));
vi.mock('@codemirror/search', () => ({ search: () => ({}) }));

const autocompletionMock = vi.fn((config: unknown) => config);
vi.mock('@codemirror/autocomplete', () => ({
  autocompletion: (config: unknown) => autocompletionMock(config),
}));

const themeModeMock = vi.fn(() => 'light');
vi.mock('@/hooks/use-theme-mode', () => ({
  useThemeMode: () => themeModeMock(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { HtmlCodeEditor } from './html-code-editor';

describe('HtmlCodeEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    themeModeMock.mockReturnValue('light');
    localStorage.clear();
  });

  it('propaga edições do editor', () => {
    const onChange = vi.fn();
    render(<HtmlCodeEditor value="<p>a</p>" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('html-source'), {
      target: { value: '<p>b</p>' },
    });

    expect(onChange).toHaveBeenCalledWith('<p>b</p>');
  });

  it('segue o tema do app em vez de um valor fixo', () => {
    themeModeMock.mockReturnValue('dark');
    render(<HtmlCodeEditor value="" onChange={vi.fn()} />);

    expect(codeMirrorProps).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });

  it('persiste o zoom na chave informada', () => {
    render(
      <HtmlCodeEditor value="" onChange={vi.fn()} zoomStorageKey="custom-zoom" />
    );

    fireEvent.click(screen.getByTitle('zoomIn'));

    expect(screen.getByTitle('resetZoom')).toHaveTextContent('110%');
    expect(localStorage.getItem('custom-zoom')).toBe('110');
  });

  it('restaura o zoom salvo, limitado a 50-200%', () => {
    localStorage.setItem('custom-zoom', '999');
    render(
      <HtmlCodeEditor value="" onChange={vi.fn()} zoomStorageKey="custom-zoom" />
    );

    expect(screen.getByTitle('resetZoom')).toHaveTextContent('200%');
    expect(screen.getByTitle('zoomIn')).toBeDisabled();
  });

  it('volta o zoom para 100% ao clicar no indicador', () => {
    render(<HtmlCodeEditor value="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle('zoomOut'));
    expect(screen.getByTitle('resetZoom')).toHaveTextContent('90%');

    fireEvent.click(screen.getByTitle('resetZoom'));
    expect(screen.getByTitle('resetZoom')).toHaveTextContent('100%');
  });

  it('oferece as variáveis informadas no autocomplete', () => {
    render(
      <HtmlCodeEditor
        value=""
        onChange={vi.fn()}
        variables={[{ label: '{{name}}', detail: 'Nome' }]}
      />
    );

    const config = autocompletionMock.mock.calls[0]![0] as {
      override: Array<(ctx: unknown) => unknown>;
    };
    const source = config.override[0]!;

    const result = source({
      matchBefore: () => ({ from: 0, to: 2 }),
      explicit: true,
    }) as { options: Array<{ label: string; detail?: string }> };

    expect(result.options).toEqual([
      { label: '{{name}}', type: 'variable', detail: 'Nome' },
    ]);
  });

  it('não registra fonte de variáveis quando não há variáveis', () => {
    render(<HtmlCodeEditor value="" onChange={vi.fn()} />);

    const config = autocompletionMock.mock.calls[0]![0] as {
      override: unknown[];
    };

    expect(config.override).toHaveLength(1);
  });
});
