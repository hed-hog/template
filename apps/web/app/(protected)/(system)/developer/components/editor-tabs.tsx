'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

import type { Tab } from '../types';
import { useRef } from 'react';

interface EditorTabsProps {
  tabs: Tab[];
  activeTabId: string | null | undefined;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}: EditorTabsProps) {
  const scrollArea = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="border-b">
      <div
        ref={scrollArea}
        className="flex-1 overflow-auto bg-muted"
        style={{ scrollbarWidth: 'none' }}
        onWheel={(e) => {
          e.preventDefault();
          scrollArea.current?.scrollBy({
            left: e.deltaY > 0 ? 100 : -100,
          });
        }}
      >
        <div className="flex w-fit ">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center h-9 px-4 border-r border-b-2 text-sm cursor-pointer select-none',
                activeTabId === tab.id
                  ? 'border-b-primary bg-background'
                  : 'border-b-transparent hover:bg-accent/50',
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <span
                className={cn(
                  'mr-1 gap-2 flex items-center',
                  tab.isDirty && 'text-amber-500',
                )}
              >
                {tab.icon}
                {tab.title}
              </span>
              <button
                className="ml-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
              >
                {tab.isDirty ? (
                  '● '
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" />
                    <span className="sr-only">Close</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
