# WT AutoRead Story Bot

<div align="center">

> Auto read & like WhatsApp stories automatically

**by [Wisky-NM](https://github.com/Wisky-NM)**

</div>

---

## Disclaimer

> **This bot violates WhatsApp's Terms of Service.**
> Using this bot may result in your number being **temporarily or permanently banned**.
> The developer is **not responsible** for any consequences resulting from the use of this bot.
> **Use at your own risk.**

---

## Features

- Auto read stories
- Auto like stories with random emoji
- Download media from stories (photo, video, audio)
- Number hiding (sensor)
- Anti-call
- Auto kick members who tag group in story
- Blacklist & whitelist support
- View-once media retrieval

---

## Requirements

- Node.js v18+
- npm

---

## Installation

```bash
git clone https://github.com/Wisky-NM/wt-autoread-bot.git
cd wt-autoread-bot
npm install
node index.js
```

---

## config.json

```json
{
    "autoReadStatus": true,
    "autoLikeStatus": true,
    "downloadMediaStatus": false,
    "sensorNomor": false,
    "antiTelpon": false,
    "autoKickStory": false,
    "blackList": [],
    "whiteList": [],
    "emojis": ["💚", "♥️", "🖤"]
}
```

---

## Commands

All commands are sent to **yourself** on WhatsApp.

### ON — Enable Features

| Command | Description |
|---------|-------------|
| `#on autoread` | Enable auto read story |
| `#on autolike` | Enable auto like story |
| `#on dlmedia` | Enable download media from story |
| `#on sensornomor` | Enable number hiding |
| `#on antitelpon` | Enable anti-call |
| `#on kickstory` | Enable auto kick group tag in story |

### OFF — Disable Features

| Command | Description |
|---------|-------------|
| `#off autoread` | Disable auto read story |
| `#off autolike` | Disable auto like story |
| `#off dlmedia` | Disable download media from story |
| `#off sensornomor` | Disable number hiding |
| `#off antitelpon` | Disable anti-call |
| `#off kickstory` | Disable auto kick group tag in story |

### ADD — Add to Lists

| Command | Description |
|---------|-------------|
| `#add blacklist 628xxx` | Add number to blacklist |
| `#add whitelist 628xxx` | Add number to whitelist |
| `#add emojis 🩶` | Add emoji to reaction list |

### REMOVE — Remove from Lists

| Command | Description |
|---------|-------------|
| `#remove blacklist 628xxx` | Remove number from blacklist |
| `#remove whitelist 628xxx` | Remove number from whitelist |
| `#remove emojis 🩶` | Remove emoji from reaction list |

### INFO & MENU

| Command | Description |
|---------|-------------|
| `#info` | Show current feature status and all lists |
| `#menu` | Show all available commands |

### VIEWONCE

| Command | Description |
|---------|-------------|
| `#viewonce` | Reply to a view-once message to retrieve it |

---

## Notes

- **Blacklist:** numbers in this list will be ignored (stories not viewed)
- **Whitelist:** if not empty, only numbers in this list will be viewed
- **Emojis:** one random emoji is picked from the list for each reaction

---

## License

MIT License — Free to use and modify.

---

<div align="center">
Made with love by <a href="https://github.com/Wisky-NM">Wisky-NM</a>
</div>

