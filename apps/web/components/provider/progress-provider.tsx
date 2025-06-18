'use client';

import { ProgressProvider as BProgressProvider } from '@bprogress/next/app';

type ProgressProviderProps = {
  children: React.ReactNode;
  height?: string;
  color?: string;
};

const ProgressProvider = ({
  children,
  color = '#ff6f00',
  height = '1px',
}: ProgressProviderProps) => {
  console.log('ProgressProvider', { color, height });
  return (
    <BProgressProvider
      height={height}
      color={color}
      options={{ showSpinner: false }}
      shallowRouting
    >
      {children}
    </BProgressProvider>
  );
};

export default ProgressProvider;
