import { demoMessages, playDemo } from '../src/overlay/demo';
import type { ChatMessage } from '../src/twitch/parse';

test('demo covers every feature the preview should show', () => {
  expect(demoMessages.some(m => m.badges.length > 0)).toBe(true);
  expect(demoMessages.some(m => m.reply)).toBe(true);
  expect(demoMessages.some(m => m.action)).toBe(true);
  expect(demoMessages.some(m => m.color === null)).toBe(true);
  expect(demoMessages.some(m => m.fragments.some(f => f.type === 'emote'))).toBe(true);
  expect(demoMessages.some(m => m.fragments.some(f => f.type === 'mention'))).toBe(true);
  expect(demoMessages.some((m, i) => i > 0 && demoMessages[i - 1].userId === m.userId && !m.reply && !m.action)).toBe(true);
});

test('plays messages in a loop with fresh ids and timestamps until stopped', () => {
  vi.useFakeTimers();
  try {
    const added: ChatMessage[] = [];
    const stop = playDemo({ add: m => added.push(m) }, 100);
    expect(added).toHaveLength(1);
    vi.advanceTimersByTime(100 * demoMessages.length);
    expect(added).toHaveLength(demoMessages.length + 1);
    expect(new Set(added.map(m => m.id)).size).toBe(added.length);
    expect(added.at(-1)!.timestamp).toBe(Date.now());
    stop();
    vi.advanceTimersByTime(1000);
    expect(added).toHaveLength(demoMessages.length + 1);
  } finally {
    vi.useRealTimers();
  }
});
