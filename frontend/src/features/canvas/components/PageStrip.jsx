import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui';

/** Thumbnails of the board's earlier pages; click one to see it larger. */
export function PageStrip({ pages, current }) {
  const [open, setOpen] = useState(null);
  if (!pages?.length) return null;
  const page = open === null ? null : pages[open];

  return (
    <nav aria-label="Board pages" className="flex items-center gap-2 overflow-x-auto pb-1">
      {pages.map((item, index) => (
        <button
          key={`${index}-${item.title}`}
          type="button"
          onClick={() => setOpen(index)}
          aria-label={`Page ${index + 1}: ${item.title ?? 'Untitled'}`}
          className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-[11px] leading-tight text-muted-foreground shadow-xs hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          {item.thumb ? (
            <img src={item.thumb} alt="" className="size-full object-contain" />
          ) : (
            <span className="line-clamp-3 px-1">{item.title}</span>
          )}
        </button>
      ))}
      {current && (
        <span className="shrink-0 rounded-md bg-primary-soft px-2 py-1 text-xs font-medium text-primary-soft-foreground">
          Now: {current}
        </span>
      )}
      <Dialog open={page !== null} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{page?.title ?? 'Earlier page'}</DialogTitle>
            <DialogDescription>
              Page {open === null ? '' : open + 1} of this board
            </DialogDescription>
          </DialogHeader>
          {page?.thumb ? (
            <img
              src={page.thumb}
              alt={page.title ?? 'Board page'}
              className="w-full rounded-md border border-border bg-[#fffdf8]"
            />
          ) : (
            <p className="text-sm text-muted-foreground">No picture was saved for this page.</p>
          )}
        </DialogContent>
      </Dialog>
    </nav>
  );
}
