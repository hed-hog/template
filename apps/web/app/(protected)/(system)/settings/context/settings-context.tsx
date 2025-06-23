// app/settings/context/settings-context.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface SettingsContextType {
    hasUnsavedChanges: boolean
    setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    return (
        <SettingsContext.Provider value={{
            hasUnsavedChanges,
            setHasUnsavedChanges,
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider')
    }
    return context
}