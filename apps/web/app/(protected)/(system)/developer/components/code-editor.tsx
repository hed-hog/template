'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Settings, Code } from 'lucide-react';

import type { Screen, Tab } from '../types';

interface CodeEditorProps {
  activeTab: Tab;
  onSave: (screen: Tab) => void;
  onContentChange: (content: string) => void;
}

export function CodeEditor({
  activeTab: initActiveTab,
  onSave,
  onContentChange,
}: CodeEditorProps) {
  const [tab, setTab] = useState<Tab>(initActiveTab);
  const [activeTab, setActiveTab] = useState('code');

  const handleSave = () => {
    onSave(tab);
  };

  const handleCodeChange = (value: string) => {
    setTab((prev) => ({ ...prev, content: value }));
    onContentChange(value);
  };

  const handleFieldChange = (field: keyof Screen, value: any) => {
    setTab((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between p-4 border-b bg-accent/50">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{tab.title}</h2>
          <Badge variant={1 === 1 ? 'default' : 'secondary'}>
            {1 === 1 ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <Button onClick={handleSave} size="sm">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Code
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="flex-1 p-4">
            <div className="h-full">
              <Label htmlFor="code-editor" className="text-sm font-medium">
                React Component Code
              </Label>
              <Textarea
                id="code-editor"
                value={tab.content}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="mt-2 h-[calc(100%-2rem)] font-mono text-sm resize-none"
                placeholder="Enter your React component code here..."
              />
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 p-4">
            <div className="space-y-6 max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={tab.title}
                        onChange={(e) =>
                          handleFieldChange('title', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <Input
                        id="slug"
                        value={''}
                        onChange={(e) =>
                          handleFieldChange('slug', e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={''}
                      onChange={(e) =>
                        handleFieldChange('description', e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="layout">Layout</Label>
                      <Select
                        value={''}
                        onValueChange={(value) =>
                          handleFieldChange('layout', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="fullscreen">Fullscreen</SelectItem>
                          <SelectItem value="sidebar">With Sidebar</SelectItem>
                          <SelectItem value="modal">Modal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="module">Module</Label>
                      <Select
                        value={''}
                        onValueChange={(value) =>
                          handleFieldChange('module', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="core">Core</SelectItem>
                          <SelectItem value="auth">Authentication</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="route">Route</Label>
                    <Input
                      id="route"
                      value={''}
                      onChange={(e) =>
                        handleFieldChange('route', e.target.value)
                      }
                      placeholder="/example"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="published"
                      checked={false}
                      onCheckedChange={(checked) => {}}
                    />
                    <Label htmlFor="published">Published</Label>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Allowed Roles</Label>
                    <div className="flex flex-wrap gap-2">
                      {[''].map((role) => (
                        <Badge key={role} variant="outline">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
