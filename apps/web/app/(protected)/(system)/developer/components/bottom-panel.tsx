'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import type { LogEntry } from '../types';

interface BottomPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  logs: LogEntry[];
}

export function BottomPanel({ isOpen, onToggle, logs }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState('terminal');

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">ERROR</Badge>;
      case 'warn':
        return (
          <Badge variant="warning" className="bg-yellow-500">
            WARN
          </Badge>
        );
      case 'info':
        return <Badge variant="secondary">INFO</Badge>;
      case 'debug':
        return <Badge variant="outline">DEBUG</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col border-t">
      <div className="flex items-center justify-between p-1 bg-accent/50">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-8">
            <TabsTrigger value="terminal" className="text-xs">
              Terminal
            </TabsTrigger>
            <TabsTrigger value="problems" className="text-xs">
              Problems
            </TabsTrigger>
            <TabsTrigger value="output" className="text-xs">
              Output
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-xs">
              Debug Console
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggle}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggle}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <TabsContent value="terminal" className="flex-1 p-0 m-0">
        <ScrollArea className="h-full">
          <div className="p-2 font-mono text-xs">
            <div className="text-green-500">$ npm run dev</div>
            <div className="text-white">
              ready - started server on 0.0.0.0:3000, url: http://localhost:3000
            </div>
            <div className="text-white">
              event - compiled client and server successfully in 188 ms (17
              modules)
            </div>
            <div className="text-white">Waiting for file changes...</div>
            <div className="text-green-500 mt-1">$</div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="problems" className="flex-1 p-0 m-0">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            <div className="text-sm text-yellow-500 flex items-center gap-2">
              <span>⚠️</span>
              <span>2 migrations pending</span>
            </div>
            <div className="text-sm text-red-500 flex items-center gap-2">
              <span>❌</span>
              <span>Failed to load module 'analytics'</span>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="output" className="flex-1 p-0 m-0">
        <ScrollArea className="h-full">
          <div className="p-2 font-mono text-xs space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <div className="min-w-[50px]">{getLevelBadge(log.level)}</div>
                <div className="text-muted-foreground min-w-[80px]">
                  {log.timestamp.toLocaleTimeString()}
                </div>
                <div className="text-muted-foreground min-w-[70px]">
                  {log.source}
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="debug" className="flex-1 p-0 m-0">
        <ScrollArea className="h-full">
          <div className="p-2 font-mono text-xs">
            <div className="text-muted-foreground">No active debug session</div>
          </div>
        </ScrollArea>
      </TabsContent>
    </div>
  );
}
