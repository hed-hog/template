import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Os dois editores são carregados via next/dynamic; substituímos por textareas
// para testar a lógica deste componente (abas, avisos, escolha do preview) sem
// arrastar TipTap/CodeMirror para o jsdom.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    const testId = source.includes('html-code-editor')
      ? 'code-editor'
      : 'rich-editor';
    return ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (v: string) => void;
    }) => (
      <textarea
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <button data-testid={`tab-${value}`}>{children}</button>,
  TabsContent: ({
    children,
    value,
  }: {
    children: ReactNode;
    value: string;
  }) => <div data-testid={`panel-${value}`}>{children}</div>,
}));

import { toast } from 'sonner';
import {
  HtmlContentEditor,
  isComplexHtml,
  isFullHtmlDocument,
} from './html-content-editor';

describe('isComplexHtml', () => {
  it('detecta marcações que o editor visual descartaria', () => {
    expect(isComplexHtml('<style>a{}</style>')).toBe(true);
    expect(isComplexHtml('<HEAD>')).toBe(true);
    expect(isComplexHtml('<body class="x">')).toBe(true);
    expect(isComplexHtml('<script src="x">')).toBe(true);
    expect(isComplexHtml('<!DOCTYPE html>')).toBe(true);
  });

  it('aceita fragmentos simples', () => {
    expect(isComplexHtml('<p>oi</p>')).toBe(false);
    expect(isComplexHtml('')).toBe(false);
    expect(isComplexHtml(null)).toBe(false);
    expect(isComplexHtml(undefined)).toBe(false);
  });
});

describe('isFullHtmlDocument', () => {
  it('reconhece documentos completos', () => {
    expect(isFullHtmlDocument('<!doctype html><html></html>')).toBe(true);
    expect(isFullHtmlDocument('<html lang="pt">')).toBe(true);
    expect(isFullHtmlDocument('<html>')).toBe(true);
  });

  it('rejeita fragmentos e conteúdo vazio', () => {
    expect(isFullHtmlDocument('<p>oi</p>')).toBe(false);
    // `<htmlx` não é a tag html.
    expect(isFullHtmlDocument('<htmlx>')).toBe(false);
    expect(isFullHtmlDocument('')).toBe(false);
    expect(isFullHtmlDocument(null)).toBe(false);
  });
});

describe('HtmlContentEditor', () => {
  it('mostra as três abas por padrão', () => {
    render(<HtmlContentEditor value="<p>a</p>" onChange={vi.fn()} />);

    expect(screen.getByTestId('tab-preview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-editor')).toBeInTheDocument();
    expect(screen.getByTestId('tab-code')).toBeInTheDocument();
  });

  it('omite o editor visual quando allowRichText=false', () => {
    // O wrapper do layout base contém <style>/<head>; o TipTap os removeria.
    render(
      <HtmlContentEditor
        value="<style>a{}</style>"
        onChange={vi.fn()}
        allowRichText={false}
      />
    );

    expect(screen.queryByTestId('tab-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rich-editor')).not.toBeInTheDocument();
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
  });

  it('avisa sobre HTML complexo apenas no modo visual', () => {
    const { rerender } = render(
      <HtmlContentEditor value="<style>a{}</style>" onChange={vi.fn()} />
    );
    expect(screen.getByText('complexHtmlWarningTitle')).toBeInTheDocument();

    rerender(
      <HtmlContentEditor
        value="<style>a{}</style>"
        onChange={vi.fn()}
        allowRichText={false}
      />
    );
    expect(
      screen.queryByText('complexHtmlWarningTitle')
    ).not.toBeInTheDocument();
  });

  it('usa o previewHtml do servidor quando disponível', () => {
    render(
      <HtmlContentEditor
        value="<p>fonte</p>"
        onChange={vi.fn()}
        previewHtml="<html>renderizado no servidor</html>"
      />
    );

    const iframe = screen.getByTitle('previewTitle') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toBe(
      '<html>renderizado no servidor</html>'
    );
    // sandbox vazio: o HTML do preview não pode executar scripts.
    expect(iframe.getAttribute('sandbox')).toBe('');
  });

  it('cai para o próprio valor quando não há preview do servidor', () => {
    render(<HtmlContentEditor value="<p>fonte</p>" onChange={vi.fn()} />);

    const iframe = screen.getByTitle('previewTitle') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toBe('<p>fonte</p>');
  });

  it('mostra o estado vazio quando não há nada para visualizar', () => {
    render(<HtmlContentEditor value="   " onChange={vi.fn()} />);

    expect(screen.getByText('noContent')).toBeInTheDocument();
    expect(screen.queryByTitle('previewTitle')).not.toBeInTheDocument();
  });

  it('propaga edições dos dois editores', () => {
    const onChange = vi.fn();
    render(<HtmlContentEditor value="<p>a</p>" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('rich-editor'), {
      target: { value: '<p>visual</p>' },
    });
    fireEvent.change(screen.getByTestId('code-editor'), {
      target: { value: '<p>codigo</p>' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, '<p>visual</p>');
    expect(onChange).toHaveBeenNthCalledWith(2, '<p>codigo</p>');
  });

  it('renderiza os avisos recebidos por prop', () => {
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={vi.fn()}
        warnings={<div>aviso customizado</div>}
      />
    );

    expect(screen.getByText('aviso customizado')).toBeInTheDocument();
  });

  it('previewOnly esconde as abas de edição, a IA e a visualização lado a lado', () => {
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={vi.fn()}
        previewOnly
        renderTabBarActions={() => <button>salvar</button>}
        aiEdit={{ onSubmit: vi.fn() }}
      />
    );

    expect(screen.getByTestId('tab-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-code')).not.toBeInTheDocument();
    expect(screen.queryByText('salvar')).not.toBeInTheDocument();
    expect(screen.queryByText('aiEditTitle')).not.toBeInTheDocument();
    expect(screen.queryByTitle('enterSplitView')).not.toBeInTheDocument();
    // A tela cheia continua disponível mesmo em modo somente-preview.
    expect(screen.getByTitle('enterFullscreen')).toBeInTheDocument();
  });

  it('chama renderTabBarActions com a aba ativa', () => {
    const renderTabBarActions = vi.fn(() => <button>ação</button>);
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={vi.fn()}
        defaultTab="code"
        renderTabBarActions={renderTabBarActions}
      />
    );

    expect(renderTabBarActions).toHaveBeenCalledWith('code');
    expect(screen.getByText('ação')).toBeInTheDocument();
  });

  it('aiEdit: sucesso propaga o HTML, limpa a instrução, volta para preview e avisa', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue('<p>ajustado</p>');
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={onChange}
        defaultTab="code"
        aiEdit={{ onSubmit }}
      />
    );

    const textarea = screen.getByPlaceholderText('aiInstructionPlaceholder');
    fireEvent.change(textarea, { target: { value: 'troca a cor' } });
    fireEvent.click(screen.getByText('aiApplyButton'));

    await vi.waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('<p>ajustado</p>');
    });
    expect(onSubmit).toHaveBeenCalledWith('troca a cor', '<p>a</p>');
    expect(toast.success).toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });

  it('aiEdit: erro mostra toast sem alterar o valor', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error('falhou'));
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={onChange}
        defaultTab="code"
        aiEdit={{ onSubmit }}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('aiInstructionPlaceholder'), {
      target: { value: 'troca a cor' },
    });
    fireEvent.click(screen.getByText('aiApplyButton'));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('falhou');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('alterna para tela cheia e trava/restaura o scroll do body', () => {
    render(<HtmlContentEditor value="<p>a</p>" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTitle('enterFullscreen'));
    expect(screen.getByTitle('exitFullscreen')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByTitle('exitFullscreen'));
    expect(screen.getByTitle('enterFullscreen')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('alterna para a visualização lado a lado (Preview | HTML | IA)', () => {
    render(
      <HtmlContentEditor
        value="<p>a</p>"
        onChange={vi.fn()}
        aiEdit={{ onSubmit: vi.fn() }}
      />
    );

    fireEvent.click(screen.getByTitle('enterSplitView'));

    expect(screen.getByTitle('exitSplitView')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    // O editor visual (WYSIWYG) não faz parte da visualização lado a lado.
    expect(screen.queryByTestId('rich-editor')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('aiInstructionPlaceholder')).toBeInTheDocument();
  });
});
