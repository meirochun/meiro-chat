import { readConfig, type OverlayConfig } from '../src/overlay/config';
import { createOverlay, readableColor } from '../src/overlay/render';
import type { ChatMessage } from '../src/twitch/parse';

let n = 0;
function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  n++;
  return {
    kind: 'chat', id: `m${n}`, userId: 'u1', userName: 'Ana', color: '#1E90FF', badges: [],
    fragments: [{ type: 'text', text: `line ${n}` }], reply: null, action: false, timestamp: Date.now(), ...over,
  };
}

let root: HTMLElement;
function overlay(over: Partial<OverlayConfig> = {}) {
  return createOverlay(root, { ...readConfig('?fade=0'), ...over });
}

beforeEach(() => {
  root = document.createElement('main');
  document.body.replaceChildren(root);
});

test('groups consecutive messages from the same user', () => {
  const o = overlay();
  o.add(msg(), false);
  o.add(msg(), false);
  expect(root.querySelectorAll('.msg')).toHaveLength(1);
  expect(root.querySelectorAll('.msg .text')).toHaveLength(2);
  o.add(msg({ userId: 'u2', userName: 'Bob' }), false);
  expect(root.querySelectorAll('.msg')).toHaveLength(2);
});

test('shows name, badges and readable color', () => {
  overlay().add(msg({ badges: ['broadcaster', 'moderator'] }), false);
  expect(root.querySelector('.user')!.textContent).toBe('Ana');
  expect(root.querySelectorAll('.badges svg')).toHaveLength(2);
});

test('emotes and mentions', () => {
  overlay().add(msg({ fragments: [
    { type: 'emote', text: 'Kappa', imageUrl: 'https://e/25' },
    { type: 'mention', text: '@Bob' },
  ] }), false);
  const img = root.querySelector<HTMLImageElement>('img.emote')!;
  expect(img.src).toBe('https://e/25');
  expect(img.alt).toBe('Kappa');
  expect(root.querySelector('.mention')!.textContent).toBe('@Bob');
});

test('reply gets its own thread group', () => {
  const o = overlay();
  o.add(msg(), false);
  o.add(msg({ reply: { parentUserName: 'Bob', parentMessageBody: 'hey' } }), false);
  const thread = root.querySelector('.msg.thread')!;
  expect(thread.querySelector('.reply')!.textContent).toBe('Replying to @Bob: hey');
  expect(root.querySelectorAll('.msg')).toHaveLength(2);
});

test('renders chat text safely', () => {
  overlay().add(msg({ userName: '<b>x</b>', fragments: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] }), false);
  expect(root.querySelector('img')).toBeNull();
  expect(root.querySelector('b')).toBeNull();
  expect(root.textContent).toContain('<img src=x onerror=alert(1)>');
});

test('action messages are italic and start their own group', () => {
  const o = overlay();
  o.add(msg(), false);
  o.add(msg({ action: true }), false);
  expect(root.querySelectorAll('.msg')).toHaveLength(2);
  expect(root.querySelector('.msg:last-child .text')!.classList.contains('action')).toBe(true);
});

test('maxRows trims the oldest groups', () => {
  const o = overlay({ maxRows: 2 });
  for (const u of ['a', 'b', 'c']) o.add(msg({ userId: u, userName: u }), false);
  const names = [...root.querySelectorAll('.user')].map(e => e.textContent);
  expect(names).toEqual(['b', 'c']);
});

test('clearchat for a user removes only their lines', () => {
  const o = overlay();
  o.add(msg({ userId: 'bad', userName: 'Bad' }), false);
  o.add(msg({ userId: 'ok', userName: 'Ok' }), false);
  o.add(msg({ userId: 'bad', userName: 'Bad' }), false);
  o.apply({ kind: 'clearchat', userId: 'bad' });
  expect([...root.querySelectorAll('.user')].map(e => e.textContent)).toEqual(['Ok']);
});

test('clearchat for everyone empties the overlay', () => {
  const o = overlay();
  o.add(msg(), false);
  o.apply({ kind: 'clearchat', userId: null });
  expect(root.childElementCount).toBe(0);
});

test('clearmsg removes one line, and the group when it was the last', () => {
  const o = overlay();
  const a = msg(), b = msg();
  o.add(a, false);
  o.add(b, false);
  o.apply({ kind: 'clearmsg', messageId: a.id });
  expect(root.querySelectorAll('.text')).toHaveLength(1);
  o.apply({ kind: 'clearmsg', messageId: b.id });
  expect(root.childElementCount).toBe(0);
});

test('a new message after a cleared group starts a fresh group', () => {
  const o = overlay();
  const a = msg();
  o.add(a, false);
  o.apply({ kind: 'clearmsg', messageId: a.id });
  o.add(msg(), false);
  expect(root.querySelectorAll('.msg .user')).toHaveLength(1);
});

test('apply forwards chat messages', () => {
  overlay().apply(msg());
  expect(root.querySelectorAll('.msg')).toHaveLength(1);
});

test('fades out after the configured time', () => {
  vi.useFakeTimers();
  try {
    const o = overlay({ fadeOutSeconds: 30 });
    o.add(msg(), false);
    vi.advanceTimersByTime(29_000);
    expect(root.querySelector('.leave')).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(root.querySelector('.msg')!.classList.contains('leave')).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

test('readableColor lifts dark colors and keeps light ones', () => {
  expect(readableColor('#000000', 'a')).not.toBe('#000000');
  expect(readableColor('#FFFFFF', 'a')).toBe('#FFFFFF');
  expect(readableColor(null, 'ana')).toMatch(/^hsl\(/);
  expect(readableColor(null, 'ana')).toBe(readableColor(null, 'ana'));
});

test('fade time counts from arrival, so a wrong PC clock does not hide messages', () => {
  vi.useFakeTimers();
  try {
    const o = overlay({ fadeOutSeconds: 15 });
    o.add(msg({ timestamp: Date.now() - 60_000 }), false); // PC clock a minute ahead of Twitch
    vi.advanceTimersByTime(14_000);
    expect(root.querySelector('.leave')).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(root.querySelector('.leave')).not.toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
