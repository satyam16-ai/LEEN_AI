import { FileText, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Badge, Button } from '@/components/ui';
import { PageViewer } from '@/features/library';
import { getApiError } from '@/utils/apiError';
import { downscaleImage } from '@/utils/downscaleImage';

import { useDeletePage, useUploadPage } from '../hooks/useTopicPages';

const STATUS = {
  queued: { label: 'Reading…', variant: 'neutral' },
  reading: { label: 'Reading…', variant: 'neutral' },
  ready: { label: 'Ready', variant: 'success' },
  failed: { label: "Couldn't read", variant: 'destructive' },
};

/**
 * The book pages the student added under one topic (or, with no topic, the subject's
 * unfiled pages). The AI teaches from them and cites them in doubts.
 */
export function TopicPages({ subject, topic = null, pages, label }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(null);
  const upload = useUploadPage();
  const remove = useDeletePage();
  const name = topic?.title ?? subject;

  const handleFile = async (event) => {
    const [file] = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!file) return;
    try {
      const ready = await downscaleImage(file);
      await upload.mutateAsync({ file: ready, subject, topicId: topic?.id });
      toast.success('Page added. The AI is reading it.');
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  return (
    <div className="space-y-1.5 pl-6">
      {pages.length > 0 && (
        <ul className="space-y-1">
          {pages.map((page) => {
            const status = STATUS[page.status] ?? STATUS.queued;
            return (
              <li key={page.id} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <button
                  type="button"
                  className="truncate text-left hover:underline focus-ring"
                  onClick={() => setOpen({ doc: page.id, page: 1, title: page.title })}
                >
                  {page.title}
                  {page.pages > 1 ? ` (${page.pages} pages)` : ''}
                </button>
                <Badge variant={status.variant} title={page.error ?? undefined}>
                  {status.label}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove.mutate(page.id)}
                  aria-label={`Delete page ${page.title}`}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label={`Book page for ${name}`}
        onChange={handleFile}
      />
      <Button
        variant="link"
        size="sm"
        className="h-auto px-0"
        onClick={() => inputRef.current?.click()}
        loading={upload.isPending}
      >
        <ImagePlus className="size-4" aria-hidden="true" />
        {label ?? 'Add a page from your book'}
      </Button>
      <PageViewer source={open} onClose={() => setOpen(null)} />
    </div>
  );
}
