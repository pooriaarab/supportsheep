import type { ReactNode } from 'react';

interface StickyFormFooterProps {
  children: ReactNode;
}

export function StickyFormFooter({ children }: StickyFormFooterProps) {
  return (
    <div className="sticky bottom-0 flex justify-end gap-2 pt-4 border-t border-border bg-popover -mx-6 px-6 pb-6">
      {children}
    </div>
  );
}
