'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const RESOLUTION_PRESETS = [
  { label: '480p SD', width: 854, height: 480 },
  { label: '720p HD', width: 1280, height: 720 },
  { label: '1080p Full HD', width: 1920, height: 1080 },
  { label: '1440p QHD', width: 2560, height: 1440 },
  { label: '4K UHD', width: 3840, height: 2160 },
] as const;

type ResolutionPresetLabel = (typeof RESOLUTION_PRESETS)[number]['label'];
type VideoCodec = 'libx264' | 'libx265' | 'vp9';
type AudioCodec = 'aac' | 'mp3' | 'opus';
type EncodingPreset =
  | 'ultrafast'
  | 'superfast'
  | 'veryfast'
  | 'faster'
  | 'fast'
  | 'medium'
  | 'slow'
  | 'slower'
  | 'veryslow';

interface FfmpegFields {
  resolutionPreset: ResolutionPresetLabel | 'custom';
  width: number;
  height: number;
  keepAspectRatio: boolean;
  deinterlace: boolean;
  videoCodec: VideoCodec;
  encodingPreset: EncodingPreset;
  crf: number;
  webOptimized: boolean;
  audioCodec: AudioCodec;
  audioChannels: 1 | 2;
}

const DEFAULT_FIELDS: FfmpegFields = {
  resolutionPreset: '1080p Full HD',
  width: 1920,
  height: 1080,
  keepAspectRatio: true,
  deinterlace: true,
  videoCodec: 'libx264',
  encodingPreset: 'slower',
  crf: 23,
  webOptimized: true,
  audioCodec: 'aac',
  audioChannels: 2,
};

function parseParams(params: string): FfmpegFields {
  const fields = { ...DEFAULT_FIELDS };

  const videoCodecMatch = params.match(/-c:v\s+(\S+)/);
  const videoCodec = videoCodecMatch?.[1];
  if (videoCodec) fields.videoCodec = videoCodec as VideoCodec;

  const presetMatch = params.match(/-preset\s+(\S+)/);
  const encodingPreset = presetMatch?.[1];
  if (encodingPreset) fields.encodingPreset = encodingPreset as EncodingPreset;

  const crfMatch = params.match(/-crf\s+(\d+)/);
  const crf = crfMatch?.[1];
  if (crf) fields.crf = parseInt(crf, 10);

  const audioCodecMatch = params.match(/-c:a\s+(\S+)/);
  const audioCodec = audioCodecMatch?.[1];
  if (audioCodec) fields.audioCodec = audioCodec as AudioCodec;

  const audioChMatch = params.match(/-ac\s+(\d+)/);
  const audioChannels = audioChMatch?.[1];
  if (audioChannels)
    fields.audioChannels = parseInt(audioChannels, 10) as 1 | 2;

  fields.webOptimized = params.includes('+faststart');

  const vfMatch = params.match(/-vf\s+"([^"]+)"/);
  const vf = vfMatch?.[1];
  if (vf) {
    fields.deinterlace = vf.includes('yadif');
    fields.keepAspectRatio = vf.includes('force_original_aspect_ratio');

    const scaleMatch = vf.match(/scale=(\d+)[x:](\d+)/);
    const width = scaleMatch?.[1];
    const height = scaleMatch?.[2];
    if (width && height) {
      fields.width = parseInt(width, 10);
      fields.height = parseInt(height, 10);
      const preset = RESOLUTION_PRESETS.find(
        (p) => p.width === fields.width && p.height === fields.height
      );
      fields.resolutionPreset = preset ? preset.label : 'custom';
    }
  }

  return fields;
}

function serializeFields(fields: FfmpegFields): string {
  const parts: string[] = [];

  const vfFilters: string[] = [];
  if (fields.deinterlace) vfFilters.push('yadif=mode=0');

  if (fields.keepAspectRatio) {
    vfFilters.push(
      `scale=${fields.width}:${fields.height}:force_original_aspect_ratio=decrease,pad=${fields.width}:${fields.height}:(ow-iw)/2:(oh-ih)/2`
    );
  } else {
    vfFilters.push(`scale=${fields.width}:${fields.height}`);
  }

  if (vfFilters.length > 0) {
    parts.push(`-vf "${vfFilters.join(',')}"`);
  }

  parts.push(`-c:v ${fields.videoCodec}`);

  if (fields.videoCodec !== 'vp9') {
    parts.push(`-preset ${fields.encodingPreset}`);
  }

  if (fields.videoCodec === 'libx264') {
    parts.push('-profile:v high -level:v 4.0');
  }

  parts.push(`-crf ${fields.crf}`);

  if (fields.videoCodec === 'libx264') {
    parts.push('-x264-params "aq-mode=2:aq-strength=1.0"');
  }

  parts.push('-fps_mode cfr');

  if (fields.webOptimized) {
    parts.push('-movflags +faststart');
  }

  parts.push(`-c:a ${fields.audioCodec}`);
  parts.push(`-ac ${fields.audioChannels}`);

  return parts.join(' ');
}

function crfQualityLabel(
  crf: number,
  t: ReturnType<typeof useTranslations<'core.FfmpegParamsEditor'>>
): string {
  if (crf <= 15) return t('qualityPerfect');
  if (crf <= 20) return t('qualityVeryHigh');
  if (crf <= 26) return t('qualityHigh');
  if (crf <= 32) return t('qualityMedium');
  if (crf <= 40) return t('qualityLow');
  return t('qualityVeryLow');
}

interface FfmpegParamsEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function FfmpegParamsEditor({
  value,
  onChange,
  className,
}: FfmpegParamsEditorProps) {
  const t = useTranslations('core.FfmpegParamsEditor');
  const isSyncingFromValueRef = useRef(true);

  const [fields, setFields] = useState<FfmpegFields>(() =>
    value ? parseParams(value) : DEFAULT_FIELDS
  );

  useEffect(() => {
    isSyncingFromValueRef.current = true;
    setFields(value ? parseParams(value) : DEFAULT_FIELDS);
  }, [value]);

  useEffect(() => {
    if (isSyncingFromValueRef.current) {
      isSyncingFromValueRef.current = false;
      return;
    }

    const serialized = serializeFields(fields);
    if (serialized !== value) {
      onChange(serialized);
    }
  }, [fields, onChange, value]);

  function update(patch: Partial<FfmpegFields>) {
    setFields((prev) => ({ ...prev, ...patch }));
  }

  function handleResolutionPresetChange(val: string) {
    if (val === 'custom') {
      update({ resolutionPreset: 'custom' });
      return;
    }
    const preset = RESOLUTION_PRESETS.find((p) => p.label === val);
    if (preset) {
      update({
        resolutionPreset: preset.label,
        width: preset.width,
        height: preset.height,
      });
    }
  }

  const videoCodecOptions: { value: VideoCodec; label: string }[] = [
    { value: 'libx264', label: 'H.264 (libx264)' },
    { value: 'libx265', label: 'H.265 / HEVC (libx265)' },
    { value: 'vp9', label: 'VP9' },
  ];

  const encodingPresetOptions: { value: EncodingPreset; label: string }[] = [
    { value: 'ultrafast', label: t('presets.ultrafast') },
    { value: 'superfast', label: t('presets.superfast') },
    { value: 'veryfast', label: t('presets.veryfast') },
    { value: 'faster', label: t('presets.faster') },
    { value: 'fast', label: t('presets.fast') },
    { value: 'medium', label: t('presets.medium') },
    { value: 'slow', label: t('presets.slow') },
    { value: 'slower', label: t('presets.slower') },
    { value: 'veryslow', label: t('presets.veryslow') },
  ];

  const audioCodecOptions: { value: AudioCodec; label: string }[] = [
    { value: 'aac', label: 'AAC' },
    { value: 'mp3', label: 'MP3' },
    { value: 'opus', label: 'Opus' },
  ];

  return (
    <div className={cn('space-y-4 rounded-md border p-3', className)}>
      {/* Resolution */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t('resolution')}</Label>
        <Select
          value={fields.resolutionPreset}
          onValueChange={handleResolutionPresetChange}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTION_PRESETS.map((p) => (
              <SelectItem key={p.label} value={p.label} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
            <SelectItem value="custom" className="text-xs">
              {t('customResolution')}
            </SelectItem>
          </SelectContent>
        </Select>

        {fields.resolutionPreset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('width')} (px)
              </Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={fields.width}
                onChange={(e) =>
                  update({
                    width: parseInt(e.target.value, 10) || fields.width,
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {t('height')} (px)
              </Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={fields.height}
                onChange={(e) =>
                  update({
                    height: parseInt(e.target.value, 10) || fields.height,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Codec + Encoding Preset */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('videoCodec')}</Label>
          <Select
            value={fields.videoCodec}
            onValueChange={(v) => update({ videoCodec: v as VideoCodec })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {videoCodecOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {fields.videoCodec !== 'vp9' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('encodingSpeed')}</Label>
            <Select
              value={fields.encodingPreset}
              onValueChange={(v) =>
                update({ encodingPreset: v as EncodingPreset })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {encodingPresetOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Quality (CRF) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">{t('quality')}</Label>
          <span className="text-xs text-muted-foreground">
            CRF {fields.crf} &mdash; {crfQualityLabel(fields.crf, t)}
          </span>
        </div>
        <Slider
          min={0}
          max={51}
          step={1}
          value={[fields.crf]}
          // Radix's Slider always calls onValueChange with an array whose length
          // matches the `value` prop (here, always exactly one thumb), so `v` is
          // never actually undefined at runtime; the `?? fields.crf` fallback is
          // defensive-only and unreachable through real interaction.
          /* v8 ignore next */
          onValueChange={([v]) => update({ crf: v ?? fields.crf })}
        />
        <div className="flex justify-between text-[0.6rem] text-muted-foreground">
          <span>{t('qualityBest')}</span>
          <span>{t('qualityWorst')}</span>
        </div>
      </div>

      {/* Audio */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('audioCodec')}</Label>
          <Select
            value={fields.audioCodec}
            onValueChange={(v) => update({ audioCodec: v as AudioCodec })}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {audioCodecOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('audioChannels')}</Label>
          <Select
            value={String(fields.audioChannels)}
            onValueChange={(v) =>
              update({ audioChannels: parseInt(v, 10) as 1 | 2 })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1" className="text-xs">
                {t('mono')}
              </SelectItem>
              <SelectItem value="2" className="text-xs">
                {t('stereo')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Switches */}
      <div className="space-y-3 border-t pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-xs font-medium">{t('webOptimized')}</Label>
            <p className="text-[0.65rem] text-muted-foreground leading-tight">
              {t('webOptimizedDescription')}
            </p>
          </div>
          <Switch
            checked={fields.webOptimized}
            onCheckedChange={(v) => update({ webOptimized: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-xs font-medium">
              {t('keepAspectRatio')}
            </Label>
            <p className="text-[0.65rem] text-muted-foreground leading-tight">
              {t('keepAspectRatioDescription')}
            </p>
          </div>
          <Switch
            checked={fields.keepAspectRatio}
            onCheckedChange={(v) => update({ keepAspectRatio: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-xs font-medium">{t('deinterlace')}</Label>
            <p className="text-[0.65rem] text-muted-foreground leading-tight">
              {t('deinterlaceDescription')}
            </p>
          </div>
          <Switch
            checked={fields.deinterlace}
            onCheckedChange={(v) => update({ deinterlace: v })}
          />
        </div>
      </div>
    </div>
  );
}
