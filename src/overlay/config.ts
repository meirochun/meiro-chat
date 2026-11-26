// Overlay settings come from the URL so OBS only needs a link.
// e.g. overlay.html?channel=meiro&fade=60&size=120

export type OverlayConfig = {
  channel: string | null;
  /** Play scripted messages instead of connecting (used by the setup page preview). */
  demo: boolean;
  /** Right-aligns the chat and tilts it the other way, for overlays on the right side of the screen. */
  mirrored: boolean;
  /** 0 keeps messages until they're pushed off the top. */
  fadeOutSeconds: number;
  nameSize: number;
  textSize: number;
  emoteSize: number;
  /** Message groups kept on the page. */
  maxRows: number;
};

const BASE = { nameSize: 20, textSize: 18, emoteSize: 32 };

export function readConfig(search: string): OverlayConfig {
  const params = new URLSearchParams(search);
  const number = (key: string, fallback: number, min = 0) => {
    const value = parseFloat(params.get(key) ?? '');
    return Number.isFinite(value) && value >= min ? value : fallback;
  };
  const scale = number('size', 100, 1) / 100;
  const scaled = (key: keyof typeof BASE) => number(key, Math.round(BASE[key] * scale), 1);

  return {
    channel: params.get('channel')?.trim().toLowerCase() || null,
    demo: params.get('demo') === '1',
    mirrored: params.get('mirrored') === '1',
    fadeOutSeconds: number('fade', 30),
    nameSize: scaled('nameSize'),
    textSize: scaled('textSize'),
    emoteSize: scaled('emoteSize'),
    maxRows: number('maxRows', 60, 1),
  };
}
