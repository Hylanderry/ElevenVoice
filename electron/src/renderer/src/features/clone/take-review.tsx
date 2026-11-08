import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2Icon, CircleIcon, GitCompareArrowsIcon, NotebookPenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WaveformPlayer } from '@/components/waveform-player';
import { audioUrl } from '@/lib/api/client';
import type { HistoryItem } from '@/lib/api/types';
import { useHistory, useReviewTake } from '@/hooks/use-history';
import { cn } from '@/lib/utils';
import { displayTitle, formatRelative } from './format';

const NOTE_MAX = 2000;
const NO_COMPARE = '__none__';

/**
 * Other takes worth comparing with `item`, best matches first: the same script,
 * then the same voice, then everything else; newest first inside each group.
 */
export function compareCandidates(item: HistoryItem, all: HistoryItem[]): HistoryItem[] {
  const rank = (other: HistoryItem) =>
    other.text?.trim() === item.text?.trim() ? 0 : other.profile_id === item.profile_id ? 1 : 2;
  const time = (value: HistoryItem['created_at']) =>
    typeof value === 'number' ? value : Date.parse(value) / 1000 || 0;
  return all
    .filter((other) => other.id !== item.id && other.audio_path)
    .sort((a, b) => rank(a) - rank(b) || time(b.created_at) - time(a.created_at));
}

function ApproveButton({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  const review = useReviewTake();
  const approved = Boolean(item.approved);
  return (
    <Button
      type="button"
      size="sm"
      variant={approved ? 'secondary' : 'outline'}
      aria-pressed={approved}
      disabled={review.isPending}
      onClick={() => review.mutate({ id: item.id, approved: !approved })}
      className={cn(approved && 'text-success')}
    >
      {approved ? (
        <CheckCircle2Icon data-icon="inline-start" />
      ) : (
        <CircleIcon data-icon="inline-start" />
      )}
      {t(approved ? 'clone.review_approved' : 'clone.review_approve')}
    </Button>
  );
}

function ReviewNote({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  const review = useReviewTake();
  const saved = item.review_note ?? '';
  const [draft, setDraft] = useState(saved);
  // A refetched take (or another take opened in this panel) resets the draft.
  useEffect(() => setDraft(saved), [item.id, saved]);
  const dirty = draft.trim() !== saved.trim();
  return (
    <div className="space-y-2">
      <label htmlFor={`take-note-${item.id}`} className="flex items-center gap-2 text-sm">
        <NotebookPenIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        {t('clone.review_note_label')}
      </label>
      <Textarea
        id={`take-note-${item.id}`}
        value={draft}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder={t('clone.review_note_placeholder')}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(saved)}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={!dirty || review.isPending}
          onClick={() => review.mutate({ id: item.id, note: draft })}
        >
          {t('clone.review_note_save')}
        </Button>
      </div>
    </div>
  );
}

function ComparePane({ label, take }: { label: string; take: HistoryItem }) {
  const { i18n } = useTranslation();
  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {formatRelative(take.created_at, i18n.language)}
        </span>
        <ApproveButton item={take} />
      </div>
      <WaveformPlayer
        src={audioUrl(take.audio_path)}
        source={'compare-' + label + '-' + take.id}
        durationHint={take.duration_seconds ?? undefined}
        height={48}
      />
      {take.review_note ? (
        <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{take.review_note}</p>
      ) : null}
    </div>
  );
}

function CompareTakes({ item }: { item: HistoryItem }) {
  const { t, i18n } = useTranslation();
  const history = useHistory();
  const candidates = useMemo(
    () => compareCandidates(item, history.data ?? []),
    [item, history.data],
  );
  const [otherId, setOtherId] = useState<string>(NO_COMPARE);
  useEffect(() => setOtherId(NO_COMPARE), [item.id]);
  const other = candidates.find((take) => take.id === otherId);
  const items = [
    { value: NO_COMPARE, label: t('clone.review_compare_pick') },
    ...candidates.map((take) => ({
      value: take.id,
      label: `${displayTitle(take.text)} · ${formatRelative(take.created_at, i18n.language)}`,
    })),
  ];
  if (!item.audio_path) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm">
          <GitCompareArrowsIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          {t('clone.review_compare')}
        </p>
        {candidates.length ? (
          <Select
            items={items}
            value={otherId}
            onValueChange={(value) => setOtherId(String(value))}
          >
            <SelectTrigger aria-label={t('clone.review_compare')} className="max-w-64 min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {items.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">{t('clone.review_compare_none')}</span>
        )}
      </div>
      {other ? (
        <div className="grid gap-2 @lg:grid-cols-2">
          <ComparePane label="A" take={item} />
          <ComparePane label="B" take={other} />
        </div>
      ) : null}
    </div>
  );
}

/** Version review: approve the take a project signs off on, note what changed, compare A/B. */
export function TakeReview({ item }: { item: HistoryItem }) {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby={`take-review-${item.id}`}
      className="@container space-y-4 rounded-xl border border-border/60 bg-muted/10 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`take-review-${item.id}`} className="text-sm font-medium">
          {t('clone.review_title')}
        </h3>
        <ApproveButton item={item} />
      </div>
      <ReviewNote item={item} />
      <CompareTakes item={item} />
    </section>
  );
}
