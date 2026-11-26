/** Accepts "Name", "#name", "@name" or a twitch.tv link and returns the login, or null if it can't be a channel. */
export function normalizeChannel(input: string): string | null {
  let value = input.trim();
  // Also accepts sub-pages like twitch.tv/popout/name/chat or dashboard.twitch.tv/u/name/...
  const link = value.match(/^(?:https?:\/\/)?(?:[a-z]+\.)?twitch\.tv\/(?:(?:popout|moderator|embed|u)\/)?([^/?#]+)/i);
  if (link) value = link[1];
  else if (/[/.]/.test(value)) return null;
  value = value.replace(/^[#@]/, '').toLowerCase();
  return /^[a-z0-9_]{3,25}$/.test(value) ? value : null;
}

const DEFAULTS = { fade: 30, size: 100 };

/** The link streamers paste into OBS. Settings left at their defaults are omitted to keep it short. */
export function buildOverlayUrl(
  base: string,
  s: { channel: string; fade: number; size: number; mirrored?: boolean },
): string {
  const url = new URL('overlay.html', base);
  url.searchParams.set('channel', s.channel);
  if (s.fade !== DEFAULTS.fade) url.searchParams.set('fade', String(s.fade));
  if (s.size !== DEFAULTS.size) url.searchParams.set('size', String(s.size));
  if (s.mirrored) url.searchParams.set('mirrored', '1');
  return url.href;
}
