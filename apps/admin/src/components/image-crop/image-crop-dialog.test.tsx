import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Area } from 'react-easy-crop';

vi.mock('react-easy-crop', () => ({
  default: (props: {
    onCropComplete: (area: Area, pixels: Area) => void;
  }) => (
    <button
      type="button"
      data-testid="cropper"
      onClick={() =>
        props.onCropComplete(
          { x: 0, y: 0, width: 1, height: 1 },
          { x: 1, y: 1, width: 10, height: 10 },
        )
      }
    >
      cropper
    </button>
  ),
}));

const getCroppedBlobMock = vi.fn();
vi.mock('./crop-image', () => ({
  getCroppedBlob: (...args: unknown[]) => getCroppedBlobMock(...args),
}));

import { ImageCropDialog } from './image-crop-dialog';

function makeFile(name = 'photo.png') {
  return new File(['data'], name, { type: 'image/png' });
}

describe('ImageCropDialog', () => {
  beforeEach(() => {
    getCroppedBlobMock.mockReset();
    global.URL.createObjectURL = vi.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('não renderiza o cropper quando não há arquivo', () => {
    render(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={null}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={() => {}}
      />,
    );

    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument();
  });

  it('usa título/rótulos padrão e omite a descrição quando não informados', () => {
    render(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        aspect={1}
        outputWidth={50}
        outputHeight={50}
        onCropped={() => {}}
      />,
    );

    expect(screen.getByText('Recortar imagem')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Aplicar' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom')).toBeInTheDocument();
    expect(screen.getByTestId('cropper')).toBeInTheDocument();
  });

  it('renderiza título/descrição customizados e o botão confirmar inicia desabilitado', () => {
    render(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        title="Ajustar foto"
        description="Recorte sua foto"
        confirmLabel="Confirmar"
        cancelLabel="Voltar"
        zoomLabel="Ampliar"
        onCropped={() => {}}
      />,
    );

    expect(screen.getByText('Ajustar foto')).toBeInTheDocument();
    expect(screen.getByText('Recorte sua foto')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirmar' }),
    ).toBeDisabled();
  });

  it('habilita confirmar após o crop completo, atualiza o zoom e aplica o recorte', async () => {
    const fakeBlob = new Blob(['x']);
    getCroppedBlobMock.mockResolvedValue(fakeBlob);
    const onOpenChange = vi.fn();
    const onCropped = vi.fn();

    render(
      <ImageCropDialog
        open={true}
        onOpenChange={onOpenChange}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        zoomLabel="Ampliar"
        onCropped={onCropped}
      />,
    );

    fireEvent.click(screen.getByTestId('cropper'));

    const confirmButton = screen.getByRole('button', { name: 'Aplicar' });
    await waitFor(() => expect(confirmButton).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Ampliar'), {
      target: { value: '2' },
    });
    expect((screen.getByLabelText('Ampliar') as HTMLInputElement).value).toBe(
      '2',
    );

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(getCroppedBlobMock).toHaveBeenCalledWith(
        'blob:fake',
        { x: 1, y: 1, width: 10, height: 10 },
        100,
        100,
      );
      expect(onCropped).toHaveBeenCalledWith(fakeBlob);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('não aplica o recorte quando não há imagem ou área definida', async () => {
    const onCropped = vi.fn();
    render(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={onCropped}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'Aplicar' });
    expect(confirmButton).toBeDisabled();
    // handleConfirm returns early because areaPixels is still null.
    fireEvent.click(confirmButton);
    expect(getCroppedBlobMock).not.toHaveBeenCalled();
    expect(onCropped).not.toHaveBeenCalled();
  });

  it('não confirma quando o arquivo é removido após o crop (imageSrc nulo)', () => {
    // The reset effect only clears imageSrc when `file` becomes null, but
    // does not reset an already-captured areaPixels — so the Confirm button
    // can become enabled again with a stale crop and no image. handleConfirm
    // must guard on `!imageSrc` in that case.
    const { rerender } = render(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('cropper'));

    rerender(
      <ImageCropDialog
        open={true}
        onOpenChange={() => {}}
        file={null}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={() => {}}
      />,
    );

    expect(screen.queryByTestId('cropper')).not.toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Aplicar' });
    fireEvent.click(confirmButton);

    expect(getCroppedBlobMock).not.toHaveBeenCalled();
  });

  it('chama onOpenChange(false) ao clicar em cancelar', () => {
    const onOpenChange = vi.fn();
    render(
      <ImageCropDialog
        open={true}
        onOpenChange={onOpenChange}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('bloqueia o fechamento pelo Dialog enquanto processa e permite depois', async () => {
    let resolveBlob: (blob: Blob) => void = () => {};
    getCroppedBlobMock.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveBlob = resolve;
        }),
    );
    const onOpenChange = vi.fn();

    render(
      <ImageCropDialog
        open={true}
        onOpenChange={onOpenChange}
        file={makeFile()}
        aspect={1}
        outputWidth={100}
        outputHeight={100}
        onCropped={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('cropper'));
    const confirmButton = await screen.findByRole('button', {
      name: 'Aplicar',
    });
    await waitFor(() => expect(confirmButton).toBeEnabled());

    fireEvent.click(confirmButton);

    // While processing, Escape must not bubble up to onOpenChange.
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).not.toHaveBeenCalled();

    resolveBlob(new Blob(['x']));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    onOpenChange.mockClear();

    // Once processing is finished, Escape should propagate again.
    fireEvent.keyDown(screen.getByRole('dialog'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
