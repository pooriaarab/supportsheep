'use client';

import * as React from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../primitives/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../primitives/sheet';

const MOBILE_BREAKPOINT = 768;

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}

const ResponsiveDialogContext = React.createContext({ isMobile: false });

function ResponsiveDialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true }}>
        <Sheet {...props}>{children}</Sheet>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false }}>
      <Dialog {...props}>{children}</Dialog>
    </ResponsiveDialogContext.Provider>
  );
}

function ResponsiveDialogTrigger({ children, ...props }: React.ComponentProps<typeof DialogTrigger>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetTrigger {...props}>{children}</SheetTrigger>;
  return <DialogTrigger {...props}>{children}</DialogTrigger>;
}

function ResponsiveDialogContent({ children, className, ...props }: React.ComponentProps<typeof DialogContent>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) {
    return (
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto overscroll-contain rounded-t-xl">
        {children}
      </SheetContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ children, ...props }: React.ComponentProps<typeof DialogHeader>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetHeader {...props}>{children}</SheetHeader>;
  return <DialogHeader {...props}>{children}</DialogHeader>;
}

function ResponsiveDialogFooter({ children, ...props }: React.ComponentProps<typeof DialogFooter>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetFooter {...props}>{children}</SheetFooter>;
  return <DialogFooter {...props}>{children}</DialogFooter>;
}

function ResponsiveDialogTitle({ children, ...props }: React.ComponentProps<typeof DialogTitle>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetTitle {...props}>{children}</SheetTitle>;
  return <DialogTitle {...props}>{children}</DialogTitle>;
}

function ResponsiveDialogDescription({ children, ...props }: React.ComponentProps<typeof DialogDescription>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetDescription {...props}>{children}</SheetDescription>;
  return <DialogDescription {...props}>{children}</DialogDescription>;
}

function ResponsiveDialogClose({ children, ...props }: React.ComponentProps<typeof DialogClose>) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  if (isMobile) return <SheetClose {...props}>{children}</SheetClose>;
  return <DialogClose {...props}>{children}</DialogClose>;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
