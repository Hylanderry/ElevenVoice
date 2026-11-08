import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { HistoryItem } from '@/lib/api/types';

const mock = vi.hoisted(() => ({ review: vi.fn(), history: [] as HistoryItem[] }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/components/waveform-player', () => ({
  WaveformPlayer: ({ source }: { source: string }) => <div data-testid="player">{source}</div>,
}));
vi.mock('@/lib/api/client', () => ({ audioUrl: (path: string) => `/audio/${path}` }));
vi.mock('@/hooks/use-history', () => ({
  useHistory: () => ({ data: mock.history }),
  useReviewTake: () => ({ mutate: mock.review, isPending: false }),
}));
import { TakeReview, compareCandidates } from './take-review';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function take(id: string, extra: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id,
    text: 'Hello there',
    mode: 'clone',
    language: 'English',
    instruct: null,
    profile_id: 'voice-a',
    audio_path: `${id}.wav`,
    duration_seconds: 2,
    generation_time: 1,
    seed: null,
    starred: 0,
    created_at: 100,
    ...extra,
  };
}

it('ranks takes of the same script first, then the same voice, newest first', () => {
  const base = take('a');
  const ranked = compareCandidates(base, [
    base,
    take('other-voice-same-text', { profile_id: 'voice-b', created_at: 50 }),
    take('same-voice-other-text', { text: 'Different', created_at: 300 }),
    take('same-text-newer', { created_at: 200 }),
    take('unrelated', { text: 'x', profile_id: 'z', created_at: 400 }),
    take('no-audio', { audio_path: '' }),
  ]);
  expect(ranked.map((item) => item.id)).toEqual([
    'same-text-newer',
    'other-voice-same-text',
    'same-voice-other-text',
    'unrelated',
  ]);
});

it('approves and unapproves the take', () => {
  mock.history = [];
  const { rerender } = render(<TakeReview item={take('a')} />);
  fireEvent.click(screen.getByRole('button', { name: /clone.review_approve/ }));
  expect(mock.review).toHaveBeenCalledWith({ id: 'a', approved: true });

  rerender(<TakeReview item={take('a', { approved: 1 })} />);
  const approved = screen.getByRole('button', { name: /clone.review_approved/ });
  expect(approved).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(approved);
  expect(mock.review).toHaveBeenLastCalledWith({ id: 'a', approved: false });
});

it('saves the revision note only when it changed', () => {
  mock.history = [];
  render(<TakeReview item={take('a', { review_note: 'first pass' })} />);
  const save = screen.getByRole('button', { name: 'clone.review_note_save' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('clone.review_note_label'), {
    target: { value: 'slower ending' },
  });
  expect(save).toBeEnabled();
  fireEvent.click(save);
  expect(mock.review).toHaveBeenCalledWith({ id: 'a', note: 'slower ending' });
});

it('explains when there is nothing to compare', () => {
  mock.history = [take('a')];
  render(<TakeReview item={take('a')} />);
  expect(screen.getByText('clone.review_compare_none')).toBeInTheDocument();
  expect(screen.queryAllByTestId('player')).toHaveLength(0);
});
