import { Camera, PencilLine } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui';
import { downscaleImage } from '@/utils/downscaleImage';

const MAX_PHOTOS = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const WRONG_FILES = 'Choose up to 3 photos of the contents page, or one PDF.';

/** Pick the contents page (up to 3 photos, or one PDF) for the Syllabus Reader. */
export function SyllabusUpload({ onUpload, uploading = false, onTypeIt }) {
  const inputRef = useRef(null);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const pdfs = files.filter((file) => file.type === 'application/pdf');
    if (files.length > MAX_PHOTOS || (pdfs.length && files.length > 1)) {
      toast.error(WRONG_FILES);
      return;
    }
    const ready = await Promise.all(files.map((file) => downscaleImage(file)));
    if (ready.some((file) => file.size > MAX_BYTES)) {
      toast.error('Each file must be 8 MB or smaller.');
      return;
    }
    onUpload(ready);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        aria-label="Contents page photos or PDF"
        onChange={handleFiles}
      />
      <Button onClick={() => inputRef.current?.click()} loading={uploading}>
        <Camera className="size-4" aria-hidden="true" />
        Upload contents page
      </Button>
      {onTypeIt && (
        <Button variant="outline" onClick={onTypeIt}>
          <PencilLine className="size-4" aria-hidden="true" />
          Type it myself
        </Button>
      )}
    </div>
  );
}
