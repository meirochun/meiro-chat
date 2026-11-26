// Scripted chat for the setup page preview (overlay.html?demo=1), so streamers can see
// the look without waiting for someone to type.
import { emoteUrl, type ChatMessage } from '../twitch/parse';

type DemoLine = Omit<ChatMessage, 'kind' | 'id' | 'timestamp'>;

const line = (over: Partial<DemoLine> & Pick<DemoLine, 'userId' | 'userName' | 'fragments'>): DemoLine => ({
  color: null, badges: [], reply: null, action: false, ...over,
});
const text = (t: string) => ({ type: 'text' as const, text: t });

const script: DemoLine[] = [
  line({ userId: '1', userName: 'You', color: '#9147FF', badges: ['broadcaster'], fragments: [text('Welcome in, chat! 👋')] }),
  line({ userId: '2', userName: 'PixelPanda', color: '#1E90FF', badges: ['moderator', 'subscriber'], fragments: [text('hey hey! ')] }),
  line({ userId: '2', userName: 'PixelPanda', color: '#1E90FF', badges: ['moderator', 'subscriber'],
    fragments: [text('the 3D chat looks sick '), { type: 'emote', text: 'Kappa', imageUrl: emoteUrl('25') }] }),
  line({ userId: '3', userName: 'lurker_42', fragments: [text('first time here, what are we building?')] }),
  line({ userId: '1', userName: 'You', color: '#9147FF', badges: ['broadcaster'],
    reply: { parentUserName: 'lurker_42', parentMessageBody: 'first time here, what are we building?' },
    fragments: [text('a chat overlay for OBS!')] }),
  line({ userId: '4', userName: 'NightOwl', color: '#FF69B4', badges: ['vip'], action: true, fragments: [text('grabs popcorn')] }),
  line({ userId: '5', userName: 'DarkMode', color: '#0B0B2B', badges: ['subscriber'],
    fragments: [{ type: 'mention', text: '@PixelPanda' }, text(' GG '), { type: 'emote', text: 'Keepo', imageUrl: emoteUrl('1902') }] }),
];

export const demoMessages: ChatMessage[] = script.map((m, i) => ({ ...m, kind: 'chat', id: `demo-${i}`, timestamp: 0 }));

/** Adds one demo message now and one every intervalMs, looping. Returns a function that stops it. */
export function playDemo(overlay: { add(m: ChatMessage): void }, intervalMs = 2000): () => void {
  let n = 0;
  const next = () => {
    const m = demoMessages[n % demoMessages.length];
    overlay.add({ ...m, id: `demo-${n}`, timestamp: Date.now() });
    n++;
  };
  next();
  const timer = setInterval(next, intervalMs);
  return () => clearInterval(timer);
}
