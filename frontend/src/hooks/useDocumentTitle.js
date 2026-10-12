import { useEffect } from 'react';

const APP_TITLE = 'LEEN AI';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_TITLE}` : `${APP_TITLE} — Your AI personal teacher`;
  }, [title]);
}
