import { buildOverlayUrl, normalizeChannel } from './link';

const STORAGE_KEY = 'meiro-chat:setup';

const channelInput = document.getElementById('channel') as HTMLInputElement;
const channelNote = document.getElementById('channel-note')!;
const sizeInput = document.getElementById('size') as HTMLInputElement;
const sizeValue = document.getElementById('size-value')!;
const copyButton = document.getElementById('copy') as HTMLButtonElement;
const copyNote = document.getElementById('copy-note')!;
const preview = document.getElementById('preview') as HTMLIFrameElement;
const fadeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="fade"]')];
const sideInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="side"]')];
const scene = preview.closest('.scene')!;

type Saved = { channel: string; fade: number; size: number; mirrored: boolean };

function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: settings just aren't remembered.
  }
}

function current(): Saved {
  return {
    channel: channelInput.value,
    fade: Number(fadeInputs.find(i => i.checked)?.value ?? 30),
    size: Number(sizeInput.value),
    mirrored: sideInputs.find(i => i.checked)?.value === 'right',
  };
}

let previewTimer: ReturnType<typeof setTimeout> | undefined;
let lastPreview = '';

function update() {
  const s = current();
  save(s);
  sizeValue.textContent = `${s.size}%`;
  // Move the preview to the side of the stand-in scene it will sit on in OBS.
  scene.classList.toggle('mirrored', s.mirrored);

  const channel = normalizeChannel(s.channel);
  const typed = s.channel.trim() !== '';
  channelInput.setAttribute('aria-invalid', String(typed && !channel));
  channelNote.className = typed && !channel ? 'note error' : 'note';
  channelNote.textContent = typed && !channel ? 'That doesn’t look like a Twitch channel name.' : '';

  copyButton.disabled = !channel;
  copyNote.className = 'note';
  copyNote.textContent = channel ? 'Then add it in OBS as a Browser source, 400 wide and 600 tall.' : 'Enter your channel name first.';

  // Reloading the iframe restarts the demo, so wait until a slider stops moving.
  const params = new URLSearchParams({ demo: '1' });
  if (s.fade !== 30) params.set('fade', String(s.fade));
  if (s.size !== 100) params.set('size', String(s.size));
  if (s.mirrored) params.set('mirrored', '1');
  const src = `./overlay.html?${params}`;
  if (src === lastPreview) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { preview.src = src; lastPreview = src; }, 250);
}

async function copy() {
  const channel = normalizeChannel(channelInput.value);
  if (!channel) return;
  const s = current();
  const link = buildOverlayUrl(new URL('.', location.href).href, { channel, fade: s.fade, size: s.size, mirrored: s.mirrored });
  try {
    await navigator.clipboard.writeText(link);
    copyNote.className = 'note ok';
    copyNote.textContent = 'Copied. In OBS: Sources → + → Browser, paste the link, set width 400 and height 600.';
  } catch {
    copyNote.className = 'note';
    copyNote.textContent = `Copy this link: ${link}`;
  }
}

const saved = load();
if (typeof saved.channel === 'string') channelInput.value = saved.channel;
if (typeof saved.size === 'number') sizeInput.value = String(saved.size);
for (const input of fadeInputs) input.checked = Number(input.value) === (saved.fade ?? 30);
for (const input of sideInputs) input.checked = input.value === (saved.mirrored === true ? 'right' : 'left');

channelInput.addEventListener('input', update);
sizeInput.addEventListener('input', update);
fadeInputs.forEach(i => i.addEventListener('change', update));
sideInputs.forEach(i => i.addEventListener('change', update));
copyButton.addEventListener('click', copy);
lastPreview = preview.getAttribute('src') ?? '';
update();
