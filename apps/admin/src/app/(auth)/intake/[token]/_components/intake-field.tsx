'use client';

import { RichTextEditor } from '@/components/rich-text-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  IntakeAnswer,
  IntakeField as IntakeFieldDefinition,
  htmlToText,
  maxLengthOf,
} from './intake-types';

type Props = {
  field: IntakeFieldDefinition;
  value: IntakeAnswer;
  onChange: (value: IntakeAnswer) => void;
  /** Imagem colada ou arrastada no richtext vira anexo, e nao HTML. */
  onPasteFiles: (files: File[]) => void;
};

const INPUT_TYPE: Partial<Record<IntakeFieldDefinition['type'], string>> = {
  text: 'text',
  email: 'email',
  phone: 'tel',
  url: 'url',
  number: 'number',
  date: 'date',
};

/** Um campo do formulario publico, desenhado conforme o tipo configurado. */
export function IntakeField({ field, value, onChange, onPasteFiles }: Props) {
  const id = `intake-field-${field.slug}`;
  const max = maxLengthOf(field);
  const text = typeof value === 'string' ? value : '';

  const counter =
    max && ['text', 'textarea', 'richtext'].includes(field.type)
      ? `${(field.type === 'richtext' ? htmlToText(text) : text).length}/${max}`
      : null;

  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.isRequired && <span className="text-destructive"> *</span>}
    </Label>
  );

  if (field.type === 'checkbox') {
    return (
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            className="mt-0.5"
          />
          {label}
        </div>
        <HelpText text={field.helpText} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label}
      {renderControl()}
      {(field.helpText || counter) && (
        <div className="flex items-start justify-between gap-3">
          <HelpText text={field.helpText} />
          {counter && (
            <p className="ml-auto shrink-0 text-xs text-muted-foreground">
              {counter}
            </p>
          )}
        </div>
      )}
    </div>
  );

  function renderControl() {
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={id}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            rows={6}
            maxLength={max ?? undefined}
            placeholder={field.placeholder ?? undefined}
          />
        );

      case 'richtext':
        return (
          <RichTextEditor
            value={text}
            onChange={onChange}
            placeholder={field.placeholder ?? undefined}
            showImageButton={false}
            disableAi
            onPasteFiles={onPasteFiles}
            editorClassName="min-h-40"
          />
        );

      case 'select':
        return (
          <Select value={text || undefined} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={field.placeholder ?? 'Selecione'} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={text} onValueChange={onChange} id={id}>
            {field.options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <RadioGroupItem
                  value={option.value}
                  id={`${id}-${option.value}`}
                />
                <Label
                  htmlFor={`${id}-${option.value}`}
                  className="cursor-pointer font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'multiselect': {
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="grid gap-2 sm:grid-cols-2" id={id}>
            {field.options.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${option.value}`}
                  checked={selected.includes(option.value)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value),
                    )
                  }
                />
                <Label
                  htmlFor={`${id}-${option.value}`}
                  className="cursor-pointer font-normal"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );
      }

      default:
        return (
          <Input
            id={id}
            type={INPUT_TYPE[field.type] ?? 'text'}
            value={text}
            onChange={(event) => onChange(event.target.value)}
            maxLength={max ?? undefined}
            placeholder={field.placeholder ?? undefined}
          />
        );
    }
  }
}

function HelpText({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
