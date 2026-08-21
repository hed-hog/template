import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ request: mockRequest }),
}));

const { mockToastError } = vi.hoisted(() => ({ mockToastError: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: mockToastError,
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

const { mockBuildImageUrl } = vi.hoisted(() => ({
  mockBuildImageUrl: vi.fn(),
}));
vi.mock('@/lib/build-image-url', () => ({
  buildImageUrl: mockBuildImageUrl,
}));

import {
  MediaUploadUrlField,
  type MediaUploadUrlFieldLabels,
} from './media-upload-url-field';

const labels: MediaUploadUrlFieldLabels = {
  empty: 'empty',
  upload: 'upload',
  replace: 'replace',
  remove: 'remove',
  uploading: 'uploading',
  uploadError: 'uploadError',
  linkPlaceholder: 'linkPlaceholder',
};

function imgFile(name = 'a.png', type = 'image/png') {
  return new File(['x'], name, { type });
}

function getFileInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

function getUploadButton(container: HTMLElement) {
  return container
    .querySelector('svg.lucide-cloud-upload')
    ?.closest('button') as HTMLButtonElement;
}

function getRemoveButton(container: HTMLElement) {
  return container
    .querySelector('svg.lucide-trash2')
    ?.closest('button') as HTMLButtonElement;
}

function getUrlInput(container: HTMLElement) {
  return container.querySelector('input[type="text"]') as HTMLInputElement;
}

describe('MediaUploadUrlField', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockToastError.mockReset();
    mockBuildImageUrl.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderField(
    props: Partial<React.ComponentProps<typeof MediaUploadUrlField>> = {}
  ) {
    const onChange = vi.fn();
    const utils = render(
      <MediaUploadUrlField
        value=""
        onChange={onChange}
        label="Logo"
        destination="cms/pages"
        labels={labels}
        {...props}
      />
    );
    return { ...utils, onChange };
  }

  it('mostra o placeholder vazio quando não há valor', () => {
    renderField();
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renderiza a imagem quando há valor', () => {
    renderField({ value: 'http://x/file/image/5' });
    const img = screen.getByAltText('Logo') as HTMLImageElement;
    expect(img.src).toBe('http://x/file/image/5');
  });

  it('volta ao placeholder quando a imagem falha ao carregar', () => {
    renderField({ value: 'http://broken' });
    const img = screen.getByAltText('Logo');
    fireEvent.error(img);
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('renderiza a descrição quando informada', () => {
    renderField({ description: 'Recomendado: 200x60px' });
    expect(screen.getByText('Recomendado: 200x60px')).toBeInTheDocument();
  });

  it('não renderiza o botão de remover quando não há valor', () => {
    const { container } = renderField();
    expect(getRemoveButton(container)).toBeUndefined();
  });

  describe('upload', () => {
    it('aciona o input de arquivo oculto ao clicar no botão de upload', () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
      const { container } = renderField();
      fireEvent.click(getUploadButton(container));
      expect(clickSpy).toHaveBeenCalled();
    });

    it('não faz nada quando nenhum arquivo é selecionado', () => {
      const { container } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [] } });
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('exibe erro quando o arquivo não é uma imagem', () => {
      const { container } = renderField();
      const file = new File(['x'], 'a.mp4', { type: 'video/mp4' });
      fireEvent.change(getFileInput(container), { target: { files: [file] } });
      expect(mockToastError).toHaveBeenCalledWith('uploadError');
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('faz upload com sucesso e chama onChange com a URL construída', async () => {
      mockRequest.mockResolvedValueOnce({ data: { id: 42 } });
      mockBuildImageUrl.mockReturnValue('http://x/file/image/42');
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith('http://x/file/image/42')
      );
      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/file', method: 'POST' })
      );
    });

    it('exibe erro quando a resposta não possui id', async () => {
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('uploadError'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container, onChange } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('uploadError'));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('mostra o overlay de upload enquanto a requisição está pendente', async () => {
      let resolveRequest: (value: unknown) => void = () => {};
      mockRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          })
      );
      const { container } = renderField();
      fireEvent.change(getFileInput(container), { target: { files: [imgFile()] } });
      await waitFor(() =>
        expect(
          container.querySelector('.absolute.inset-0 svg.animate-spin')
        ).toBeInTheDocument()
      );
      resolveRequest({ data: { id: 1 } });
      await waitFor(() =>
        expect(
          container.querySelector('.absolute.inset-0 svg.animate-spin')
        ).not.toBeInTheDocument()
      );
    });
  });

  describe('link manual', () => {
    it('chama onChange com o valor digitado no campo de link', () => {
      const { container, onChange } = renderField();
      fireEvent.change(getUrlInput(container), {
        target: { value: 'https://cdn.example.com/logo.png' },
      });
      expect(onChange).toHaveBeenCalledWith('https://cdn.example.com/logo.png');
    });
  });

  describe('remover', () => {
    it('chama onChange com string vazia', () => {
      const { container, onChange } = renderField({ value: 'http://x/y.png' });
      fireEvent.click(getRemoveButton(container));
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('disabled', () => {
    it('desabilita upload, campo de link e remoção quando disabled=true', () => {
      const { container } = renderField({ value: 'http://x/y.png', disabled: true });
      expect(getUploadButton(container)).toBeDisabled();
      expect(getUrlInput(container)).toBeDisabled();
      expect(getRemoveButton(container)).toBeDisabled();
    });
  });
});
