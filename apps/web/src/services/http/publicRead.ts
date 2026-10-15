import type { PaginationQuery } from '@/types/pagination';

// Anonymous reads deliberately avoid the authenticated Axios client's session/redirect interceptors.
export async function publicRead<T>(path: string, query: PaginationQuery): Promise<T> {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api${path}?${params}`, {
    cache: 'no-store',
    credentials: 'omit',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error('Public catalog unavailable');

  return response.json() as Promise<T>;
}
