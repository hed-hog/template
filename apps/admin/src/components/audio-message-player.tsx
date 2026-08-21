'use client';

import { cn } from '@/lib/utils';
import { Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Quantidade de barras da forma de onda. Fixa, para o player não mudar de largura. */
const BAR_COUNT = 40;

type AudioMessagePlayerProps = {
  url: string;
  /** Rótulos já traduzidos — o componente é genérico e não conhece namespace. */
  labels: { play: string; pause: string };
  className?: string;
  /** Chamado quando o áudio não toca neste navegador (codec não suportado). */
  onUnsupported?: () => void;
};

/**
 * Player embutido para a nota de voz de uma conversa.
 *
 * A forma de onda é decodificada do próprio arquivo (Web Audio), então ela
 * corresponde ao áudio de verdade em vez de ser um enfeite. A decodificação é
 * best-effort: quando falha — Ogg/Opus no Safari, por exemplo — sobra o player
 * com barras planas, e se nem tocar o `onUnsupported` deixa quem chamou voltar
 * para o link do arquivo.
 */
export function AudioMessagePlayer({
  url,
  labels,
  className,
  onUnsupported,
}: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);

  // Decodificar o arquivo dá a forma de onda e, de quebra, a duração exata: o
  // Ogg do WhatsApp costuma chegar sem duração no cabeçalho, e sem isto o
  // elemento de áudio reporta `Infinity` até alguém arrastar até o fim.
  useEffect(() => {
    let active = true;

    if (typeof window === 'undefined' || !window.AudioContext) return;

    const context = new window.AudioContext();

    (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) return;

        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!active) return;

        setPeaks(extractPeaks(buffer, BAR_COUNT));
        setDuration(buffer.duration);
      } catch {
        // Sem forma de onda o player continua de pé; o áudio é que manda.
      } finally {
        void context.close().catch(() => undefined);
      }
    })();

    return () => {
      active = false;
      void context.close().catch(() => undefined);
    };
  }, [url]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().catch(() => onUnsupported?.());
    } else {
      audio.pause();
    }
  }, [onUnsupported]);

  const seek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;

      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - bounds.left) / bounds.width;

      audio.currentTime = Math.min(Math.max(ratio, 0), 1) * duration;
    },
    [duration],
  );

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const bars = useMemo(
    () => peaks ?? new Array(BAR_COUNT).fill(0.35),
    [peaks],
  );

  return (
    <div
      className={cn(
        'flex w-full max-w-sm items-center gap-3 rounded-full border bg-background px-3 py-2',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? labels.pause : labels.play}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          // Deslocado 1px: um triângulo centrado pelo retângulo parece torto.
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>

      <div
        onClick={seek}
        className="flex h-8 flex-1 cursor-pointer items-center gap-px"
      >
        {bars.map((peak, index) => {
          const played = index / bars.length < progress;

          return (
            <span
              key={index}
              // `max` evita a barra de altura zero no silêncio, que deixaria
              // buracos no meio da onda.
              style={{ height: `${Math.max(peak, 0.12) * 100}%` }}
              className={cn(
                'w-full rounded-full transition-colors',
                played ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
            />
          );
        })}
      </div>

      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatTime(playing || currentTime > 0 ? currentTime : duration)}
      </span>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          // Só aceita o que o elemento reporta quando for um número util: no
          // Ogg sem cabeçalho de duração ele manda `Infinity`, e a duração boa
          // é a que veio da decodificação.
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => onUnsupported?.()}
      />
    </div>
  );
}

/**
 * Reduz o áudio a uma barra por trecho, usando o pico de cada um.
 *
 * Pico e não média: a média de uma fala achata tudo num traço quase reto,
 * enquanto o pico preserva o desenho de sílabas e pausas que se espera ver.
 */
function extractPeaks(buffer: AudioBuffer, bars: number): number[] {
  const samples = buffer.getChannelData(0);
  const blockSize = Math.floor(samples.length / bars) || 1;
  const peaks: number[] = [];

  for (let index = 0; index < bars; index += 1) {
    const start = index * blockSize;
    let peak = 0;

    for (let offset = 0; offset < blockSize; offset += 1) {
      const value = Math.abs(samples[start + offset] ?? 0);
      if (value > peak) peak = value;
    }

    peaks.push(peak);
  }

  // Normaliza pelo trecho mais alto: uma gravação baixinha renderizaria uma
  // linha reta se as alturas fossem absolutas.
  const loudest = Math.max(...peaks, 0.01);

  return peaks.map((peak) => peak / loudest);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);

  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
