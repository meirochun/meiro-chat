// Turns raw Twitch chat (IRC) lines into plain objects the overlay can render.
// Reference: https://dev.twitch.tv/docs/chat/irc/ and https://dev.twitch.tv/docs/chat/irc/#irc-tags

export type BadgeKind = 'broadcaster' | 'moderator' | 'vip' | 'subscriber';

export type Fragment = { type: 'text' | 'emote' | 'mention'; text: string; imageUrl?: string };

export type ChatMessage = {
  kind: 'chat';
  id: string;
  userId: string;
  userName: string;
  color: string | null;
  badges: BadgeKind[];
  fragments: Fragment[];
  reply: { parentUserName: string; parentMessageBody: string } | null;
  /** True for /me messages. */
  action: boolean;
  /** Milliseconds since epoch. */
  timestamp: number;
};

/** A ban or timeout (userId) or "/clear" (userId null). */
export type ClearChat = { kind: 'clearchat'; userId: string | null };
/** A single deleted message. */
export type ClearMsg = { kind: 'clearmsg'; messageId: string };

export type ChatEvent = ChatMessage | ClearChat | ClearMsg;

export type IrcLine = ChatEvent | { kind: 'ping'; payload: string } | { kind: 'reconnect' } | { kind: 'joined' };

const KNOWN_BADGES: readonly BadgeKind[] = ['broadcaster', 'moderator', 'vip', 'subscriber'];

export function emoteUrl(id: string): string {
  // "default" serves the animated version when the emote has one.
  return `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/2.0`;
}

/** Parses one IRC line, or returns null for anything the overlay doesn't need. */
export function parseLine(line: string): IrcLine | null {
  let rest = line.replace(/\r?\n$/, '');
  if (!rest) return null;

  let tags: Record<string, string> = {};
  if (rest.startsWith('@')) {
    const space = rest.indexOf(' ');
    tags = parseTags(rest.slice(1, space));
    rest = rest.slice(space + 1);
  }

  let prefix = '';
  if (rest.startsWith(':')) {
    const space = rest.indexOf(' ');
    prefix = rest.slice(1, space);
    rest = rest.slice(space + 1);
  }

  const trailingAt = rest.indexOf(' :');
  const head = trailingAt >= 0 ? rest.slice(0, trailingAt) : rest;
  const trailing = trailingAt >= 0 ? rest.slice(trailingAt + 2) : rest.startsWith(':') ? rest.slice(1) : '';
  const command = head.split(' ')[0];

  switch (command) {
    case 'PING':
      return { kind: 'ping', payload: trailing || head.slice(5).replace(/^:/, '') };
    case 'RECONNECT':
      return { kind: 'reconnect' };
    case '366':
      return { kind: 'joined' };
    case 'CLEARCHAT':
      return { kind: 'clearchat', userId: tags['target-user-id'] || null };
    case 'CLEARMSG':
      return tags['target-msg-id'] ? { kind: 'clearmsg', messageId: tags['target-msg-id'] } : null;
    case 'PRIVMSG':
      return toChatMessage(tags, prefix.split('!')[0], trailing);
    default:
      return null;
  }
}

function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const pair of raw.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) tags[pair] = '';
    else tags[pair.slice(0, eq)] = unescapeTag(pair.slice(eq + 1));
  }
  return tags;
}

function unescapeTag(value: string): string {
  return value.replace(/\\(.?)/g, (_, c: string) =>
    ({ s: ' ', ':': ';', '\\': '\\', r: '\r', n: '\n' } as Record<string, string>)[c] ?? c);
}

function toChatMessage(tags: Record<string, string>, login: string, text: string): ChatMessage {
  let body = text;
  let emotes = tags['emotes'] ?? '';
  const action = /^\u0001ACTION .*\u0001$/.test(body);
  // Twitch counts /me emote positions from the text without the ACTION wrapper, so no shift here.
  if (action) body = body.slice(8, -1);

  let reply: ChatMessage['reply'] = null;
  if (tags['reply-parent-display-name'] !== undefined) {
    reply = { parentUserName: tags['reply-parent-display-name'], parentMessageBody: tags['reply-parent-msg-body'] ?? '' };
    // Twitch prepends "@parent " to the text of a reply; the reply chip already shows who it's for.
    const lead = `@${tags['reply-parent-user-login'] ?? ''} `;
    if (tags['reply-parent-user-login'] && body.toLowerCase().startsWith(lead.toLowerCase())) {
      const cut = Array.from(lead).length;
      body = Array.from(body).slice(cut).join('');
      emotes = shiftEmotes(emotes, -cut);
    }
  }

  const sent = Number(tags['tmi-sent-ts']);
  const badges = (tags['badges'] ?? '').split(',').map(b => b.split('/')[0])
    .filter((b): b is BadgeKind => (KNOWN_BADGES as string[]).includes(b));

  return {
    kind: 'chat',
    id: tags['id'] ?? '',
    userId: tags['user-id'] ?? '',
    userName: tags['display-name'] || login,
    color: tags['color'] || null,
    badges,
    fragments: fragmentsOf(body, emotes),
    reply,
    action,
    timestamp: Number.isFinite(sent) && sent > 0 ? sent : Date.now(),
  };
}

type EmoteRange = { id: string; start: number; end: number };

function emoteRanges(tag: string): EmoteRange[] {
  const ranges: EmoteRange[] = [];
  for (const group of tag.split('/').filter(Boolean)) {
    const [id, positions = ''] = group.split(':');
    for (const pos of positions.split(',').filter(Boolean)) {
      const [start, end] = pos.split('-').map(Number);
      if (Number.isInteger(start) && Number.isInteger(end)) ranges.push({ id, start, end });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}

function shiftEmotes(tag: string, by: number): string {
  if (!tag) return tag;
  return tag.split('/').map(group => {
    const [id, positions = ''] = group.split(':');
    const moved = positions.split(',').map(p => p.split('-').map(n => Number(n) + by).join('-'));
    return `${id}:${moved.join(',')}`;
  }).join('/');
}

/** Emote positions count Unicode code points, so work on Array.from(text) rather than UTF-16 indexes. */
function fragmentsOf(text: string, emotesTag: string): Fragment[] {
  const chars = Array.from(text);
  const fragments: Fragment[] = [];
  let at = 0;
  for (const { id, start, end } of emoteRanges(emotesTag)) {
    if (start < at || end >= chars.length) continue;
    if (start > at) fragments.push(...textFragments(chars.slice(at, start).join('')));
    fragments.push({ type: 'emote', text: chars.slice(start, end + 1).join(''), imageUrl: emoteUrl(id) });
    at = end + 1;
  }
  if (at < chars.length) fragments.push(...textFragments(chars.slice(at).join('')));
  return fragments;
}

function textFragments(text: string): Fragment[] {
  return text.split(/(@\w+)/).filter(Boolean)
    .map(part => ({ type: /^@\w+$/.test(part) ? 'mention' : 'text', text: part }));
}
