import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// CourseImageGallery only needs useApp().request; we mock the provider hook
// directly (vi.hoisted) for full per-test control over request resolution/
// rejection, matching the pattern used across the repo's hook tests (see
// use-widget-data.test.tsx) rather than wiring the real AppProvider + MSW.
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

vi.mock('@/components/file-type-icon', () => ({
  FileTypeIcon: ({ filename }: { filename: string }) => (
    <div data-testid="file-type-icon">{filename}</div>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

// Stub out the crop dialog: expose a button that, when the dialog is "open",
// invokes onCropped with a fake Blob so we can exercise handleCropped without
// dealing with react-easy-crop/canvas internals.
vi.mock('@/components/image-crop/image-crop-dialog', () => ({
  ImageCropDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCropped: (blob: Blob) => void | Promise<void>;
  }) =>
    props.open ? (
      <>
        <button
          data-testid="crop-confirm"
          onClick={() => props.onCropped(new Blob(['x'], { type: 'image/webp' }))}
        >
          confirm crop
        </button>
        <button data-testid="crop-cancel" onClick={() => props.onOpenChange(false)}>
          cancel crop
        </button>
      </>
    ) : null,
}));

import {
  CourseImageGallery,
  type CourseImageItem,
} from './course-image-gallery';

const t = (key: string) => key;

const baseSpec = {
  aspect: 1,
  width: 200,
  height: 200,
  imageType: 'logo',
};

function makeImage(overrides: Partial<CourseImageItem> = {}): CourseImageItem {
  return {
    id: 1,
    fileId: 10,
    filename: 'a.png',
    isPrimary: false,
    isActive: true,
    order: 0,
    ...overrides,
  };
}

function pngFile(name = 'a.png', size = 1024) {
  const file = new File(['x'], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// The per-image action buttons only contain an icon (no text/aria-label) and
// their tooltip text isn't reliably exposed as the accessible name (Radix
// wires it via aria-describedby, not aria-labelledby), so getByRole({ name })
// doesn't match them. Locate each button by the lucide icon class it contains
// instead — note the "isPrimary" Badge also renders a Star icon (not inside a
// button), so we look for a <button> ancestor via closest('button') and pick
// the first icon whose closest ancestor actually is one.
function findButtonByIcon(container: HTMLElement, iconClass: string) {
  const icons = container.querySelectorAll(`svg.${iconClass}`);
  for (const icon of Array.from(icons)) {
    const button = icon.closest('button');
    if (button) return button as HTMLButtonElement;
  }
  return null as unknown as HTMLButtonElement;
}

function getActionButtons(container: HTMLElement) {
  return {
    setPrimary: findButtonByIcon(container, 'lucide-star'),
    toggleActive:
      findButtonByIcon(container, 'lucide-power') ??
      findButtonByIcon(container, 'lucide-power-off'),
    openOriginal: findButtonByIcon(container, 'lucide-eye'),
    removeImage: findButtonByIcon(container, 'lucide-trash2'),
  };
}

describe('CourseImageGallery', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockToastError.mockReset();
    mockBuildImageUrl.mockReset();
    mockBuildImageUrl.mockReturnValue(null);
    vi.restoreAllMocks();
  });

  it('renderiza specLabel quando width e height existem', () => {
    render(
      <CourseImageGallery
        courseId={1}
        type="logo"
        label="Logo"
        spec={baseSpec}
        images={[]}
        onChanged={vi.fn()}
        t={t}
      />
    );
    expect(screen.getByText('200×200px')).toBeInTheDocument();
  });

  it('não renderiza specLabel quando width/height ausentes', () => {
    render(
      <CourseImageGallery
        courseId={1}
        type="logo"
        label="Logo"
        spec={{ ...baseSpec, width: 0, height: 0 }}
        images={[]}
        onChanged={vi.fn()}
        t={t}
      />
    );
    expect(screen.queryByText(/px$/)).not.toBeInTheDocument();
  });

  it('mostra a mensagem de galeria vazia quando não há imagens e não está enviando', () => {
    render(
      <CourseImageGallery
        courseId={1}
        type="logo"
        label="Logo"
        spec={baseSpec}
        images={[]}
        onChanged={vi.fn()}
        t={t}
      />
    );
    expect(screen.getByText('form.media.galleryEmpty')).toBeInTheDocument();
  });

  it('aciona o input de arquivo oculto ao clicar no botão de adicionar', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');
    render(
      <CourseImageGallery
        courseId={1}
        type="logo"
        label="Logo"
        spec={baseSpec}
        images={[]}
        onChanged={vi.fn()}
        t={t}
      />
    );
    fireEvent.click(screen.getByText('form.media.addImage').closest('button')!);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('desabilita o botão de adicionar quando não há courseId', () => {
    render(
      <CourseImageGallery
        courseId={null}
        type="logo"
        label="Logo"
        spec={baseSpec}
        images={[]}
        onChanged={vi.fn()}
        t={t}
      />
    );
    expect(screen.getByText('form.media.addImage').closest('button')).toBeDisabled();
  });

  describe('handleSelect', () => {
    function renderGallery() {
      return render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[]}
          onChanged={vi.fn()}
          t={t}
        />
      );
    }

    function getInput(container: HTMLElement) {
      return container.querySelector('input[type="file"]') as HTMLInputElement;
    }

    it('não faz nada quando nenhum arquivo é selecionado', () => {
      const { container } = renderGallery();
      const input = getInput(container);
      fireEvent.change(input, { target: { files: [] } });
      expect(screen.queryByTestId('crop-confirm')).not.toBeInTheDocument();
    });

    it('exibe erro quando o arquivo não é uma imagem', () => {
      const { container } = renderGallery();
      const input = getInput(container);
      const file = new File(['x'], 'a.txt', { type: 'text/plain' });
      fireEvent.change(input, { target: { files: [file] } });
      expect(mockToastError).toHaveBeenCalledWith('toasts.onlyImages');
    });

    it('exibe erro quando o arquivo excede o tamanho máximo', () => {
      const { container } = renderGallery();
      const input = getInput(container);
      const file = pngFile('big.png', 6 * 1024 * 1024);
      fireEvent.change(input, { target: { files: [file] } });
      expect(mockToastError).toHaveBeenCalledWith('toasts.maxSize');
    });

    it('abre o crop dialog para um arquivo de imagem válido', () => {
      const { container } = renderGallery();
      const input = getInput(container);
      const file = pngFile();
      fireEvent.change(input, { target: { files: [file] } });
      expect(screen.getByTestId('crop-confirm')).toBeInTheDocument();
    });

    it('fecha o crop dialog ao cancelar (onOpenChange(false))', () => {
      const { container } = renderGallery();
      const input = getInput(container);
      fireEvent.change(input, { target: { files: [pngFile()] } });
      expect(screen.getByTestId('crop-confirm')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('crop-cancel'));
      expect(screen.queryByTestId('crop-confirm')).not.toBeInTheDocument();
    });
  });

  describe('handleCropped', () => {
    function renderAndCrop(onChanged = vi.fn(), courseId: string | number | null = 1) {
      const utils = render(
        <CourseImageGallery
          courseId={courseId}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[]}
          onChanged={onChanged}
          t={t}
        />
      );
      const input = utils.container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { files: [pngFile()] } });
      return { ...utils, onChanged };
    }

    it('não faz nada quando courseId é nulo', async () => {
      const { onChanged } = renderAndCrop(vi.fn(), null);
      // The crop dialog still opens (courseId is only checked inside
      // handleCropped), but confirming the crop must be a no-op.
      fireEvent.click(screen.getByTestId('crop-confirm'));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockRequest).not.toHaveBeenCalled();
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('envia a imagem, cria a associação e chama onChanged em caso de sucesso', async () => {
      const onChanged = vi.fn();
      mockRequest
        .mockResolvedValueOnce({ data: { id: 55 } })
        .mockResolvedValueOnce({ data: {} });
      renderAndCrop(onChanged);
      fireEvent.click(screen.getByTestId('crop-confirm'));

      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockRequest).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ url: '/file', method: 'POST' })
      );
      expect(mockRequest).toHaveBeenNthCalledWith(2, {
        url: '/lms/courses/1/images',
        method: 'POST',
        data: { fileId: 55, type: 'logo' },
      });
    });

    it('exibe erro quando a resposta de upload não possui id de arquivo válido', async () => {
      mockRequest.mockResolvedValueOnce({ data: {} });
      renderAndCrop();
      fireEvent.click(screen.getByTestId('crop-confirm'));
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.fileUploadError')
      );
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      renderAndCrop();
      fireEvent.click(screen.getByTestId('crop-confirm'));
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.fileUploadError')
      );
    });
  });

  describe('openOriginal', () => {
    it('não faz nada quando fileId é nulo', () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ fileId: null })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).openOriginal);
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('abre a janela quando a resposta possui url', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockRequest.mockResolvedValueOnce({ data: { url: 'http://x/y.png' } });
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).openOriginal);
      await waitFor(() =>
        expect(openSpy).toHaveBeenCalledWith(
          'http://x/y.png',
          '_blank',
          'noopener,noreferrer'
        )
      );
    });

    it('exibe erro quando a resposta não possui url', async () => {
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).openOriginal);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.openFileError')
      );
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).openOriginal);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.openFileError')
      );
    });
  });

  describe('setPrimary', () => {
    it('não faz nada quando courseId é nulo', () => {
      const { container } = render(
        <CourseImageGallery
          courseId={null}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).setPrimary);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('não faz nada quando a imagem já é primária (botão desabilitado)', () => {
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ isPrimary: true })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(getActionButtons(container).setPrimary).toBeDisabled();
      expect(screen.getByText('form.media.defaultBadge')).toBeInTheDocument();
    });

    it('define como primária e chama onChanged em caso de sucesso', async () => {
      const onChanged = vi.fn();
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).setPrimary);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockRequest).toHaveBeenCalledWith({
        url: '/lms/courses/1/images/1/primary',
        method: 'PATCH',
      });
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).setPrimary);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.fileUploadError')
      );
    });
  });

  describe('toggleActive', () => {
    it('não faz nada quando courseId é nulo', () => {
      const { container } = render(
        <CourseImageGallery
          courseId={null}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).toggleActive);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('mostra badge e rótulo inativo quando isActive é false', () => {
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ isActive: false })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(screen.getByText('form.media.inactiveBadge')).toBeInTheDocument();
      expect(container.querySelector('svg.lucide-power-off')).toBeInTheDocument();
    });

    it('alterna para inativo e chama onChanged em caso de sucesso', async () => {
      const onChanged = vi.fn();
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ isActive: true })]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).toggleActive);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockRequest).toHaveBeenCalledWith({
        url: '/lms/courses/1/images/1/active',
        method: 'PATCH',
        data: { isActive: false },
      });
    });

    it('exibe erro quando a requisição é rejeitada', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).toggleActive);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.fileUploadError')
      );
    });
  });

  describe('removeImage', () => {
    it('não faz nada quando courseId é nulo', () => {
      const { container } = render(
        <CourseImageGallery
          courseId={null}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).removeImage);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('remove a imagem e o arquivo associado, chamando onChanged', async () => {
      const onChanged = vi.fn();
      mockRequest
        .mockResolvedValueOnce({ data: {} }) // delete course image
        .mockResolvedValueOnce({ data: {} }); // delete file
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ fileId: 10 })]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).removeImage);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockRequest).toHaveBeenNthCalledWith(1, {
        url: '/lms/courses/1/images/1',
        method: 'DELETE',
      });
      expect(mockRequest).toHaveBeenNthCalledWith(2, {
        url: '/file',
        method: 'DELETE',
        data: { ids: [10] },
      });
    });

    it('pula a exclusão do arquivo quando fileId é nulo', async () => {
      const onChanged = vi.fn();
      mockRequest.mockResolvedValueOnce({ data: {} });
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ fileId: null })]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).removeImage);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it('tolera falha na exclusão do arquivo órfão e ainda chama onChanged', async () => {
      const onChanged = vi.fn();
      mockRequest
        .mockResolvedValueOnce({ data: {} }) // delete course image succeeds
        .mockRejectedValueOnce(new Error('orphan delete failed')); // file delete fails
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ fileId: 10 })]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).removeImage);
      await waitFor(() => expect(onChanged).toHaveBeenCalled());
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it('exibe erro e não chama onChanged quando a exclusão principal falha', async () => {
      const onChanged = vi.fn();
      mockRequest.mockRejectedValueOnce(new Error('network'));
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={onChanged}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).removeImage);
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith('toasts.fileUploadError')
      );
      expect(onChanged).not.toHaveBeenCalled();
    });
  });

  describe('renderização de preview', () => {
    it('renderiza a imagem quando buildImageUrl retorna uma url', () => {
      mockBuildImageUrl.mockReturnValue('http://x/file/image/10.png');
      render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(screen.getByRole('img')).toHaveAttribute(
        'src',
        'http://x/file/image/10.png'
      );
    });

    it('usa o label como alt quando filename é nulo e há preview', () => {
      mockBuildImageUrl.mockReturnValue('http://x/file/image/10.png');
      render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo do curso"
          spec={baseSpec}
          images={[makeImage({ filename: null })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(screen.getByAltText('Logo do curso')).toBeInTheDocument();
    });

    it('usa "image" como filename padrão do FileTypeIcon quando filename é nulo e não há preview', () => {
      mockBuildImageUrl.mockReturnValue(null);
      render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ filename: null, fileId: null })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(screen.getByTestId('file-type-icon')).toHaveTextContent('image');
    });

    it('renderiza o FileTypeIcon quando não há url de preview', () => {
      mockBuildImageUrl.mockReturnValue(null);
      render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage({ fileId: null })]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      expect(screen.getByTestId('file-type-icon')).toBeInTheDocument();
    });

    it('mostra o overlay de carregamento (busy) enquanto a ação está em andamento', async () => {
      let resolveRequest: (value: unknown) => void = () => {};
      mockRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          })
      );
      const { container } = render(
        <CourseImageGallery
          courseId={1}
          type="logo"
          label="Logo"
          spec={baseSpec}
          images={[makeImage()]}
          onChanged={vi.fn()}
          t={t}
        />
      );
      fireEvent.click(getActionButtons(container).setPrimary);
      await waitFor(() =>
        expect(getActionButtons(container).setPrimary).toBeDisabled()
      );
      expect(
        container.querySelector('.absolute.inset-0 svg.animate-spin')
      ).toBeInTheDocument();
      resolveRequest({ data: {} });
      await waitFor(() =>
        expect(getActionButtons(container).setPrimary).not.toBeDisabled()
      );
    });
  });
});
