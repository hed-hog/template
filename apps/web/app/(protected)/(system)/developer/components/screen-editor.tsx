'use client';

import type React from 'react';
import * as TablerIcons from '@tabler/icons-react';
import { useState, useEffect, createElement, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  PlusCircle,
  Trash2,
  Settings,
  HelpCircle,
  Copy,
  FileText,
  Languages,
  MenuSquare,
  Route,
  ShieldCheck,
  Save,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tab } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSystem } from '@/components/provider/system-provider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toPascalCase } from '@/lib/convert-string';

interface LocalizedTexts {
  [langCode: string]: string;
}

const initialLanguages = ['en', 'pt'];
const initialScreenNames: LocalizedTexts = {
  en: 'Setting',
  pt: 'Configurações',
};
const initialDescriptions: LocalizedTexts = {
  en: 'Manage system setting and configurations.',
  pt: 'Gerenciar configurações e definições do sistema.',
};

type ScreenEditorProps = {
  activeTab: Tab;
};

export default function ScreenEditor({
  activeTab: initActiveTab,
}: ScreenEditorProps) {
  // Screen State
  const { request } = useSystem();
  const [tab, setTab] = useState<Tab>(initActiveTab);
  const [slug, setSlug] = useState<string>('/management/setting');
  const [screenIconName, setScreenIconName] = useState<string>('database');

  const [activeLanguages, setActiveLanguages] =
    useState<string[]>(initialLanguages);
  const [screenNames, setScreenNames] =
    useState<LocalizedTexts>(initialScreenNames);
  const [screenDescriptions, setScreenDescriptions] =
    useState<LocalizedTexts>(initialDescriptions);
  const [newLangCode, setNewLangCode] = useState<string>('');

  // Menu State
  const [isMenuCustomized, setIsMenuCustomized] = useState<boolean>(false);
  const [customMenuIconName, setCustomMenuIconName] = useState<string>('');

  const [customMenuNames, setCustomMenuNames] = useState<LocalizedTexts>({});
  const [menuRoles, setMenuRoles] = useState<string[]>(['admin']);
  const [newMenuRole, setNewMenuRole] = useState<string>('');

  // Routes State
  const [routes, setRoutes] = useState<string[]>(['/setting%']);
  const [newRoutePattern, setNewRoutePattern] = useState<string>('');

  // General State
  const [generatedYaml, setGeneratedYaml] = useState<string>('');
  const { toast } = useToast();

  // Effect for Screen Icon
  useEffect(() => {
    console.log({ screenIconName, TablerIcons });
  }, [screenIconName]);

  // Effect for initializing custom menu fields when customization is enabled
  useEffect(() => {
    if (isMenuCustomized) {
      if (!customMenuIconName) setCustomMenuIconName(screenIconName);
      // Initialize customMenuNames for active languages if they don't exist
      const initialCustomNames = { ...customMenuNames };
      activeLanguages.forEach((lang) => {
        if (initialCustomNames[lang] === undefined) {
          initialCustomNames[lang] = screenNames[lang] || '';
        }
      });
      setCustomMenuNames(initialCustomNames);
    }
  }, [isMenuCustomized, screenIconName, screenNames, activeLanguages]);

  const handleAddLanguage = () => {
    if (newLangCode && !activeLanguages.includes(newLangCode)) {
      const newActiveLanguages = [...activeLanguages, newLangCode];
      setActiveLanguages(newActiveLanguages);
      setScreenNames((prev) => ({ ...prev, [newLangCode]: '' }));
      setScreenDescriptions((prev) => ({ ...prev, [newLangCode]: '' }));
      if (isMenuCustomized) {
        setCustomMenuNames((prev) => ({
          ...prev,
          [newLangCode]: screenNames[newLangCode] || '',
        }));
      }
      setNewLangCode('');
    } else if (activeLanguages.includes(newLangCode)) {
      toast({
        title: 'Language exists',
        description: `Language code "${newLangCode}" already added.`,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveLanguage = (langCodeToRemove: string) => {
    if (activeLanguages.length === 1) {
      toast({
        title: 'Cannot remove',
        description: 'At least one language must be present.',
        variant: 'destructive',
      });
      return;
    }
    setActiveLanguages(
      activeLanguages.filter((lang) => lang !== langCodeToRemove),
    );

    const newScreenNames = { ...screenNames };
    delete newScreenNames[langCodeToRemove];
    setScreenNames(newScreenNames);
    const newScreenDescriptions = { ...screenDescriptions };
    delete newScreenDescriptions[langCodeToRemove];
    setScreenDescriptions(newScreenDescriptions);

    if (isMenuCustomized) {
      const newCustomMenuNames = { ...customMenuNames };
      delete newCustomMenuNames[langCodeToRemove];
      setCustomMenuNames(newCustomMenuNames);
    }
  };

  const handleLocalizedChange = (
    langCode: string,
    field: 'screenName' | 'screenDescription' | 'customMenuName',
    value: string,
  ) => {
    if (field === 'screenName')
      setScreenNames((prev) => ({ ...prev, [langCode]: value }));
    else if (field === 'screenDescription')
      setScreenDescriptions((prev) => ({ ...prev, [langCode]: value }));
    else if (field === 'customMenuName' && isMenuCustomized)
      setCustomMenuNames((prev) => ({ ...prev, [langCode]: value }));
  };

  const handleAddMenuRole = () => {
    if (newMenuRole && !menuRoles.includes(newMenuRole)) {
      setMenuRoles([...menuRoles, newMenuRole]);
      setNewMenuRole('');
    }
  };
  const handleRemoveMenuRole = (roleToRemove: string) =>
    setMenuRoles(menuRoles.filter((role) => role !== roleToRemove));

  const handleAddRoute = () => {
    if (newRoutePattern) {
      setRoutes((prev) => [...prev, newRoutePattern]);
      setNewRoutePattern('');
    }
  };
  const handleRemoveRoute = (indexToRemove: number) =>
    setRoutes((prev) => prev.filter((_, index) => index !== indexToRemove));

  const handleGenerateYaml = () => {
    let yamlString = `slug: ${slug}\n`;
    yamlString += `icon: ${screenIconName.toLowerCase()}\n`;

    yamlString += `name:\n`;
    activeLanguages.forEach((lang) => {
      yamlString += `  ${lang}: ${screenNames[lang] || ''}\n`;
    });

    yamlString += `description:\n`;
    activeLanguages.forEach((lang) => {
      yamlString += `  ${lang}: ${screenDescriptions[lang] || ''}\n`;
    });

    // Menu section
    yamlString += `menu:\n`;
    yamlString += `  url: ${slug}\n`;
    const finalMenuIcon = isMenuCustomized
      ? customMenuIconName
      : screenIconName;
    yamlString += `  icon: ${finalMenuIcon.toLowerCase()}\n`;
    yamlString += `  name:\n`;
    activeLanguages.forEach((lang) => {
      const menuNameForLang = isMenuCustomized
        ? customMenuNames[lang] || ''
        : screenNames[lang] || '';
      yamlString += `    ${lang}: ${menuNameForLang}\n`;
    });
    yamlString += `  slug: ${slug}\n`; // Assuming menu slug is same as screen slug
    yamlString += `  roles:\n`;
    menuRoles.forEach((role) => {
      yamlString += `    - ${role}\n`;
    });
    if (menuRoles.length === 0) yamlString += `    []\n`;

    // Routes section
    yamlString += `routes:\n`;
    routes.forEach((route) => {
      yamlString += `  - ${route}\n`;
    });
    if (routes.length === 0) yamlString += `  []\n`;

    setGeneratedYaml(yamlString);
    toast({
      title: 'YAML Generated',
      description: 'Configuration has been generated.',
    });
  };

  const handleCopyToClipboard = () => {
    if (generatedYaml) {
      navigator.clipboard
        .writeText(generatedYaml)
        .then(() =>
          toast({ title: 'Copied!', description: 'YAML copied to clipboard.' }),
        )
        .catch(() =>
          toast({
            title: 'Error',
            description: 'Could not copy YAML.',
            variant: 'destructive',
          }),
        );
    }
  };

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    request({
      url: '/developer/screen',
      method: 'POST',
      data: {
        title: tab.title,
        library: tab.library,
        slug,
        icon: screenIconName,
        name: screenNames,
        description: screenDescriptions,
        menu: isMenuCustomized
          ? {
              icon: customMenuIconName,
              name: customMenuNames,
            }
          : {
              icon: screenIconName,
              name: screenNames,
            },
        roles: menuRoles,
        routes,
      },
    })
      .then((data) => {
        console.log('Table saved successfully:', data);
      })
      .catch((error) => {
        console.error('Error saving table:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    setTab(initActiveTab);
  }, [initActiveTab]);

  return (
    <Card className="w-full mx-auto border-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
        <div className="flex items-center gap-2">
          <Icons.Monitor className="h-4 w-4" />
          <CardTitle className="text-md">Screen Editor</CardTitle>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            size="sm"
            disabled={isLoading}
            className="h-8 px-2"
          >
            <Save className="h-4 w-4 mr-1" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 border-none ">
        <Separator />

        <ScrollArea className="h-[calc(100vh-110px)]">
          <div className="p-2">
            {/* Screen Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="/example/path"
                />
              </div>
              <div className="space-y-1 flex flex-col pt-2">
                <Label htmlFor="screenIconName">Icon</Label>
                <div className="relative w-full max-w-sm">
                  {createElement(
                    // If the icon name isn't found, fallback to HelpCircle
                    (TablerIcons[
                      ('Icon' +
                        toPascalCase(
                          screenIconName,
                        )) as keyof typeof TablerIcons
                    ] as React.ElementType) || Icons.HelpCircle,
                    {
                      className:
                        'w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
                    },
                  )}
                  <Input
                    id="screenIconName"
                    value={screenIconName}
                    onChange={(e) => setScreenIconName(e.target.value)}
                    placeholder="e.g., Settings"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Localization Table */}
            <div className="space-y-2 pt-2">
              <Separator />
              <h3 className="text-lg font-medium flex items-center my-2">
                <Languages className="w-5 h-5 mr-2 text-blue-500" />
                Screen Localization
              </h3>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Language</TableHead>
                      <TableHead className="w-[160px]">Screen Name</TableHead>
                      <TableHead>Screen Description</TableHead>
                      <TableHead className="w-[40px] text-right">
                        &nbsp;
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLanguages.map((langCode) => (
                      <TableRow key={langCode}>
                        <TableCell className="font-medium p-2">
                          {langCode.toUpperCase()}
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            value={screenNames[langCode] || ''}
                            onChange={(e) =>
                              handleLocalizedChange(
                                langCode,
                                'screenName',
                                e.target.value,
                              )
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="text"
                            value={screenDescriptions[langCode] || ''}
                            onChange={(e) =>
                              handleLocalizedChange(
                                langCode,
                                'screenDescription',
                                e.target.value,
                              )
                            }
                            className="h-[32px] text-sm"
                          />
                        </TableCell>
                        <TableCell className="text-right p-2">
                          {activeLanguages.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveLanguage(langCode)}
                              className="hover:bg-destructive/10 hover:text-red-500 h-8 w-8 flex items-center justify-center"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 items-end pt-1 pb-2">
                <div className="flex-grow">
                  <Label htmlFor="newLangCode" className="text-xs">
                    Add Language Code
                  </Label>
                  <Input
                    id="newLangCode"
                    value={newLangCode}
                    onChange={(e) =>
                      setNewLangCode(e.target.value.toLowerCase())
                    }
                    placeholder="e.g., es"
                    className="h-9"
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') {
                        handleAddLanguage();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleAddLanguage}
                  variant="outline"
                  size="sm"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  <PlusCircle className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </div>
            <Separator />

            {/* Menu Configuration */}
            <div className="space-y-3 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center my-2">
                  <MenuSquare className="w-5 h-5 mr-2 text-purple-500" />
                  Menu Configuration
                </h3>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="customize-menu" className="text-sm">
                    Customize Menu Details
                  </Label>
                  <Switch
                    id="customize-menu"
                    checked={isMenuCustomized}
                    onCheckedChange={setIsMenuCustomized}
                  />
                </div>
              </div>

              {isMenuCustomized && (
                <div className="pl-2 space-y-4 border-l-2 border-purple-200 dark:border-purple-800 ml-2">
                  <div className="space-y-1">
                    <Label htmlFor="screenIconName">Icon</Label>
                    <div className="relative w-full">
                      {createElement(
                        // If the icon name isn't found, fallback to HelpCircle
                        (TablerIcons[
                          ('Icon' +
                            toPascalCase(
                              customMenuIconName,
                            )) as keyof typeof TablerIcons
                        ] as React.ElementType) || Icons.HelpCircle,
                        {
                          className:
                            'w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
                        },
                      )}
                      <Input
                        id="screenIconName"
                        value={customMenuIconName}
                        onChange={(e) => setCustomMenuIconName(e.target.value)}
                        placeholder="e.g., Settings"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Names</Label>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">
                              Language
                            </TableHead>
                            <TableHead>Name</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeLanguages.map((langCode) => (
                            <TableRow key={`menu-name-${langCode}`}>
                              <TableCell className="font-medium p-2">
                                {langCode.toUpperCase()}
                              </TableCell>
                              <TableCell className="p-2">
                                <Input
                                  value={customMenuNames[langCode] || ''}
                                  onChange={(e) =>
                                    handleLocalizedChange(
                                      langCode,
                                      'customMenuName',
                                      e.target.value,
                                    )
                                  }
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
              {!isMenuCustomized && (
                <div className="pl-4 text-sm text-muted-foreground">
                  <p>
                    Menu Icon:{' '}
                    <span className="font-semibold">(same as screen icon)</span>
                  </p>
                  <p>
                    Menu names:{' '}
                    <span className="font-semibold">
                      (same as screen names)
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label className="text-sm font-medium flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-1 text-green-500" />
                  Menu Roles
                </Label>
                <div className="flex flex-wrap gap-2">
                  {menuRoles.map((role) => (
                    <span
                      key={role}
                      className="flex items-center bg-muted px-2 py-1 rounded-md text-sm"
                    >
                      {role}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMenuRole(role)}
                        className="ml-1 h-5 w-5 hover:bg-destructive/10"
                      >
                        <TablerIcons.IconX className="w-3 h-3 text-red-500" />
                      </Button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-grow">
                    <Label htmlFor="newMenuRole" className="text-xs">
                      Add Menu Role
                    </Label>
                    <Input
                      id="newMenuRole"
                      value={newMenuRole}
                      onChange={(e) => setNewMenuRole(e.target.value)}
                      placeholder="e.g., editor"
                      className="h-9"
                      onKeyUp={(e) => {
                        if (e.key === 'Enter') {
                          handleAddMenuRole();
                        }
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleAddMenuRole}
                    variant="outline"
                    size="sm"
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    <PlusCircle className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>
            <Separator />

            {/* Screen Routes */}
            <div className="space-y-2">
              <h3 className="text-lg font-medium flex items-center my-2">
                <Route className="w-5 h-5 mr-2 text-orange-500" />
                Screen Routes
              </h3>
              {routes.map((routePattern, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={routePattern}
                    onChange={(e) => {
                      const newR = [...routes];
                      newR[index] = e.target.value;
                      setRoutes(newR);
                    }}
                    placeholder="/path/pattern%"
                    className="h-9"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRoute(index)}
                    className="hover:bg-destructive/10 hover:text-red-500 h-8 w-8 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 items-end pt-1">
                <div className="flex-grow">
                  <Label htmlFor="newRoutePattern" className="text-xs">
                    Add Route Pattern
                  </Label>
                  <Input
                    id="newRoutePattern"
                    value={newRoutePattern}
                    onChange={(e) => setNewRoutePattern(e.target.value)}
                    placeholder="/new/route%"
                    className="h-9"
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') {
                        handleAddRoute();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleAddRoute}
                  variant="outline"
                  size="sm"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  <PlusCircle className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Generated YAML Output */}
            {generatedYaml && (
              <Accordion type="single" collapsible className="w-full mt-4">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-base font-medium hover:no-underline">
                    View Generated YAML
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="relative mt-2">
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-60">
                        {generatedYaml}
                      </pre>
                      <Button
                        onClick={handleCopyToClipboard}
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 bg-background hover:bg-muted"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
