// Draws chat messages into the overlay. Ported from SetupStream's chat.html.
// All chat text goes through textContent; nothing a chatter types is ever parsed as HTML.
import type { ChatEvent, ChatMessage } from '../twitch/parse';
import { badgeIcon } from './badges';
import type { OverlayConfig } from './config';

const ICON_REPLY = 'M4 3h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 3v-3H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v8h5v1.5L11 13h5V5H4z';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function replyIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICON_REPLY);
  svg.append(path);
  return svg;
}

/** Twitch colors can be too dark to read; lift them like Twitch does. No color → a stable hue from the name. */
export function readableColor(hex: string | null, name: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex ?? '')) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 70% 60%)`;
  }
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex!.slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.35) return hex!;
  const mix = (c: number) => Math.round(c + (255 - c) * (0.35 - lum) * 1.6);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

export function createOverlay(root: HTMLElement, config: OverlayConfig) {
  const style = document.documentElement.style;
  style.setProperty('--name-size', `${config.nameSize}px`);
  style.setProperty('--text-size', `${config.textSize}px`);
  style.setProperty('--emote-size', `${config.emoteSize}px`);
  root.classList.toggle('mirrored', config.mirrored);

  // The last chat group, so consecutive messages from one user share a single name.
  let lastGroup: { node: HTMLElement; userId: string } | null = null;

  function fragmentsOf(m: ChatMessage): HTMLElement {
    const span = el('span', m.action ? 'text action' : 'text');
    span.dataset.msgId = m.id;
    for (const f of m.fragments) {
      if (f.type === 'emote' && f.imageUrl) {
        const img = el('img', 'emote') as HTMLImageElement;
        img.src = f.imageUrl;
        img.alt = f.text;
        span.append(img);
      } else {
        span.append(el('span', f.type === 'mention' ? 'mention' : '', f.text));
      }
    }
    return span;
  }

  function chatGroup(m: ChatMessage): HTMLElement {
    const group = el('div', m.reply ? 'msg thread' : 'msg');
    group.dataset.userId = m.userId;
    if (m.reply) {
      const reply = el('div', 'reply');
      reply.append(replyIcon(), el('span', '', `Replying to @${m.reply.parentUserName}: ${m.reply.parentMessageBody}`));
      group.append(reply);
    }

    const head = el('div', 'head');
    if (m.badges.length) {
      const badges = el('span', 'badges');
      badges.append(...m.badges.map(badgeIcon));
      head.append(badges);
    }
    const user = el('span', 'user', m.userName);
    user.style.color = readableColor(m.color, m.userName);
    head.append(user);
    group.append(head);
    return group;
  }

  // animationend bubbles, so each handler only reacts to its own node's animation.
  function onOwnAnimationEnd(node: HTMLElement, handler: () => void) {
    node.addEventListener('animationend', function listener(e) {
      if (e.target !== node) return;
      node.removeEventListener('animationend', listener);
      handler();
    });
  }

  function animateIn(node: HTMLElement) {
    node.classList.add('enter');
    onOwnAnimationEnd(node, () => node.classList.remove('enter'));
  }

  function fadeOut(node: HTMLElement) {
    if (!node.isConnected || node.classList.contains('leave')) return;
    node.classList.remove('enter');
    node.classList.add('leave');
    onOwnAnimationEnd(node, () => node.remove());
  }

  // Earlier lines of a group fade on their own; when the last line expires,
  // the whole group (name, badges and that line) fades out together.
  // Counted from arrival, not Twitch's timestamp: the OBS PC's clock may not match Twitch's.
  function expireLater(line: HTMLElement, group: HTMLElement) {
    if (config.fadeOutSeconds <= 0) return;
    setTimeout(() => {
      const othersLeft = [...group.querySelectorAll('.text')]
        .some(other => other !== line && !other.classList.contains('leave'));
      fadeOut(othersLeft ? line : group);
    }, config.fadeOutSeconds * 1000);
  }

  function canJoin(m: ChatMessage): boolean {
    return !m.action && !m.reply && lastGroup !== null
      && lastGroup.userId === m.userId
      && lastGroup.node === root.lastElementChild
      && !lastGroup.node.classList.contains('leave');
  }

  function remove(node: Element) {
    node.remove();
    if (lastGroup && !lastGroup.node.isConnected) lastGroup = null;
  }

  function add(m: ChatMessage, animate = true) {
    const line = fragmentsOf(m);
    if (canJoin(m)) {
      if (animate) animateIn(line);
      lastGroup!.node.append(line);
      expireLater(line, lastGroup!.node);
    } else {
      const group = chatGroup(m);
      group.append(line);
      if (animate) animateIn(group);
      root.append(group);
      expireLater(line, group);
      // Replies and /me keep their own group.
      lastGroup = m.reply || m.action ? null : { node: group, userId: m.userId };
    }

    while (root.childElementCount > config.maxRows) remove(root.firstElementChild!);
  }

  function apply(e: ChatEvent) {
    switch (e.kind) {
      case 'chat':
        add(e);
        break;
      case 'clearchat':
        for (const group of [...root.children] as HTMLElement[]) {
          if (e.userId === null || group.dataset.userId === e.userId) remove(group);
        }
        break;
      case 'clearmsg': {
        const line = ([...root.querySelectorAll('.text')] as HTMLElement[]).find(l => l.dataset.msgId === e.messageId);
        const group = line?.closest('.msg');
        if (!line || !group) break;
        remove(group.querySelectorAll('.text').length > 1 ? line : group);
        break;
      }
    }
  }

  return { add, apply };
}
