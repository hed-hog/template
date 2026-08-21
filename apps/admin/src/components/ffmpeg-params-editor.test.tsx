import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { FfmpegParamsEditor } from './ffmpeg-params-editor';

function selectDom() {
  return document.querySelectorAll('[role="combobox"]');
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    })),
  );
});

describe('FfmpegParamsEditor', () => {
  it('parseia parâmetros existentes e mostra o preset 1080p', () => {
    const onChange = vi.fn();
    render(
      <FfmpegParamsEditor
        value='-vf "yadif=mode=0,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -preset slower -profile:v high -level:v 4.0 -crf 23 -x264-params "aq-mode=2:aq-strength=1.0" -fps_mode cfr -movflags +faststart -c:a aac -ac 2'
        onChange={onChange}
      />,
    );
    expect(screen.getByText('1080p Full HD')).toBeInTheDocument();
  });

  it('usa os valores padrão quando o value é vazio', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    expect(screen.getByText('1080p Full HD')).toBeInTheDocument();
    expect(screen.getByText(/qualityHigh/)).toBeInTheDocument();
  });

  it('reparse ao mudar a prop value', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FfmpegParamsEditor value="" onChange={onChange} />,
    );
    rerender(
      <FfmpegParamsEditor
        value="-c:v vp9 -crf 10 -c:a opus -ac 1"
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/qualityPerfect/)).toBeInTheDocument();
  });

  it('troca a resolução para um preset diferente', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} className="extra" />);

    const [resolutionTrigger] = selectDom();
    fireEvent.click(resolutionTrigger);
    fireEvent.click(screen.getByText('720p HD'));

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toContain('scale=1280:720');
  });

  it('troca para resolução customizada e edita largura/altura', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);

    const [resolutionTrigger] = selectDom();
    fireEvent.click(resolutionTrigger);
    fireEvent.click(screen.getByText('customResolution'));

    const widthInput = screen.getByDisplayValue('1920');
    fireEvent.change(widthInput, { target: { value: '640' } });
    const heightInput = screen.getByDisplayValue('1080');
    fireEvent.change(heightInput, { target: { value: '480' } });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toContain('scale=640:480');
  });

  it('mantém a largura/altura quando o input fica inválido', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const [resolutionTrigger] = selectDom();
    fireEvent.click(resolutionTrigger);
    fireEvent.click(screen.getByText('customResolution'));

    const widthInput = screen.getByDisplayValue('1920');
    fireEvent.change(widthInput, { target: { value: '' } });
    expect((widthInput as HTMLInputElement).value).toBe('1920');

    const heightInput = screen.getByDisplayValue('1080');
    fireEvent.change(heightInput, { target: { value: '' } });
    expect((heightInput as HTMLInputElement).value).toBe('1080');
  });

  it('desliga keepAspectRatio e usa scale simples na serialização', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const keepAspectSwitch = screen.getByText('keepAspectRatio').closest('div')!
      .parentElement!.querySelector('button[role="switch"]') as HTMLElement;
    fireEvent.click(keepAspectSwitch);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // deinterlace remains on by default, so only the aspect-ratio scale filter drops.
    expect(last).toContain('-vf "yadif=mode=0,scale=1920:1080"');
    expect(last).not.toContain('force_original_aspect_ratio');
  });

  it('troca o codec de vídeo para vp9 (oculta encoding preset e profile)', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const [, videoCodecTrigger] = selectDom();
    fireEvent.click(videoCodecTrigger);
    fireEvent.click(screen.getByText('VP9'));

    expect(screen.queryByText('encodingSpeed')).not.toBeInTheDocument();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).not.toContain('-preset');
    expect(last).not.toContain('-profile:v');
  });

  it('troca o encoding preset', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const [, , encodingTrigger] = selectDom();
    fireEvent.click(encodingTrigger);
    fireEvent.click(screen.getByText('presets.fast'));
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toContain('-preset fast');
  });

  it('move o slider de qualidade (CRF) e reflete o label', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const slider = document.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalled();
  });

  it('troca o codec de áudio e o número de canais', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const triggers = selectDom();
    const audioCodecTrigger = triggers[triggers.length - 2];
    fireEvent.click(audioCodecTrigger);
    fireEvent.click(screen.getByText('MP3'));
    let last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toContain('-c:a mp3');

    const channelsTrigger = selectDom()[selectDom().length - 1];
    fireEvent.click(channelsTrigger);
    fireEvent.click(screen.getByText('mono'));
    last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toContain('-ac 1');
  });

  it('desliga webOptimized (remove +faststart)', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const webOptimizedSwitch = screen
      .getByText('webOptimized')
      .closest('div')!
      .parentElement!.querySelector('button[role="switch"]') as HTMLElement;
    fireEvent.click(webOptimizedSwitch);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).not.toContain('+faststart');
  });

  it('desliga deinterlace (remove yadif)', () => {
    const onChange = vi.fn();
    render(<FfmpegParamsEditor value="" onChange={onChange} />);
    const deinterlaceSwitch = screen
      .getByText('deinterlace')
      .closest('div')!
      .parentElement!.querySelector('button[role="switch"]') as HTMLElement;
    fireEvent.click(deinterlaceSwitch);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).not.toContain('yadif');
  });

  it('classifica os vários níveis de qualidade do CRF', () => {
    const onChange = vi.fn();
    // very low quality (crf 45 -> "qualityVeryLow")
    render(
      <FfmpegParamsEditor value="-c:v libx264 -crf 45" onChange={onChange} />,
    );
    expect(screen.getByText(/qualityVeryLow/)).toBeInTheDocument();
  });

  it('classifica crf 18 como qualityVeryHigh', () => {
    render(
      <FfmpegParamsEditor value="-c:v libx264 -crf 18" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/qualityVeryHigh/)).toBeInTheDocument();
  });

  it('classifica crf 30 como qualityMedium', () => {
    render(
      <FfmpegParamsEditor value="-c:v libx264 -crf 30" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/qualityMedium/)).toBeInTheDocument();
  });

  it('marca resolução como customResolution ao parsear um scale que não bate com nenhum preset', () => {
    const onChange = vi.fn();
    render(
      <FfmpegParamsEditor
        value='-vf "scale=640:480" -c:v libx264 -crf 23'
        onChange={onChange}
      />,
    );
    expect(screen.getByText('customResolution')).toBeInTheDocument();
  });

  it('classifica crf 38 como qualityLow', () => {
    render(
      <FfmpegParamsEditor value="-c:v libx264 -crf 38" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/qualityLow/)).toBeInTheDocument();
  });
});
