import { apiClient } from '@/services/api';

/**
 * Fetch a private file (the student's pages and photos) through the API client, so the
 * auth cookie and the refresh-on-401 apply, and return an object URL for it with its type.
 * The caller revokes the URL. Accepts an API path with or without the base ("/api/v1").
 */
export async function fetchBlob(path) {
  const base = apiClient.defaults.baseURL ?? '';
  const relative = base && path.startsWith(base) ? path.slice(base.length) : path;
  const response = await apiClient.get(relative, { responseType: 'blob' });
  return { url: URL.createObjectURL(response.data), type: response.data.type };
}

export async function fetchBlobUrl(path) {
  return (await fetchBlob(path)).url;
}
