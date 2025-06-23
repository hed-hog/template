import { Check } from "lucide-react";
import { useSettings } from "../context/settings-context"

export const SettingsTitle = () => {

    const {
        hasUnsavedChanges,
    } = useSettings();

    return (
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie as configurações e preferências do sistema
                </p>
            </div>

            <div className="flex items-center gap-2">
                {hasUnsavedChanges ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        Salvando automaticamente...
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                        <Check className="h-4 w-4" />
                        Salvo
                    </div>
                )}
            </div>
        </div>
    )

}