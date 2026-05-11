/**
 * Invite link helpers — single source of truth for the format that
 * inviters share and accept.tsx parses.
 *
 * Two URLs go in the share payload:
 *   1. komanda://invite/accept?code=XXXX-XXXX  (deep link, opens the app)
 *   2. https://komanda.app/invite/accept?code=XXXX-XXXX  (web fallback;
 *      rendered by the universal-link domain when configured, otherwise
 *      gives the recipient something tappable in any client)
 *
 * The recipient gets a one-tap path: tap link → app opens at accept.tsx
 * → screen auto-verifies the code from the URL params. No copy/paste.
 */

const APP_SCHEME = 'komanda';
const WEB_HOST = 'https://komanda.app';

export function buildInviteDeepLink(code: string): string {
  return `${APP_SCHEME}://invite/accept?code=${encodeURIComponent(code)}`;
}

export function buildInviteWebLink(code: string): string {
  return `${WEB_HOST}/invite/accept?code=${encodeURIComponent(code)}`;
}

export function buildInviteShareMessage(input: {
  code: string;
  orgName?: string | null;
}): string {
  const intro = input.orgName
    ? `${input.orgName} te invita a Komanda.`
    : 'Te invitan a Komanda.';
  return [
    intro,
    '',
    `Abre el enlace para unirte:`,
    buildInviteDeepLink(input.code),
    '',
    `Si no tienes la app, abre:`,
    buildInviteWebLink(input.code),
    '',
    `Código: ${input.code}`,
  ].join('\n');
}
