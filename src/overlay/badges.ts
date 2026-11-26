// Simple built-in badge icons. Real Twitch badge images need a login, which this overlay avoids.
import type { BadgeKind } from '../twitch/parse';

const BADGES: Record<BadgeKind, { title: string; color: string; path: string }> = {
  broadcaster: { title: 'Broadcaster', color: '#e91916', path: 'M3 6h9a1 1 0 0 1 1 1v1.5L17 6v8l-4-2.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z' },
  moderator: { title: 'Moderator', color: '#00ad03', path: 'M15 3h2v2l-7.5 7.5 1.5 1.5-1.5 1.5-1.5-1.5-3 3L3 15.5l3-3L4.5 11 6 9.5 7.5 11 15 3z' },
  vip: { title: 'VIP', color: '#e005b9', path: 'M6 4h8l3 4-7 9-7-9 3-4z' },
  subscriber: { title: 'Subscriber', color: '#9147ff', path: 'M10 2.5l2.3 4.8 5.2.7-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.7L10 2.5z' },
};

const SVG = 'http://www.w3.org/2000/svg';

export function badgeIcon(kind: BadgeKind): SVGElement {
  const { title, color, path } = BADGES[kind];
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  svg.classList.add('badge');

  const bg = document.createElementNS(SVG, 'rect');
  bg.setAttribute('width', '20');
  bg.setAttribute('height', '20');
  bg.setAttribute('rx', '3');
  bg.setAttribute('fill', color);
  const icon = document.createElementNS(SVG, 'path');
  icon.setAttribute('d', path);
  icon.setAttribute('fill', '#fff');
  const tooltip = document.createElementNS(SVG, 'title');
  tooltip.textContent = title;

  svg.append(tooltip, bg, icon);
  return svg;
}
