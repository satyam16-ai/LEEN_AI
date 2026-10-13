import { Camera, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { Avatar, Button } from '@/components/ui';
import { getApiError } from '@/utils/apiError';

import { useRemoveAvatar, useUploadAvatar } from '../hooks/useProfile';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

export function AvatarUploader({ user }) {
  const inputRef = useRef(null);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Choose a PNG, JPG or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Images must be 2 MB or smaller.');
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast.success('Profile photo updated');
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  const onRemove = async () => {
    try {
      await remove.mutateAsync();
      toast.success('Profile photo removed');
    } catch (error) {
      toast.error(getApiError(error).message);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative">
        <Avatar name={user.name} src={user.avatar_url} size="xl" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-soft transition-transform hover:scale-105 focus-ring"
          aria-label="Change profile photo"
        >
          <Camera className="size-4" />
        </button>
      </div>
      <div className="space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            loading={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            Upload photo
          </Button>
          {user.avatar_url && (
            <Button variant="ghost" size="sm" loading={remove.isPending} onClick={onRemove}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
    </div>
  );
}
