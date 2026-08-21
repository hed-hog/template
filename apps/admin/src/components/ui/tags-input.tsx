import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { X as IconX } from 'lucide-react';
import * as React from 'react';

export interface TagsInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> {
  value?: string[];
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
}

const TagsInput = React.forwardRef<HTMLInputElement, TagsInputProps>(
  ({ className, value, onChange, defaultValue = [], ...props }, ref) => {
    const [internalValue, setInternalValue] =
      React.useState<string[]>(defaultValue);
    const [inputValue, setInputValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const isControlled = value !== undefined;
    const tags = isControlled ? value : internalValue;

    const updateTags = (newTags: string[]) => {
      if (!isControlled) {
        setInternalValue(newTags);
      }
      onChange?.(newTags);
    };

    const addTag = (tag: string) => {
      const trimmedTag = tag.trim();
      if (trimmedTag && !tags.includes(trimmedTag)) {
        updateTags([...tags, trimmedTag]);
      }
      setInputValue('');
    };

    const removeTag = (indexToRemove: number) => {
      updateTags(tags.filter((_, index) => index !== indexToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      } else if (e.key === ',') {
        e.preventDefault();
        addTag(inputValue);
      }
    };

    const handleBlur = () => {
      if (inputValue) {
        addTag(inputValue);
      }
    };

    const handleContainerClick = () => {
      inputRef.current?.focus();
    };

    return (
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-3 py-1.5 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
      >
        {tags.map((tag, index) => (
          <Badge key={index} variant="secondary" className="gap-1 pr-1">
            <span>{tag}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(index);
                  }}
                  className="hover:bg-secondary-foreground/20 rounded-full p-0.5 transition-colors"
                  aria-label={`Remove ${tag}`}
                >
                  <IconX className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{`Remove ${tag}`}</p>
              </TooltipContent>
            </Tooltip>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="placeholder:text-muted-foreground min-w-30 flex-1 bg-transparent outline-none"
          {...props}
        />
      </div>
    );
  }
);

TagsInput.displayName = 'TagsInput';

export { TagsInput };
