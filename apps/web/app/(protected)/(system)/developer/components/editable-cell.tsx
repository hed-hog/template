'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import type { ColumnMeta } from './grid-types.jsx';

interface EditableCellProps {
  value: any;
  column: ColumnMeta;
  onSave: (newValue: any) => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  column,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value); // Sync with external changes
  }, [value]);

  useEffect(() => {
    if (isEditing) {
      if (column.dataType === 'string' && column.key === 'bio') {
        // Example for textarea
        textareaRef.current?.focus();
        textareaRef.current?.select();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [isEditing, column.dataType, column.key]);

  const handleSave = () => {
    if (currentValue !== value) {
      // Only save if changed
      let finalValue = currentValue;
      if (column.dataType === 'number') {
        finalValue = Number.parseFloat(currentValue);
        if (isNaN(finalValue)) finalValue = column.defaultValue; // or handle error
      }
      onSave(finalValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setCurrentValue(value); // Revert
      setIsEditing(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setCurrentValue(e.target.value);
  };

  if (!isEditing) {
    return (
      <div
        className="w-full h-full px-2 py-1.5 truncate cursor-pointer flex items-center"
        onClick={() => setIsEditing(true)}
        title={String(value !== null && value !== undefined ? value : '')}
      >
        {column.dataType === 'boolean' ? (
          <Checkbox
            checked={!!value}
            disabled
            className="pointer-events-none"
          />
        ) : (
          String(value !== null && value !== undefined ? value : '')
        )}
      </div>
    );
  }

  // Edit Mode
  switch (column.dataType) {
    case 'number':
      return (
        <Input
          ref={inputRef}
          type="number"
          value={currentValue || ''}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-sm p-1.5 border-primary"
        />
      );
    case 'boolean':
      return (
        <div className="w-full h-full flex items-center justify-center p-1.5">
          <Checkbox
            checked={!!currentValue}
            onCheckedChange={(checked) => {
              const newVal = typeof checked === 'boolean' ? checked : false;
              setCurrentValue(newVal);
              onSave(newVal); // Save immediately for checkboxes
              setIsEditing(false);
            }}
            autoFocus
          />
        </div>
      );
    case 'date':
      return (
        <Input
          ref={inputRef}
          type="date"
          value={currentValue || ''}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-sm p-1.5 border-primary"
        />
      );
    case 'string':
      // Example: Use textarea for 'bio' column
      if (column.key === 'bio') {
        return (
          <textarea
            ref={textareaRef}
            value={currentValue || ''}
            onChange={handleChange}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full h-full text-sm p-1.5 border-primary rounded-md resize-none bg-background"
            rows={2}
          />
        );
      }
      return (
        <Input
          ref={inputRef}
          type="text"
          value={currentValue || ''}
          onChange={handleChange}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-sm p-1.5 border-primary"
        />
      );
    default:
      return <div className="p-1.5">{String(value)}</div>;
  }
};
