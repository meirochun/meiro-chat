import { buildOverlayUrl, normalizeChannel } from '../src/setup/link';

test.each([
  ['Bob_1', 'bob_1'],
  [' #bob ', 'bob'],
  ['@bob', 'bob'],
  ['https://www.twitch.tv/Bob?x=1', 'bob'],
  ['twitch.tv/bob/videos', 'bob'],
  ['https://m.twitch.tv/bob', 'bob'],
])('normalizeChannel(%j) → %j', (input, expected) => {
  expect(normalizeChannel(input)).toBe(expected);
});

test.each(['a b', '', 'ab', 'x'.repeat(26), 'bob!', 'https://youtube.com/bob'])('normalizeChannel(%j) → null', input => {
  expect(normalizeChannel(input)).toBeNull();
});

const base = 'https://x.github.io/meiro-chat/';

test('defaults are left out of the link', () => {
  expect(buildOverlayUrl(base, { channel: 'bob', fade: 30, size: 100 })).toBe('https://x.github.io/meiro-chat/overlay.html?channel=bob');
});

test('non-default settings are included', () => {
  expect(buildOverlayUrl(base, { channel: 'bob', fade: 60, size: 120 }))
    .toBe('https://x.github.io/meiro-chat/overlay.html?channel=bob&fade=60&size=120');
  expect(buildOverlayUrl(base, { channel: 'bob', fade: 0, size: 100 }))
    .toBe('https://x.github.io/meiro-chat/overlay.html?channel=bob&fade=0');
});

test('mirrored is added only when on', () => {
  expect(buildOverlayUrl(base, { channel: 'bob', fade: 30, size: 100, mirrored: true }))
    .toBe('https://x.github.io/meiro-chat/overlay.html?channel=bob&mirrored=1');
  expect(buildOverlayUrl(base, { channel: 'bob', fade: 30, size: 100, mirrored: false }))
    .toBe('https://x.github.io/meiro-chat/overlay.html?channel=bob');
});

test('works with a local dev base', () => {
  expect(buildOverlayUrl('http://localhost:5174/', { channel: 'bob', fade: 30, size: 100 }))
    .toBe('http://localhost:5174/overlay.html?channel=bob');
});

test.each([
  ['https://www.twitch.tv/popout/Bob/chat?popout=', 'bob'],
  ['twitch.tv/moderator/bob', 'bob'],
  ['https://www.twitch.tv/embed/bob/chat?parent=x', 'bob'],
  ['https://dashboard.twitch.tv/u/bob/stream-manager', 'bob'],
])('twitch.tv sub-pages: normalizeChannel(%j) → %j', (input, expected) => {
  expect(normalizeChannel(input)).toBe(expected);
});
