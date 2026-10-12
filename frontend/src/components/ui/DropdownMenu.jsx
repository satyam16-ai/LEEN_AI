import { DropdownMenu as Primitive } from 'radix-ui';

import { cn } from '@/utils/cn';

export function DropdownMenu(props) {
  return <Primitive.Root {...props} />;
}

export function DropdownMenuTrigger(props) {
  return <Primitive.Trigger {...props} />;
}

export function DropdownMenuContent({ className, sideOffset = 8, align = 'end', ...props }) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-56 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-elevated',
          'origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-scale-in',
          className
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({ className, variant = 'default', ...props }) {
  return (
    <Primitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none transition-colors',
        'data-highlighted:bg-muted data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        variant === 'destructive' &&
          'text-destructive data-highlighted:bg-destructive-soft [&_svg]:text-destructive',
        className
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }) {
  return <Primitive.Label className={cn('px-2.5 py-2', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }) {
  return (
    <Primitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />
  );
}
