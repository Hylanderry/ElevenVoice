import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ open: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/components/bridge', () => ({
  getBridge: () => ({ files: { openExternal: mock.open } }),
}));
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
import { SupportSettings } from './support-settings';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const REPO = 'https://github.com/Hylanderry/ElevenVoice';

it('links the star and creator profile to the ElevenVoice project', () => {
  render(<SupportSettings />);
  expect(mock.open).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'support.star_github' })).toHaveAttribute('href', REPO);
  const creator = screen.getByRole('link', { name: 'support.creator_profile' });
  expect(creator).toHaveAttribute('href', 'https://github.com/Hylanderry');
  fireEvent.click(creator);
  expect(mock.open).toHaveBeenCalledOnce();
  expect(mock.open).toHaveBeenCalledWith('https://github.com/Hylanderry');
});

it('keeps every contact channel on the project and offers no payments', () => {
  render(<SupportSettings />);
  expect(screen.getByRole('link', { name: 'contact.feature_cta' })).toHaveAttribute(
    'href',
    `${REPO}/issues`,
  );
  expect(screen.getByRole('link', { name: 'contact.community_cta' })).toHaveAttribute(
    'href',
    `${REPO}/discussions`,
  );
  expect(screen.getByRole('link', { name: 'contact.security_cta' })).toHaveAttribute(
    'href',
    `${REPO}/security/advisories/new`,
  );
  for (const name of ['PayPal', 'Ko-fi', 'GitHub Sponsors', 'supportPlans.get_pro'])
    expect(screen.queryByRole('link', { name })).toBeNull();
  expect(document.body.textContent).not.toMatch(/debpalash|palashCoder|\$\d+/);
});
