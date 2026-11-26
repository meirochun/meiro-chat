// Read-only, anonymous connection to Twitch chat. No login needed: Twitch accepts
// "justinfan<number>" nicknames for clients that only read.
import { parseLine, type ChatEvent } from './parse';

const CHAT_URL = 'wss://irc-ws.chat.twitch.tv:443';
const FIRST_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;
// Twitch PINGs about every 5 minutes. Hearing nothing for longer means the connection died
// silently (Wi-Fi drop, sleep) without the browser noticing, so start over.
const SILENCE_MS = 6 * 60_000;

/** The subset of WebSocket this module uses, so tests can pass a fake. */
export type SocketLike = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
};

export type ChatStatus = 'connecting' | 'live' | 'offline';

export function connectChat(
  channel: string,
  onEvent: (e: ChatEvent) => void,
  opts: { createSocket?: (url: string) => SocketLike; onStatus?: (s: ChatStatus) => void } = {},
): { close(): void } {
  const createSocket = opts.createSocket ?? (url => new WebSocket(url) as unknown as SocketLike);
  const login = channel.toLowerCase();
  let socket: SocketLike | null = null;
  let retryMs = FIRST_RETRY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  function watchSilence(current: SocketLike) {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (socket !== current || stopped) return;
      current.close();
      open();
    }, SILENCE_MS);
  }

  function open() {
    opts.onStatus?.('connecting');
    const current = createSocket(CHAT_URL);
    socket = current;
    watchSilence(current);
    // Handlers check `socket === current` so a replaced socket can't deliver events or schedule retries.
    current.onopen = () => {
      if (socket !== current) return;
      current.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      current.send('PASS SCHMOOPIIE');
      current.send(`NICK justinfan${10000 + Math.floor(Math.random() * 90000)}`);
      current.send(`JOIN #${login}`);
    };
    current.onmessage = e => {
      if (socket !== current) return;
      watchSilence(current);
      for (const line of String(e.data).split('\r\n')) {
        const parsed = parseLine(line);
        if (!parsed) continue;
        switch (parsed.kind) {
          case 'ping':
            current.send(`PONG :${parsed.payload}`);
            break;
          case 'joined':
            retryMs = FIRST_RETRY_MS;
            opts.onStatus?.('live');
            break;
          case 'reconnect':
            // Twitch is about to restart this server: switch right away.
            current.close();
            open();
            return;
          default:
            onEvent(parsed);
        }
      }
    };
    current.onclose = () => {
      if (socket !== current || stopped) return;
      socket = null;
      clearTimeout(silenceTimer);
      opts.onStatus?.('offline');
      retryTimer = setTimeout(open, retryMs);
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    };
  }

  open();
  return {
    close() {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(silenceTimer);
      socket?.close();
      socket = null;
    },
  };
}
