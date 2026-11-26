import { readConfig } from '../src/overlay/config';

test('defaults match the original overlay', () => {
  expect(readConfig('')).toEqual({
    channel: null, demo: false, mirrored: false, fadeOutSeconds: 30, nameSize: 20, textSize: 18, emoteSize: 32, maxRows: 60,
  });
});

test('size scales name, text and emote together', () => {
  expect(readConfig('?size=150')).toMatchObject({ nameSize: 30, textSize: 27, emoteSize: 48 });
});

test('explicit sizes override size', () => {
  expect(readConfig('?size=150&textSize=10')).toMatchObject({ nameSize: 30, textSize: 10, emoteSize: 48 });
});

test('channel is lower-cased', () => {
  expect(readConfig('?channel=Bob').channel).toBe('bob');
});

test('invalid numbers fall back to defaults', () => {
  expect(readConfig('?fade=abc&size=-5').fadeOutSeconds).toBe(30);
  expect(readConfig('?size=-5').textSize).toBe(18);
});

test('fade 0 means never', () => {
  expect(readConfig('?fade=0').fadeOutSeconds).toBe(0);
});

test('demo flag', () => {
  expect(readConfig('?demo=1').demo).toBe(true);
});

test('mirrored only for mirrored=1', () => {
  expect(readConfig('?mirrored=1').mirrored).toBe(true);
  expect(readConfig('?mirrored=0').mirrored).toBe(false);
  expect(readConfig('?mirrored=true').mirrored).toBe(false);
});
