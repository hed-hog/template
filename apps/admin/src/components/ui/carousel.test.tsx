import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const scrollPrev = vi.fn();
const scrollNext = vi.fn();
const canScrollPrev = vi.fn(() => false);
const canScrollNext = vi.fn(() => true);
const on = vi.fn();
const off = vi.fn();
const carouselRefCallback = vi.fn();

let mockApi: any = {
  scrollPrev,
  scrollNext,
  canScrollPrev,
  canScrollNext,
  on,
  off,
};

vi.mock('embla-carousel-react', () => ({
  default: vi.fn((options: unknown, plugins: unknown) => [
    carouselRefCallback,
    mockApi,
  ]),
}));

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel';

function BasicCarousel(props: Partial<React.ComponentProps<typeof Carousel>> = {}) {
  return (
    <Carousel {...props}>
      <CarouselContent>
        <CarouselItem>Slide 1</CarouselItem>
        <CarouselItem>Slide 2</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

describe('Carousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canScrollPrev.mockReturnValue(false);
    canScrollNext.mockReturnValue(true);
    mockApi = {
      scrollPrev,
      scrollNext,
      canScrollPrev,
      canScrollNext,
      on,
      off,
    };
  });

  it('renderiza slides e região com role carousel', () => {
    render(<BasicCarousel />);
    expect(screen.getByRole('region')).toBeInTheDocument();
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
    expect(screen.getByText('Slide 2')).toBeInTheDocument();
  });

  it('desabilita o botão anterior quando canScrollPrev é falso e habilita o próximo', () => {
    render(<BasicCarousel />);
    expect(screen.getByText('Previous slide').closest('button')).toBeDisabled();
    expect(screen.getByText('Next slide').closest('button')).toBeEnabled();
  });

  it('chama scrollPrev/scrollNext ao clicar nos botões', () => {
    canScrollPrev.mockReturnValue(true);
    render(<BasicCarousel />);

    fireEvent.click(screen.getByText('Next slide').closest('button')!);
    expect(scrollNext).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Previous slide').closest('button')!);
    expect(scrollPrev).toHaveBeenCalled();
  });

  it('responde à navegação por teclado (ArrowLeft/ArrowRight)', () => {
    canScrollPrev.mockReturnValue(true);
    render(<BasicCarousel />);

    const region = screen.getByRole('region');
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(scrollNext).toHaveBeenCalled();

    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(scrollPrev).toHaveBeenCalled();

    fireEvent.keyDown(region, { key: 'Enter' });
  });

  it('renderiza orientação vertical aplicando classes e rotação nos botões', () => {
    render(<BasicCarousel orientation="vertical" />);
    const prevButton = screen.getByText('Previous slide').closest('button')!;
    const nextButton = screen.getByText('Next slide').closest('button')!;
    expect(prevButton.className).toContain('rotate-90');
    expect(nextButton.className).toContain('rotate-90');
  });

  it('chama setApi quando fornecido', () => {
    const setApi = vi.fn();
    render(<BasicCarousel setApi={setApi} />);
    expect(setApi).toHaveBeenCalledWith(mockApi);
  });

  it('lança erro se CarouselContent for usado fora do contexto de Carousel', () => {
    // Suppress console.error from React error boundary logging
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<CarouselContent />)).toThrow(
      'useCarousel must be used within a <Carousel />',
    );
    spy.mockRestore();
  });

  it('aplica className customizado ao container', () => {
    render(<BasicCarousel className="custom-carousel" />);
    expect(
      screen.getByRole('region'),
    ).toHaveClass('custom-carousel');
  });

  it('não quebra quando a api do embla ainda não está disponível (null)', () => {
    mockApi = null;
    const setApi = vi.fn();
    render(<BasicCarousel setApi={setApi} />);

    // useEffect early-returns when api is falsy, so setApi/on are never called
    expect(setApi).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });

  it('onSelect ignora chamadas quando a api recebida é falsy', () => {
    render(<BasicCarousel />);

    // Grab the "select" listener registered via api.on and invoke it with no api,
    // exercising the internal `if (!api) return` guard inside onSelect.
    const selectCall = on.mock.calls.find(([event]) => event === 'select');
    expect(selectCall).toBeDefined();
    const onSelect = selectCall![1];

    expect(() => onSelect(undefined)).not.toThrow();
  });

  it('resolve orientation a partir de opts.axis quando orientation não é fornecida', () => {
    render(<BasicCarousel orientation={'' as any} opts={{ axis: 'y' }} />);
    const prevButton = screen.getByText('Previous slide').closest('button')!;
    expect(prevButton.className).toContain('rotate-90');
  });

  it('assume horizontal quando orientation não é fornecida e opts.axis não é "y"', () => {
    render(<BasicCarousel orientation={'' as any} opts={{ axis: 'x' }} />);
    const prevButton = screen.getByText('Previous slide').closest('button')!;
    expect(prevButton.className).not.toContain('rotate-90');
  });
});
