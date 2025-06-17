'use client';

import * as React from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export interface ImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
  width?: number;
  height?: number;
  className?: string;
  disabled?: boolean;
  accept?: string;
  helperText?: string;
}

export function ImageUploader({
  value,
  onChange,
  width = 200,
  height = 150,
  className,
  disabled = false,
  accept = 'image/*',
  helperText,
}: ImageUploaderProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onChange(event.target.result as string);
          setOpen(false);
          // Limpar o input para permitir selecionar o mesmo arquivo novamente
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <Button
      variant="outline"
      className={cn(
        'p-0 overflow-hidden border-2 transition-all relative group',
        'hover:border-primary hover:shadow-md active:scale-95',
        'dark:bg-slate-950 dark:hover:bg-slate-900',
        'bg-white hover:bg-slate-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      disabled={disabled}
      style={{ width, height }}
    >
      {value ? (
        <>
          <img
            src={value || '/placeholder.svg'}
            alt="Uploaded image"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div
              className="h-8 w-8 rounded-full bg-white flex items-center justify-center cursor-pointer hover:bg-red-500 hover:text-white transition-colors"
              onClick={handleClearImage}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remover imagem</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            className="flex flex-col items-center justify-center w-full h-full text-muted-foreground p-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 mb-2" />
            <span className="text-xs text-center">
              Clique para fazer upload
            </span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={accept}
            onChange={handleFileChange}
          />
        </>
      )}
    </Button>
  );
}

// Componente para uso dentro de formulários
export interface ImageFormFieldProps {
  name: string;
  control: any;
  label?: string;
  description?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
  className?: string;
  accept?: string;
  helperText?: string;
}

export function ImageFormField({
  name,
  control,
  label,
  description,
  width = 200,
  height = 150,
  disabled,
  className,
  accept,
  helperText,
}: ImageFormFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn('flex-col', className)}>
          {label && <FormLabel className="flex">{label}</FormLabel>}
          <FormControl>
            <ImageUploader
              value={field.value}
              onChange={field.onChange}
              width={width}
              height={height}
              disabled={disabled}
              accept={accept}
              helperText={helperText}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Componente para uso independente (fora de formulários)
export interface StandaloneImageUploaderProps {
  label?: string;
  description?: string;
  width?: number;
  height?: number;
  disabled?: boolean;
  className?: string;
  value: string;
  onChange: (fila: File | null, value: string) => void;
  accept?: string;
}
