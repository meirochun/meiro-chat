import { emoteUrl, parseLine, type ChatMessage } from '../src/twitch/parse';

const privmsg = (tags: string, text: string) =>
  `@${tags} :ana!ana@ana.tmi.twitch.tv PRIVMSG #chan :${text}`;
const chat = (tags: string, text: string) => parseLine(privmsg(tags, text)) as ChatMessage;

test('basic message', () => {
  const m = chat('badges=moderator/1,glhf-pledge/1;color=#1E90FF;display-name=Ana;id=abc;user-id=7;tmi-sent-ts=1700000000000', 'hello');
  expect(m).toEqual({
    kind: 'chat', id: 'abc', userId: '7', userName: 'Ana', color: '#1E90FF',
    badges: ['moderator'], action: false, timestamp: 1700000000000, reply: null,
    fragments: [{ type: 'text', text: 'hello' }],
  });
});

test('keeps only known badges, in Twitch order', () => {
  expect(chat('badges=broadcaster/1,subscriber/12,vip/1,premium/1;id=a;user-id=1', 'x').badges)
    .toEqual(['broadcaster', 'subscriber', 'vip']);
});

test('empty color is null', () => {
  expect(chat('color=;id=a;user-id=1', 'x').color).toBeNull();
});

test('display name falls back to login', () => {
  expect(chat('display-name=;id=a;user-id=1', 'x').userName).toBe('ana');
});

test('emote ranges', () => {
  expect(chat('emotes=25:0-4;id=a;user-id=1', 'Kappa hi').fragments).toEqual([
    { type: 'emote', text: 'Kappa', imageUrl: emoteUrl('25') },
    { type: 'text', text: ' hi' },
  ]);
});

test('emote after emoji', () => {
  expect(chat('emotes=25:2-6;id=a;user-id=1', '😀 Kappa').fragments).toEqual([
    { type: 'text', text: '😀 ' },
    { type: 'emote', text: 'Kappa', imageUrl: emoteUrl('25') },
  ]);
});

test('same emote twice and two emotes', () => {
  const f = chat('emotes=25:0-4,12-16/1902:6-10;id=a;user-id=1', 'Kappa Keepo Kappa').fragments;
  expect(f.map(x => `${x.type}:${x.text}`)).toEqual(['emote:Kappa', 'text: ', 'emote:Keepo', 'text: ', 'emote:Kappa']);
});

test('emote url', () => {
  expect(emoteUrl('25')).toBe('https://static-cdn.jtvnw.net/emoticons/v2/25/default/dark/2.0');
});

test('mentions split', () => {
  expect(chat('id=a;user-id=1', 'hi @Bob!').fragments).toEqual([
    { type: 'text', text: 'hi ' },
    { type: 'mention', text: '@Bob' },
    { type: 'text', text: '!' },
  ]);
});

test('reply tags unescaped and leading mention removed', () => {
  const m = chat('id=a;user-id=1;reply-parent-display-name=Bob;reply-parent-user-login=bob;reply-parent-msg-body=hey\\sthere\\:)', '@bob sure');
  expect(m.reply).toEqual({ parentUserName: 'Bob', parentMessageBody: 'hey there;)' });
  expect(m.fragments).toEqual([{ type: 'text', text: 'sure' }]);
});

test('/me action', () => {
  const m = chat('id=a;user-id=1', '\u0001ACTION waves\u0001');
  expect(m.action).toBe(true);
  expect(m.fragments).toEqual([{ type: 'text', text: 'waves' }]);
});

test('missing timestamp uses now', () => {
  const before = Date.now();
  expect(chat('id=a;user-id=1', 'x').timestamp).toBeGreaterThanOrEqual(before);
});

test('CLEARCHAT user', () => {
  expect(parseLine('@room-id=1;target-user-id=7 :tmi.twitch.tv CLEARCHAT #chan :bob'))
    .toEqual({ kind: 'clearchat', userId: '7' });
});

test('CLEARCHAT all', () => {
  expect(parseLine('@room-id=1 :tmi.twitch.tv CLEARCHAT #chan')).toEqual({ kind: 'clearchat', userId: null });
});

test('CLEARMSG', () => {
  expect(parseLine('@login=bob;target-msg-id=abc :tmi.twitch.tv CLEARMSG #chan :x'))
    .toEqual({ kind: 'clearmsg', messageId: 'abc' });
});

test('PING, RECONNECT and end of JOIN', () => {
  expect(parseLine('PING :tmi.twitch.tv')).toEqual({ kind: 'ping', payload: 'tmi.twitch.tv' });
  expect(parseLine(':tmi.twitch.tv RECONNECT')).toEqual({ kind: 'reconnect' });
  expect(parseLine(':justinfan1.tmi.twitch.tv 366 justinfan1 #chan :End of /NAMES list')).toEqual({ kind: 'joined' });
});

test('unknown line', () => {
  expect(parseLine(':tmi.twitch.tv 001 x :Welcome')).toBeNull();
  expect(parseLine('')).toBeNull();
});

test('/me keeps emotes (positions count from the text without the ACTION wrapper)', () => {
  const m = chat('emotes=25:5-9;id=a;user-id=1', '\u0001ACTION hey! Kappa\u0001');
  expect(m.fragments).toEqual([
    { type: 'text', text: 'hey! ' },
    { type: 'emote', text: 'Kappa', imageUrl: emoteUrl('25') },
  ]);
});
