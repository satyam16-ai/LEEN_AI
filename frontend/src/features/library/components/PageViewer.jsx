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
  // What was fetched, for which document: a stale result never shows for another page.
  const [loaded, setLoaded] = useState({ doc: null, file: null, failed: false });
  const doc = source?.doc;
  const file = loaded.doc === doc ? loaded.file : null;
  const failed = loaded.doc === doc && loaded.failed;

  useEffect(() => {
    if (!doc) return undefined;
    let cancelled = false;
    let url = null;
    fetchBlob(documentService.filePath(doc))
      .then((result) => {
        url = result.url;
        if (cancelled) URL.revokeObjectURL(url);
        else setLoaded({ doc, file: result, failed: false });
      })
      .catch(() => !cancelled && setLoaded({ doc, file: null, failed: true }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);

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
            <iframe
              src={`${file.url}#page=${source.page}`}
              title={name}
              className="h-[70vh] w-full rounded-lg border border-border"
            />
          ) : (
            <img src={file.url} alt={name} className="max-h-[70vh] w-auto rounded-lg" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
