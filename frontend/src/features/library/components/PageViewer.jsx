import { useEffect, useState } from 'react';

import {
  Alert,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from '@/components/ui';
import { documentService } from '@/services/documentService';
import { fetchBlob } from '@/utils/blobUrl';

/** A dialog showing one page of the student's book (a photo, or a PDF at that page). */
export function PageViewer({ source, onClose }) {
  // What was fetched, for which opening: every opening fetches afresh, so a file freed when
  // the dialog closed never shows again.
  const [loaded, setLoaded] = useState({ source: null, file: null, failed: false });
  const current = Boolean(source) && loaded.source === source;
  const file = current ? loaded.file : null;
  const failed = current && loaded.failed;

  useEffect(() => {
    if (!source?.doc) return undefined;
    let cancelled = false;
    let url = null;
    fetchBlob(documentService.filePath(source.doc))
      .then((result) => {
        url = result.url;
        if (cancelled) URL.revokeObjectURL(url);
        else setLoaded({ source, file: result, failed: false });
      })
      .catch(() => !cancelled && setLoaded({ source, file: null, failed: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  const name = source ? `${source.title ?? 'Your book'}, page ${source.page}` : '';
  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>From the pages you added to your syllabus.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex min-h-48 items-center justify-center">
          {failed ? (
            <Alert variant="destructive">
              We couldn't open this page. It may have been deleted.
            </Alert>
          ) : !file ? (
            <Spinner />
          ) : file.type === 'application/pdf' ? (
            <div className="flex w-full flex-col items-center gap-2">
              <iframe
                src={`${file.url}#page=${source.page}`}
                title={name}
                className="h-[70vh] w-full rounded-lg border border-border"
              />
              {/* Phone browsers often can't show a PDF in a frame. */}
              <a
                href={`${file.url}#page=${source.page}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary hover:underline focus-ring"
              >
                Open the PDF
              </a>
            </div>
          ) : (
            <img src={file.url} alt={name} className="max-h-[70vh] w-auto rounded-lg" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
