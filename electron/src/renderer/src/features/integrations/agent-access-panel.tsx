import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { apiJson } from '@/lib/api/client';

export interface AgentAccess {
  mcp: boolean;
  openai_api: boolean;
}

export function getAgentAccess(): Promise<AgentAccess> {
  return apiJson<AgentAccess>('/system/agent-access');
}

export function setAgentAccess(changes: Partial<AgentAccess>): Promise<AgentAccess> {
  return apiJson<AgentAccess>('/system/agent-access', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}

/** Switches for the local MCP server and the OpenAI-compatible API used by agents. */
export function AgentAccessPanel() {
  const { t } = useTranslation();
  const [access, setAccess] = useState<AgentAccess | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    getAgentAccess()
      .then((value) => live && setAccess(value))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const toggle = (key: keyof AgentAccess, value: boolean) => {
    setAccess((prev) => (prev ? { ...prev, [key]: value } : prev));
    setAgentAccess({ [key]: value })
      .then(setAccess)
      .catch(() => {
        setError(true);
        setAccess((prev) => (prev ? { ...prev, [key]: !value } : prev));
      });
  };

  const rows: { key: keyof AgentAccess; title: string; hint: string }[] = [
    {
      key: 'mcp',
      title: t('integrations.agentAccess.mcp', 'Local MCP server'),
      hint: t(
        'integrations.agentAccess.mcpHint',
        'Lets Claude, Cursor, Codex, Hermes and other agents on this computer use every ElevenVoice tool.',
      ),
    },
    {
      key: 'openai_api',
      title: t('integrations.agentAccess.api', 'Local API (OpenAI-compatible)'),
      hint: t(
        'integrations.agentAccess.apiHint',
        'Lets n8n, scripts and SDKs call speech and transcription at /v1 on this computer.',
      ),
    },
  ];

  return (
    <section className="agent-access" aria-label={t('integrations.agentAccess.title', 'Agent access')}>
      {rows.map((row) => (
        <label key={row.key} className="agent-access-row">
          <span>
            <strong>{row.title}</strong>
            <small>{row.hint}</small>
          </span>
          <Switch
            checked={access?.[row.key] ?? false}
            disabled={!access}
            onCheckedChange={(value: boolean) => toggle(row.key, value)}
            aria-label={row.title}
          />
        </label>
      ))}
      {error && (
        <p className="agent-access-error" role="status">
          {t('integrations.agentAccess.error', 'Could not reach the voice engine. Try again in a moment.')}
        </p>
      )}
    </section>
  );
}
