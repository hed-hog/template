'use client';

import * as React from 'react';

/**
 * Media query como estado de React.
 *
 * Começa em `false` de propósito, como o `useIsMobile`: no servidor não existe
 * `matchMedia`, então qualquer outro valor inicial faria o primeiro paint
 * discordar do HTML entregue. Quem usa isso para escolher entre dois layouts
 * precisa tolerar um render com o layout "pequeno".
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mediaQueryList = window.matchMedia(query);

    function onChange() {
      setMatches(mediaQueryList.matches);
    }

    mediaQueryList.addEventListener('change', onChange);
    setMatches(mediaQueryList.matches);

    return () => mediaQueryList.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
