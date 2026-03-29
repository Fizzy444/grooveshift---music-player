# GrooveShift — Music Player

A minimal, premium music player for Windows built with Electron.

## Features

- **Vibe Dial** — your one killer feature. Drag to shift the energy of what plays next. Not random. Deterministic.
- **Transparent play counts** — "Because you've played this 12 times" — you always know *why* something plays
- **Audio visualizer** — real-time frequency bars using Web Audio API
- **Smart sort** — order by default, A–Z, or reorder by your current vibe
- **Keyboard shortcuts** — Space to play/pause, Alt+→/← to skip
- **Frameless window** — clean, premium feel

## Supported Formats
MP3, WAV, OGG, FLAC, M4A, AAC

---

## Setup & Run (Development)

### Requirements
- [Node.js](https://nodejs.org) v18 or later
- npm (comes with Node.js)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm start
```

That's it. The app window will open.

---

## Build Windows Installer (.exe)

```bash
npm run build
```

This generates a Windows installer in the `dist/` folder using NSIS.

> **Note:** Building on Windows produces a `.exe` installer. Building on macOS/Linux may require Wine for Windows targets.

---

## Usage

1. Click **+** (add files) or the **folder icon** (add folder) in the sidebar
2. Click any track to play
3. Use the **Vibe Dial** to shift the energy of upcoming tracks
4. Toggle **Shuffle** to let the vibe dial influence what plays next
5. Use **By Vibe** sort in the sidebar to reorder your library by the current vibe

---

## Design Philosophy

- Every feature shows *why* it happened
- No forced intelligence — shuffle and vibe are opt-in
- One killer feature done well (Vibe Dial) instead of twenty mediocre ones
- "Smart" never appears in the UI — it just feels smart
