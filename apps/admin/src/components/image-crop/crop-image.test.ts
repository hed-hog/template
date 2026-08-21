import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCroppedBlob } from './crop-image';

type Listener = (...args: unknown[]) => void;

class FakeImageBase {
  crossOrigin = '';
  private listeners: Record<string, Listener[]> = {};
  private _src = '';

  addEventListener(type: string, cb: Listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(cb);
  }

  emit(type: string, ...args: unknown[]) {
    (this.listeners[type] || []).forEach((cb) => cb(...args));
  }

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
  }
}

function mockImageSuccess() {
  class FakeImage extends FakeImageBase {
    set src(value: string) {
      // @ts-expect-error accessing base setter via super is awkward with class fields
      super.src = value;
      setTimeout(() => this.emit('load'), 0);
    }
    get src() {
      return super.src;
    }
  }
  // @ts-expect-error test stub does not implement the full HTMLImageElement API
  global.Image = FakeImage;
}

function mockImageError() {
  class FakeImage extends FakeImageBase {
    set src(value: string) {
      // @ts-expect-error accessing base setter via super is awkward with class fields
      super.src = value;
      setTimeout(() => this.emit('error', new Error('load failed')), 0);
    }
    get src() {
      return super.src;
    }
  }
  // @ts-expect-error test stub does not implement the full HTMLImageElement API
  global.Image = FakeImage;
}

describe('getCroppedBlob', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('gera um blob recortado a partir da imagem', async () => {
    mockImageSuccess();
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingQuality: '',
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const fakeBlob = new Blob(['x'], { type: 'image/webp' });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(fakeBlob);
      },
    );

    const blob = await getCroppedBlob(
      'data:fake',
      { x: 1, y: 2, width: 10, height: 20 },
      100,
      50,
    );

    expect(blob).toBe(fakeBlob);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      1,
      2,
      10,
      20,
      0,
      0,
      100,
      50,
    );
  });

  it('rejeita quando a imagem falha ao carregar', async () => {
    mockImageError();

    await expect(
      getCroppedBlob(
        'data:fake',
        { x: 0, y: 0, width: 1, height: 1 },
        10,
        10,
      ),
    ).rejects.toBeDefined();
  });

  it('lança erro quando o contexto 2D não está disponível', async () => {
    mockImageSuccess();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(
      getCroppedBlob(
        'data:fake',
        { x: 0, y: 0, width: 1, height: 1 },
        10,
        10,
      ),
    ).rejects.toThrow('Could not get 2D canvas context');
  });

  it('rejeita quando o canvas retorna um blob nulo', async () => {
    mockImageSuccess();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      imageSmoothingQuality: '',
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(null);
      },
    );

    await expect(
      getCroppedBlob(
        'data:fake',
        { x: 0, y: 0, width: 1, height: 1 },
        10,
        10,
      ),
    ).rejects.toThrow('Canvas toBlob returned null');
  });
});
