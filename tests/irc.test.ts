import { connectChat, type SocketLike } from '../src/twitch/irc';
import type { ChatEvent } from '../src/twitch/parse';

class FakeSocket implements SocketLike {
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {}
  send(data: string) { this.sent.push(data); }
  close() { this.closed = true; }
  receive(data: string) { this.onmessage?.({ data }); }
}

let sockets: FakeSocket[];
let events: ChatEvent[];
let statuses: string[];
const last = () => sockets[sockets.length - 1];

function connect(channel = 'Chan') {
  return connectChat(channel, e => events.push(e), {
    createSocket: url => { const s = new FakeSocket(url); sockets.push(s); return s; },
    onStatus: s => statuses.push(s),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  events = [];
  statuses = [];
});
afterEach(() => vi.useRealTimers());

test('connects to Twitch chat and sends the anonymous handshake on open', () => {
  connect();
  expect(sockets).toHaveLength(1);
  expect(last().url).toBe('wss://irc-ws.chat.twitch.tv:443');
  last().onopen!();
  expect(last().sent).toEqual([
    'CAP REQ :twitch.tv/tags twitch.tv/commands',
    'PASS SCHMOOPIIE',
    expect.stringMatching(/^NICK justinfan\d{5}$/),
    'JOIN #chan',
  ]);
});

test('answers PING', () => {
  connect();
  last().receive('PING :tmi.twitch.tv\r\n');
  expect(last().sent).toContain('PONG :tmi.twitch.tv');
});

test('splits multi-line frames and forwards chat events', () => {
  connect();
  last().receive('@id=1;user-id=1 :a!a@a PRIVMSG #chan :one\r\n@id=2;user-id=1 :a!a@a PRIVMSG #chan :two\r\n');
  expect(events.map(e => e.kind === 'chat' && e.id)).toEqual(['1', '2']);
});

test('forwards CLEARCHAT and CLEARMSG', () => {
  connect();
  last().receive('@target-user-id=7 :tmi.twitch.tv CLEARCHAT #chan :bob\r\n@target-msg-id=m :tmi.twitch.tv CLEARMSG #chan :x\r\n');
  expect(events).toEqual([{ kind: 'clearchat', userId: '7' }, { kind: 'clearmsg', messageId: 'm' }]);
});

test('reconnects with doubling backoff capped at 30 s, reset once joined', () => {
  connect();
  last().onclose!();
  vi.advanceTimersByTime(999);
  expect(sockets).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(sockets).toHaveLength(2);

  last().onclose!();
  vi.advanceTimersByTime(1999);
  expect(sockets).toHaveLength(2);
  vi.advanceTimersByTime(1);
  expect(sockets).toHaveLength(3);

  for (const wait of [4000, 8000, 16000, 30000, 30000]) {
    last().onclose!();
    vi.advanceTimersByTime(wait - 1);
    const before = sockets.length;
    vi.advanceTimersByTime(1);
    expect(sockets.length).toBe(before + 1);
  }

  last().receive(':justinfan1.tmi.twitch.tv 366 justinfan1 #chan :End of /NAMES list\r\n');
  last().onclose!();
  vi.advanceTimersByTime(1000);
  expect(sockets).toHaveLength(9);
});

test('RECONNECT closes the old socket and opens exactly one new one', () => {
  connect();
  const old = last();
  old.receive(':tmi.twitch.tv RECONNECT\r\n');
  old.onclose?.(); // the browser fires close after close()
  vi.advanceTimersByTime(60_000);
  expect(old.closed).toBe(true);
  expect(sockets).toHaveLength(2);
});

test('events from a replaced socket are ignored', () => {
  connect();
  const old = last();
  old.receive(':tmi.twitch.tv RECONNECT\r\n');
  vi.advanceTimersByTime(60_000);
  old.receive('@id=x;user-id=1 :a!a@a PRIVMSG #chan :late\r\n');
  old.onclose?.();
  vi.advanceTimersByTime(60_000);
  expect(events).toEqual([]);
  expect(sockets).toHaveLength(2);
});

test('close() stops reconnecting', () => {
  const chat = connect();
  chat.close();
  expect(last().closed).toBe(true);
  last().onclose?.();
  vi.advanceTimersByTime(60_000);
  expect(sockets).toHaveLength(1);
});

test('reports status', () => {
  connect();
  last().receive(':x 366 justinfan1 #chan :End\r\n');
  last().onclose!();
  expect(statuses).toEqual(['connecting', 'live', 'offline']);
});

test('reconnects when the connection goes silent for 6 minutes', () => {
  connect();
  const first = last();
  first.onopen!();
  vi.advanceTimersByTime(300_000);
  first.receive('PING :tmi.twitch.tv\r\n'); // any traffic resets the watchdog
  vi.advanceTimersByTime(359_999);
  expect(sockets).toHaveLength(1);
  vi.advanceTimersByTime(1);
  expect(first.closed).toBe(true);
  expect(sockets).toHaveLength(2);
});

test('close() also stops the silence watchdog', () => {
  const chat = connect();
  chat.close();
  vi.advanceTimersByTime(3_600_000);
  expect(sockets).toHaveLength(1);
});
