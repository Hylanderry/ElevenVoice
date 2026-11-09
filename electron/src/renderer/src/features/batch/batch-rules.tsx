import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkIcon, CheckIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** A named batch setup: target languages (picker labels), voice and background choice. */
export interface BatchRule {
  id: string;
  name: string;
  langs: string[];
  voice: string;
  preserve: boolean;
}

export const BATCH_RULES_KEY = 'elevenvoice.batch.rules.v1';
const NAME_MAX = 60;
const NONE = '__none__';

function isRule(value: unknown): value is BatchRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    Array.isArray(rule.langs) &&
    rule.langs.every((lang) => typeof lang === 'string') &&
    typeof rule.voice === 'string' &&
    typeof rule.preserve === 'boolean'
  );
}

/** Saved rules; unreadable storage or malformed entries yield what can be kept. */
export function readBatchRules(): BatchRule[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BATCH_RULES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRule) : [];
  } catch {
    return [];
  }
}

function writeBatchRules(rules: BatchRule[]) {
  try {
    localStorage.setItem(BATCH_RULES_KEY, JSON.stringify(rules));
  } catch {
    // Storage full or blocked: the rules still apply for this session.
  }
}

/** Saving a name that already exists replaces that rule instead of adding a twin. */
export function upsertBatchRule(rules: BatchRule[], rule: Omit<BatchRule, 'id'>): BatchRule[] {
  const name = rule.name.trim().slice(0, NAME_MAX);
  const existing = rules.find((item) => item.name.toLowerCase() === name.toLowerCase());
  const saved: BatchRule = { ...rule, name, id: existing?.id ?? crypto.randomUUID() };
  return existing
    ? rules.map((item) => (item.id === existing.id ? saved : item))
    : [...rules, saved];
}

interface BatchRulesProps {
  langs: string[];
  voice: string;
  preserve: boolean;
  disabled?: boolean;
  onApply: (rule: BatchRule) => void;
}

/** Save the current batch setup under a name and reapply it later in one step. */
export function BatchRules({ langs, voice, preserve, disabled, onApply }: BatchRulesProps) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<BatchRule[]>(readBatchRules);
  const [selected, setSelected] = useState(NONE);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const update = (next: BatchRule[]) => {
    setRules(next);
    writeBatchRules(next);
  };
  const save = () => {
    if (!name.trim() || !langs.length) return;
    const next = upsertBatchRule(rules, { name, langs, voice, preserve });
    update(next);
    setSelected(next.find((rule) => rule.name === name.trim().slice(0, NAME_MAX))?.id ?? NONE);
    setNaming(false);
    setName('');
  };
  const items = [
    { value: NONE, label: t('batch.rules_pick') },
    ...rules.map((rule) => ({ value: rule.id, label: rule.name })),
  ];
  return (
    <section
      aria-labelledby="batch-rules-heading"
      className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3"
    >
      <h2
        id="batch-rules-heading"
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <BookmarkIcon className="size-4" />
        {t('batch.rules_title')}
      </h2>
      {rules.length ? (
        <div className="flex items-center gap-1">
          <Select
            items={items}
            value={selected}
            disabled={disabled}
            onValueChange={(value) => {
              const rule = rules.find((item) => item.id === value);
              setSelected(String(value));
              if (rule) onApply(rule);
            }}
          >
            <SelectTrigger aria-label={t('batch.rules_title')} className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected !== NONE ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('batch.rules_delete')}
              title={t('batch.rules_delete')}
              disabled={disabled}
              onClick={() => {
                update(rules.filter((rule) => rule.id !== selected));
                setSelected(NONE);
              }}
            >
              <Trash2Icon />
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('batch.rules_empty')}</p>
      )}
      {naming ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={NAME_MAX}
            aria-label={t('batch.rules_name')}
            placeholder={t('batch.rules_name')}
            onChange={(event) => setName(event.target.value)}
            className="h-8 min-w-0 flex-1 text-xs"
          />
          <Button
            type="submit"
            size="icon-sm"
            aria-label={t('batch.rules_save')}
            disabled={!name.trim() || !langs.length}
          >
            <CheckIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('common.cancel')}
            onClick={() => {
              setNaming(false);
              setName('');
            }}
          >
            <XIcon />
          </Button>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled || !langs.length}
          onClick={() => setNaming(true)}
        >
          <BookmarkIcon />
          {t('batch.rules_save_current')}
        </Button>
      )}
    </section>
  );
}
