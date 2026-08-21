import { cn } from '@/lib/utils';

export const Page = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn('flex flex-col min-h-screen px-4 gap-4 pb-4', className)}
    >
      {children}
    </div>
  );
};
