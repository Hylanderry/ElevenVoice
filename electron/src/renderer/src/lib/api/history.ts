import { apiFetch, apiJson } from './client';
import type { HistoryItem } from './types';

export interface StarredResponse {
  id: string;
  starred: boolean;
}

export async function listHistory(): Promise<HistoryItem[]> {
  return apiJson<HistoryItem[]>('/history');
}

export async function clearHistory(): Promise<void> {
  await apiFetch('/history', { method: 'DELETE' });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await apiFetch(`/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface ReviewResponse {
  id: string;
  approved: boolean;
  note: string | null;
}

/** Approve a take and/or set its revision note; omitted fields stay as they are. */
export async function setHistoryReview(
  id: string,
  review: { approved?: boolean; note?: string },
): Promise<ReviewResponse> {
  return apiJson<ReviewResponse>(`/history/${encodeURIComponent(id)}/review`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  });
}

export async function setHistoryStarred(id: string, starred: boolean): Promise<StarredResponse> {
  return apiJson<StarredResponse>(`/history/${encodeURIComponent(id)}/starred`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ starred }),
  });
}
