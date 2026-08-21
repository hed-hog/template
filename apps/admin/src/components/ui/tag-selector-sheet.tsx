'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ResizableSheetContent } from '@/components/ui/resizable-sheet-content';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type TagOption = {
  id: string;
  name: string;
  color?: string;
  usageCount?: number;
};

type TagSelectorSheetLabels = {
  addTag: string;
  sheetTitle: string;
  sheetDescription: string;
  createLabel: string;
  createPlaceholder: string;
  createAction: string;
  popularTitle: string;
  selectedTitle: string;
  noTags: string;
  cancel: string;
  apply: string;
  removeTagAria: (tagName: string) => string;
};

type TagSelectorSheetProps = {
  selectedTagIds: string[];
  tags: TagOption[];
  labels: TagSelectorSheetLabels;
  emptyText?: string;
  disabled?: boolean;
  popularLimit?: number;
  onChange: (nextTagIds: string[]) => Promise<void> | void;
  onCreateTag?: (name: string) => Promise<TagOption | null | undefined>;
};

const createTagSchema = z.object({
  name: z.string().trim().min(1),
});

type CreateTagFormValues = z.infer<typeof createTagSchema>;

export function TagSelectorSheet({
  selectedTagIds,
  tags,
  labels,
  emptyText = 'Sem tags',
  disabled = false,
  popularLimit = 8,
  onChange,
  onCreateTag,
}: TagSelectorSheetProps) {
  const [open, setOpen] = useState(false);
  const [draftTagIds, setDraftTagIds] = useState<string[]>(selectedTagIds);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [createdTags, setCreatedTags] = useState<TagOption[]>([]);

  const form = useForm<CreateTagFormValues>({
    resolver: zodResolver(createTagSchema),
    defaultValues: {
      name: '',
    },
  });

  const allTags = useMemo(() => {
    const byId = new Map<string, TagOption>();

    for (const tag of tags) {
      byId.set(tag.id, tag);
    }

    for (const tag of createdTags) {
      byId.set(tag.id, tag);
    }

    return [...byId.values()];
  }, [tags, createdTags]);

  const tagsById = useMemo(() => {
    return new Map(allTags.map((tag) => [tag.id, tag]));
  }, [allTags]);

  const selectedTags = useMemo(() => {
    return selectedTagIds
      .map((tagId) => tagsById.get(tagId))
      .filter((tag): tag is TagOption => Boolean(tag));
  }, [selectedTagIds, tagsById]);

  const popularTags = useMemo(() => {
    const hasUsageCount = allTags.some((tag) => (tag.usageCount || 0) > 0);

    const sorted = [...allTags].sort((a, b) => {
      if (hasUsageCount) {
        return (b.usageCount || 0) - (a.usageCount || 0);
      }

      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return sorted.slice(0, popularLimit);
  }, [allTags, popularLimit]);

  useEffect(() => {
    if (open) {
      setDraftTagIds(selectedTagIds);
    }
  }, [open, selectedTagIds]);

  const handleRemoveTag = async (tagId: string) => {
    /* v8 ignore next 3 -- unreachable: the remove button's own disabled prop mirrors this exact condition (disabled || isSaving) */
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onChange(selectedTagIds.filter((id) => id !== tagId));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDraftTag = (tagId: string) => {
    setDraftTagIds((current) => {
      if (current.includes(tagId)) {
        return current.filter((id) => id !== tagId);
      }

      return [...current, tagId];
    });
  };

  const handleApply = async () => {
    if (disabled || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onChange(draftTagIds);
      setOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTag = async (values: CreateTagFormValues) => {
    if (!onCreateTag) {
      return;
    }

    setIsCreatingTag(true);
    try {
      const createdTag = await onCreateTag(values.name);
      if (!createdTag) {
        return;
      }

      setCreatedTags((current) => {
        if (current.some((tag) => tag.id === createdTag.id)) {
          return current;
        }

        return [...current, createdTag];
      });

      setDraftTagIds((current) => {
        if (current.includes(createdTag.id)) {
          return current;
        }

        return [...current, createdTag.id];
      });

      form.reset({ name: '' });
    } finally {
      setIsCreatingTag(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1">
              <span>{tag.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={() => void handleRemoveTag(tag.id)}
                    disabled={disabled || isSaving}
                    aria-label={labels.removeTagAria(tag.name)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{labels.removeTagAria(tag.name)}</p>
                </TooltipContent>
              </Tooltip>
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">{emptyText}</span>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label={labels.addTag}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <ResizableSheetContent
          side="right"
          sheetId="tag-selector-sheet"
          defaultWidth={560}
          minWidth={420}
          maxWidth={920}
          className="w-full overflow-y-auto sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle>{labels.sheetTitle}</SheetTitle>
            <SheetDescription>{labels.sheetDescription}</SheetDescription>
          </SheetHeader>

          <div className="mt-6 px-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleCreateTag)}
                className="space-y-3"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{labels.createLabel}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={labels.createPlaceholder}
                          disabled={isCreatingTag || disabled}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={isCreatingTag || disabled}
                      className="mb-4"
                    >
                      {isCreatingTag ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      {labels.createAction}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{labels.createAction}</p>
                  </TooltipContent>
                </Tooltip>
              </form>
            </Form>

            <div className="space-y-2">
              <p className="text-sm font-medium">{labels.popularTitle}</p>
              <ScrollArea className="h-56 rounded-md border p-3">
                <div className="space-y-2">
                  {popularTags.length > 0 ? (
                    popularTags.map((tag) => {
                      const checked = draftTagIds.includes(tag.id);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-muted"
                          onClick={() => toggleDraftTag(tag.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              className="pointer-events-none"
                              checked={checked}
                            />
                            <span className="text-sm">{tag.name}</span>
                          </div>

                          {typeof tag.usageCount === 'number' &&
                          tag.usageCount > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {tag.usageCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {labels.noTags}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium mt-4">{labels.selectedTitle}</p>
              <div className="flex flex-wrap gap-1">
                {draftTagIds.length > 0 ? (
                  draftTagIds.map((tagId) => {
                    const tag = tagsById.get(tagId);
                    if (!tag) {
                      return null;
                    }

                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        style={
                          tag.color
                            ? {
                                borderColor: tag.color,
                                color: tag.color,
                              }
                            : undefined
                        }
                      >
                        {tag.name}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {emptyText}
                  </span>
                )}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-6">
            <Button
              type="button"
              onClick={() => void handleApply()}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {labels.apply}
            </Button>
          </SheetFooter>
        </ResizableSheetContent>
      </Sheet>
    </div>
  );
}
