# meiro-chat

A 3D chat overlay for your Twitch stream. No login, nothing to install.

![The setup page with a live preview of the chat](docs/images/setup.png)

Messages tilt into the scene, names glow in each chatter's color, and lines rise in and fade out on their own.
Emotes, replies, mentions, `/me` messages and mod/VIP/sub badges are shown. When a mod deletes a message or times
someone out, it disappears from the overlay too.

## Use it

1. Open the meiro-chat page and type your Twitch channel.
2. Pick how long messages stay and the text size, and watch the preview.
3. Click **Copy OBS link**. In OBS, add a **Browser** source, paste the link, and set width **400** and height **600**.

That's it. The link holds only your channel name and settings, so it's safe to share.

### Link settings

The setup page writes these for you. You can also edit the link by hand:

| Parameter | Default | Meaning |
|---|---|---|
| `channel` | -- | Twitch channel to show |
| `fade` | `30` | Seconds before a message fades out (`0` = never) |
| `mirrored` | -- | Mirrors the chat |
| `size` | `100` | Overall size in percent (scales the three sizes below) |
| `nameSize` | `20` | Username font size (px) |
| `textSize` | `18` | Message font size (px) |
| `emoteSize` | `32` | Emote height (px) |
| `maxRows` | `60` | Message groups kept on the page |
| `demo` | -- | `1` plays sample messages instead of connecting |

Example: `overlay.html?channel=yourname&fade=60&size=120`

## How it works

The overlay connects straight from OBS's browser to Twitch chat over a WebSocket, the read-only way
Twitch allows without logging in. There's no server and no account: your browser talks to Twitch
directly and nothing is sent anywhere else. Because there's no login, channel point redemptions and
your channel's own badge images aren't available; built-in icons stand in for the badges.

| Path | What |
|---|---|
| `src/twitch/irc.ts` | Connects to Twitch chat, answers pings, reconnects with backoff |
| `src/twitch/parse.ts` | Turns raw chat lines into messages (emotes, replies, badges, deletions) |
| `src/overlay/` | The overlay: settings from the link, rendering, demo messages |
| `src/setup/` | The setup page |

## Develop

```sh
npm install
npm run dev     # http://localhost:5173/ (setup page) and /overlay.html?demo=1
npm test
npm run build   # static site in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`
(enable it once under **Settings → Pages → Source: GitHub Actions**).

Born on stream as part of SetupStream, a C# Twitch toolkit. MIT licensed.
