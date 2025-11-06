# CLIP_EXTRACTOR

Terminal-style Electron app for extracting clips and frames from online videos (YouTube, Vimeo, Pinterest, Instagram, etc.).

## Features

- **Download videos** from 1000+ sites using yt-dlp
- **Scrub through video** with HTML5 player
- **Set IN/OUT points** for clip extraction
- **Grab single frames** at any timestamp
- **Export queue** with per-file output paths
- **Keyboard shortcuts** (I/O for IN/OUT, J/K/L for playback, Space for play/pause)
- **Batch export** multiple clips and frames
- **Terminal aesthetic** matching your GIF converter

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Download Required Binaries

You need to add these executables to the `bin/` folder:

- **ffmpeg.exe** - [Download from ffmpeg.org](https://ffmpeg.org/download.html)
- **ffprobe.exe** - Comes with ffmpeg
- **yt-dlp.exe** - [Download from github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp/releases)

Create the structure:
```
clip-extractor/
├── bin/
│   ├── ffmpeg.exe
│   ├── ffprobe.exe
│   └── yt-dlp.exe
├── fonts/
│   ├── Geist-Bold.otf
│   └── JetBrainsMono-Regular.ttf
├── main.js
├── preload.js
├── renderer.js
├── index.html
├── styles.css
└── package.json
```

### 3. Add Fonts

Copy your font files:
- `Geist-Bold.otf`
- `JetBrainsMono-Regular.ttf`

Into the `fonts/` folder.

### 4. Add Icon (Optional)

Add `favicon.ico` to the root folder for the app icon.

## Development

Run the app in development mode:

```bash
npm start
```

## Build

Build the installer:

```bash
npm run build
```

This creates an NSIS installer in the `dist/` folder.

## Usage

1. **Paste URL** - Paste a video URL from YouTube, Vimeo, Pinterest, etc.
2. **Click LOAD** - Downloads the video and loads it in the player
3. **Scrub through video** - Find the moments you want
4. **Set IN/OUT points** - Click "SET IN" and "SET OUT" (or press I and O)
5. **Add to queue** - Click "ADD CLIP" for video clips or "ADD FRAME" for single images
6. **Customize** - Click arrow to expand and set custom output paths
7. **Export** - Click "EXPORT ALL" to batch process everything

## Keyboard Shortcuts

- `Space` - Play/Pause
- `I` - Set IN point
- `O` - Set OUT point
- `←/→` - Scrub backward/forward (hold Shift for 5s jumps)
- `J/K/L` - Premiere-style playback (reverse/pause/forward)
- `Shift+I` - Jump to IN point
- `Shift+O` - Jump to OUT point

## Supported Sites

yt-dlp supports 1000+ websites including:
- YouTube
- Vimeo
- Instagram
- Pinterest
- Twitter/X
- TikTok
- Facebook
- Reddit
- And many more!

## Notes

- Videos are temporarily downloaded to system temp folder
- Clips use `-c copy` for fast, lossless extraction
- Frames are extracted as JPG
- Default output creates a `clips/` folder next to the source video
