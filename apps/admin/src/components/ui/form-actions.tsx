'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { SheetFooter } from './sheet';

type FormActionsProps = {
  cancelLabel?: React.ReactNode;
  className?: string;
  cancelSize?: React.ComponentProps<typeof Button>['size'];
  onCancel?: () => void;
  onSubmit?: () => void;
  sheet?: boolean;
  sheetClassName?: string;
  statusContent?: React.ReactNode;
  submitDisabled?: boolean;
  submitIcon?: React.ReactNode;
  submitLabel: React.ReactNode;
  submitSize?: React.ComponentProps<typeof Button>['size'];
  submitType?: React.ComponentProps<typeof Button>['type'];
};

function FormActions({
  cancelLabel = 'Cancel',
  className,
  cancelSize,
  onCancel,
  onSubmit,
  sheet = false,
  sheetClassName,
  statusContent,
  submitDisabled,
  submitIcon,
  submitLabel,
  submitSize = 'default',
  submitType = 'button',
}: FormActionsProps) {
  const content = (
    <div
      className={cn(
        'flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-h-5 text-xs text-muted-foreground">
        {statusContent}
      </div>

      <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:max-w-md sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            size={cancelSize ?? submitSize}
            className="w-full sm:min-w-28 sm:w-auto"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type={submitType}
          size={submitSize}
          className="w-full sm:min-w-28 sm:w-auto"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitIcon}
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  if (sheet) {
    return (
      <SheetFooter
        className={cn(
          'sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur',
          sheetClassName
        )}
      >
        {content}
      </SheetFooter>
    );
  }

  return content;
}

export { FormActions };
