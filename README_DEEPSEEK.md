# DeepSeek Voyager

<div align="center">
  <img src="public/icon-128.png" alt="logo"/>
  <h1>DeepSeek Voyager</h1>
  <h3>Supercharge Your DeepSeek Experience ✨</h3>
  <p>Navigate conversations with an elegant timeline, organize chats with folders, and export your chats—all in one powerful extension.</p>
  
  <p>
    <img src="https://img.shields.io/badge/Chrome-✓-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome">
    <img src="https://img.shields.io/badge/Edge-✓-0078D7?style=flat-square&logo=microsoftedge&logoColor=white" alt="Edge">
    <img src="https://img.shields.io/badge/Firefox-✓-FF7139?style=flat-square&logo=firefox&logoColor=white" alt="Firefox">
  </p>
</div>

---

## Features

### 📍 Timeline Navigation

Visual conversation navigation with clickable message nodes:
- Click nodes to jump to messages
- Hover for message preview
- Long-press to star important messages (synced across tabs)
- Draggable timeline position
- Auto-syncs with scroll position

### 📂 Folder Organization

Manage conversations with drag-and-drop folders:
- Two-level hierarchy (folders and subfolders)
- Right-click menu for rename/duplicate/delete
- Local storage, synced across devices
- Instant navigation without page reloads
- Import/export for cross-device sync

### 💾 Chat Export (JSON + Markdown/PDF)

Export conversations as:
- Structured JSON
- Markdown/PDF (images auto-packaged, print-friendly)
- Click export icon to save your chats
- Preserves starred messages

### 📏 Adjustable Chat Width

Customize chat container width (400px - 1400px) with real-time preview.

> **Settings**: Click the extension icon for scroll mode, chat width, and timeline options.

---

## 📥 Installation

### Manual Installation

**For Chromium browsers (Chrome, Edge, Opera, Brave, Vivaldi, Arc):**

1. Download or clone this repository
2. Run `bun install` (or `npm install` / `pnpm install`)
3. Run `bun run build:chrome` to build the extension
4. Open your extensions page and enable Developer mode:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera: `opera://extensions`
5. Click "Load unpacked"
6. Select the `dist_chrome` folder

**For Firefox:**

1. Run `bun run build:firefox`
2. Open `about:debugging#/runtime/this-firefox` in Firefox
3. Click "Load Temporary Add-on…"
4. Select the `manifest.json` inside the `dist_firefox` folder

---

## 🛠️ For Developers

Want to contribute or customize the extension? Here's how to set up the development environment:

```bash
# Install dependencies (Bun recommended)
bun install

# Development mode (with auto-reload)
bun run dev:chrome   # Chrome & Chromium browsers
bun run dev:firefox  # Firefox

# Production builds
bun run build:chrome   # Chrome
bun run build:firefox  # Firefox
bun run build:all      # All browsers
```

Or with npm/pnpm:
```bash
pnpm install
pnpm run dev:chrome    # Chrome
pnpm run dev:firefox   # Firefox
```

---

## 🎯 Migration from Gemini Voyager

This project is adapted from [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager), which provides similar functionality for Google's Gemini AI.

### Key Changes for DeepSeek:

1. **DOM Selectors**: Adapted to DeepSeek's UI structure with fallback strategies for mixed class names
2. **Conversation ID**: Changed from Gemini's hex format to DeepSeek's UUID format
3. **URL Structure**: Updated from `/app/{id}` to `/a/chat/s/{uuid}`
4. **Storage Keys**: Updated to avoid conflicts with Gemini Voyager
5. **Removed Features**: Gem-specific features not applicable to DeepSeek

### Technical Architecture:

- **Multiple Selector Strategy**: Uses primary + fallback selectors to handle DeepSeek's obfuscated class names
- **Conversation Extraction**: Extracts IDs directly from `href` attributes
- **SPA Navigation**: Maintains single-page app experience
- **Storage Isolation**: Uses separate localStorage keys (`dsFolderData`, `deepseekTimeline*`)

---

## ⚠️ Important Notes

DeepSeek uses obfuscated class names (e.g., `_a1b2c3d`) that may change with each deployment. This extension uses:
- Stable selectors where possible (`.ds-message`, `.ds-scroll-area`)
- Attribute-based selectors (`a[href*="/a/chat/s/"]`)
- Multiple fallback strategies

If the extension stops working after a DeepSeek update, please open an issue with:
1. Browser console errors
2. DeepSeek's current DOM structure (F12 → Inspect element)

---

## 🙏 Credits

- Adapted from [Gemini Voyager](https://github.com/Nagi-ovo/gemini-voyager) by Jesse Zhang
- Inspired by [ChatGPT Conversation Timeline](https://github.com/Reborn14/chatgpt-conversation-timeline)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

<div align="center">
  <p>Made with ❤️ for the DeepSeek community</p>
</div>

