import { X } from 'lucide-react';
import { Dialog as Primitive } from 'radix-ui';

import { cn } from '@/utils/cn';

export function Dialog(props) {
  return <Primitive.Root {...props} />;
}

export function DialogTrigger(props) {
  return <Primitive.Trigger {...props} />;
}

export function DialogClose(props) {
  return <Primitive.Close {...props} />;
}

function Overlay() {
  return (
    <Primitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
  );
}

function CloseButton() {
  return (
    <Primitive.Close
      className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
      aria-label="Close"
    >
      <X className="size-4" />
    </Primitive.Close>
  );
}

export function DialogContent({ className, children, ...props }) {
  return (
    <Primitive.Portal>
      <Overlay />
      <Primitive.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated',
          'data-[state=open]:animate-scale-in focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/** Left-hand drawer built on Dialog (used for the mobile sidebar). */
export function SheetContent({ className, children, title, ...props }) {
  return (
    <Primitive.Portal>
      <Overlay />
      <Primitive.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-elevated',
          'data-[state=open]:animate-slide-in-left focus:outline-none',
          className
        )}
        aria-describedby={undefined}
        {...props}
      >
        <Primitive.Title className="sr-only">{title}</Primitive.Title>
        {children}
        <CloseButton />
      </Primitive.Content>
    </Primitive.Portal>
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('mb-5 space-y-1.5 pr-8', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <Primitive.Title className={cn('text-lg font-semibold', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return (
    <Primitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
