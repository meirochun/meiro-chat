import { connectChat } from '../twitch/irc';
import { readConfig } from './config';
import { playDemo } from './demo';
import { createOverlay } from './render';

const config = readConfig(location.search);
const root = document.getElementById('log')!;
const overlay = createOverlay(root, config);

if (config.demo) {
  playDemo(overlay);
} else if (config.channel) {
  connectChat(config.channel, overlay.apply);
} else {
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Add ?channel=yourname to the link';
  root.append(hint);
}
