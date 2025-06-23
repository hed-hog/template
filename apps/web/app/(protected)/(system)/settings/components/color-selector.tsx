"use client"

import { useCallback, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { COLOR_OPTIONS } from "../data"

interface ColorSelectorProps {
    colors: string[];
    selectedColor: string;
    onColorChange: (color: string) => void;
}

export function ColorSelector({ colors, selectedColor, onColorChange }: ColorSelectorProps) {
    const [customColor, setCustomColor] = useState("#3b82f6")
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)

    // Check if current selected color is a predefined color
    const isPredefinedColor = COLOR_OPTIONS.some((color) => color.value === selectedColor)

    // Check if we have a custom color selected
    const hasCustomColor = !isPredefinedColor && selectedColor

    // Use current selected color as custom color if it's not predefined
    const currentCustomColor = hasCustomColor ? selectedColor : customColor

    const handleCustomColorChange = (color: string) => {
        setCustomColor(color)
        onColorChange(color)
        setIsColorPickerOpen(false)
    }

    const handleColorSelect = useCallback((colorValue: string) => {
        onColorChange(colorValue)
    }, []);

    return (
        <div className="flex gap-2 items-center">
            {/* Predefined Colors */}
            {colors.map((color) => (
                <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    style={{
                        ['--custom-color' as any]: color,
                    }}
                    className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        "bg-[var(--custom-color)]",
                        selectedColor === color
                            ? "border-foreground scale-110"
                            : "border-muted-foreground/30 hover:scale-105",
                    )}
                />
            ))}

            {/* Custom Color Button - Dynamic */}
            <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                <PopoverTrigger asChild>
                    {!colors.includes(selectedColor) ? (
                        // Show custom color as a regular color button
                        <button
                            className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                selectedColor === currentCustomColor
                                    ? "border-foreground scale-110"
                                    : "border-muted-foreground/30 hover:scale-105",
                            )}
                            style={{ backgroundColor: currentCustomColor }}
                            title={`Cor personalizada (${currentCustomColor})`}
                        />
                    ) : (
                        // Show "+" button to add custom color
                        <button
                            className={cn(
                                "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
                                "border-dashed border-muted-foreground/50 hover:border-muted-foreground",
                                "hover:scale-105 bg-muted/30 hover:bg-muted/50",
                            )}
                            title="Adicionar cor personalizada"
                        >
                            <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}
                </PopoverTrigger>
                <PopoverContent className="w-64 p-4" align="start">
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium">
                                {hasCustomColor ? "Editar cor personalizada" : "Escolher cor personalizada"}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                                {hasCustomColor
                                    ? "Modifique sua cor personalizada ou escolha uma nova"
                                    : "Selecione uma cor específica para personalizar a interface"}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Color Input */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={currentCustomColor}
                                    onChange={(e) => setCustomColor(e.target.value)}
                                    className="w-12 h-8 rounded border border-input cursor-pointer"
                                    title="Seletor de cor"
                                />
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={currentCustomColor}
                                        onChange={(e) => setCustomColor(e.target.value)}
                                        placeholder="#3b82f6"
                                        className="w-full px-2 py-1 text-sm border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>

                            {/* Preview */}
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full border border-input" style={{ backgroundColor: customColor }} />
                                <span className="text-sm text-muted-foreground">Preview da cor</span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" onClick={() => handleCustomColorChange(customColor)} className="flex-1">
                                    {hasCustomColor ? "Atualizar" : "Aplicar"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setIsColorPickerOpen(false)}>
                                    Cancelar
                                </Button>
                                {hasCustomColor && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => {
                                            // Reset to first predefined color
                                            handleColorSelect(colors[0] ?? '#000')
                                            setIsColorPickerOpen(false)
                                        }}
                                        title="Remover cor personalizada"
                                    >
                                        Remover
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
