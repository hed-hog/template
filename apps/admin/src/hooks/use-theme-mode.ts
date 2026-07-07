import * as React from 'react'

type ThemeMode = 'light' | 'dark'

function readThemeMode(): ThemeMode {
  // SSR-only guard: `document` is always defined in the jsdom test
  // environment, so this branch is unreachable from tests and only
  // guards a real server-render call.
  /* v8 ignore next */
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Resolves the app's current color mode from the `dark` class on `<html>`, which
 * the custom ThemeProvider toggles for every theme change (explicit, `system`,
 * other tab). `next-themes` is not mounted in this app, so its `useTheme()` is
 * unreliable — the `<html>` class is the source of truth. Useful for libraries
 * that need an explicit `'light' | 'dark'` (e.g. CodeMirror's `theme` prop).
 */
export function useThemeMode(): ThemeMode {
  const [mode, setMode] = React.useState<ThemeMode>(readThemeMode)

  React.useEffect(() => {
    const root = document.documentElement
    const update = () => setMode(readThemeMode())
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    // Sync in case the class changed between render and effect.
    update()
    return () => observer.disconnect()
  }, [])

  return mode
}
