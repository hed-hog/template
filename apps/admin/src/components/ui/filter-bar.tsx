"use client"

import { Search, Filter, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  id: string
  label: string
  options: FilterOption[]
  value?: string
  onChange?: (value: string) => void
}

interface FilterBarProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: FilterConfig[]
  activeFilters?: number
  onClearFilters?: () => void
  className?: string
}

export function FilterBar({
  searchPlaceholder = "Buscar...",
  searchValue = "",
  onSearchChange,
  filters = [],
  activeFilters = 0,
  onClearFilters,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Select
            key={filter.id}
            value={filter.value}
            onValueChange={filter.onChange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpar ({activeFilters})
          </Button>
        )}
      </div>
    </div>
  )
}
