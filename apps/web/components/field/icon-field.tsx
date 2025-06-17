'use client';

import * as React from 'react';
import { IconCheck, IconUpload, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export interface IconSelectorProps {
  value?: string;
  onChange?: (value: string) => void;
  size?: number;
  className?: string;
  disabled?: boolean;
  defaultIcons?: string[];
  acceptedFileTypes?: string;
  helperText?: string;
}

export function IconSelector({
  value = '',
  onChange,
  size = 64,
  className,
  disabled = false,
  defaultIcons = [],
  acceptedFileTypes = 'image/*',
  helperText = '',
}: IconSelectorProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);

  const handleIconSelect = (iconUrl: string) => {
    if (typeof onChange === 'function') {
      onChange(iconUrl);
    }
    setOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          if (typeof onChange === 'function') {
            onChange(event.target.result as string);
          }
          setOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (defaultIcons.length === 0) {
    return (
      <div>
        <Button
          variant="outline"
          className={cn(
            'p-0 overflow-hidden border-2 transition-all',
            'hover:border-primary hover:shadow-md active:scale-95',
            'dark:bg-slate-950 dark:hover:bg-slate-900',
            'bg-white hover:bg-slate-50',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
          disabled={disabled}
          style={{ width: size, height: size }}
          onClick={() => fileInputRef.current?.click()}
        >
          {value ? (
            <img
              src={value || '/placeholder.svg'}
              alt="Selected icon"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              <IconUpload size={size / 3} />
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={acceptedFileTypes}
            onChange={handleFileChange}
          />
        </Button>
      </div>
    );
  } else {
    return (
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'p-0 overflow-hidden border-2 transition-all',
                'hover:border-primary hover:shadow-md active:scale-95',
                'dark:bg-slate-950 dark:hover:bg-slate-900',
                'bg-white hover:bg-slate-50',
                disabled && 'opacity-50 cursor-not-allowed',
                className,
              )}
              disabled={disabled}
              style={{ width: size, height: size }}
            >
              {value ? (
                <img
                  src={value || '/placeholder.svg'}
                  alt="Selected icon"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                  <IconUpload size={size / 3} />
                </div>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3">
            <div className="space-y-4">
              {defaultIcons && (
                <>
                  <div className="text-sm font-medium">Selecione um ícone</div>
                  <div className="grid grid-cols-3 gap-2">
                    {defaultIcons.map((icon, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className={cn(
                          'p-0 h-16 w-16 relative',
                          value === icon &&
                            'border-primary ring-2 ring-primary/20',
                        )}
                        onClick={() => handleIconSelect(icon)}
                      >
                        <img
                          src={icon || '/placeholder.svg'}
                          alt={`Icon ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {value === icon && (
                          <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                            <IconCheck className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </Button>
                    ))}
                  </div>
                </>
              )}
              <div className="flex flex-col space-y-2">
                <div className="text-sm font-medium">Ou faça upload</div>
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconUpload className="mr-2 h-4 w-4" />
                    Escolher arquivo
                  </Button>
                  {value && value.startsWith('data:') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-2"
                      onClick={() => {
                        if (typeof onChange === 'function') {
                          onChange('');
                        }
                      }}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept={acceptedFileTypes}
                  onChange={handleFileChange}
                />
                {helperText && (
                  <p className="text-xs text-muted-foreground">{helperText}</p>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
}

// Componente para uso dentro de formulários
export interface IconFormFieldProps {
  name: string;
  control: any;
  label?: string;
  description?: string;
  size?: number;
  disabled?: boolean;
  className?: string;
  accept?: string;
  helperText?: string;
}

export function IconFormField({
  name,
  control,
  label,
  description,
  size = 64,
  disabled,
  className,
  accept = 'image/*',
  helperText,
}: IconFormFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>
            <IconSelector
              value={field.value}
              onChange={field.onChange}
              size={size}
              disabled={disabled}
              acceptedFileTypes={accept}
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
export interface StandaloneIconSelectorProps {
  label?: string;
  description?: string;
  size?: number;
  disabled?: boolean;
  className?: string;
  value: string;
  onChange: (value: string) => void;
}

export function IconField({
  label,
  description,
  size = 64,
  disabled,
  className,
  value,
  onChange,
}: StandaloneIconSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </div>
      )}
      <IconSelector
        value={value}
        onChange={onChange}
        size={size}
        disabled={disabled}
      />
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
