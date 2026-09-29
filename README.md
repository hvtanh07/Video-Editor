# Video Editor Studio 🎬

A modern, high-performance desktop-ready Video Editor web application built with **React**, **Node.js/Express**, and **FFmpeg**.

---

## ✨ Features

1. **✂ Cut / Trim Specific Segments**:
   - Dual-handle visual timeline scrubber with Start `[IN]` and End `[OUT]` markers.
   - Precise millisecond & frame-stepping controls (`-1s`, `-0.1s`, `+0.1s`, `+1s`).
   - "Mark Current" button to lock current playhead position to start or end points.
   - "Preview Cut" and "Loop Cut" audition buttons to test the trimmed segment in real time.

2. **📐 Crop Video to New Ratio**:
   - Interactive bounding box directly over the video player with 8 resize handles.
   - Drag anywhere to reposition the crop frame.
   - Preset ratios: **16:9** (Landscape), **9:16** (TikTok / Reels / Shorts), **1:1** (Square), **4:5** (Portrait), **4:3** (Classic), **21:9** (Ultrawide), or **Freeform**.
   - **The crop area becomes the new video ratio and resolution** in the exported video!
   - "Preview Cropped Ratio" mode: live preview of how the cropped video looks framed in its new aspect ratio.

3. **⚡ Speed Control (0.25x to 4.0x)**:
   - Continuous slider ranging from **0.25x** (ultra slow-mo) to **4.0x** (hyperlapse).
   - Quick one-click presets: `0.25x`, `0.5x`, `0.75x`, `1.0x (Normal)`, `1.25x`, `1.5x`, `2.0x`, `3.0x`, `4.0x`.
   - Real-time preview player playback rate updates immediately.
   - FFmpeg audio filter automatically handles chained `atempo` filters (bypassing the single-instance 0.5–2.0 FFmpeg limit).

4. **🔊 Volume Adjustment**:
   - Volume slider from **0% (Mute)** to **200% (2x Boost)**.
   - One-click mute / unmute button.
   - Real-time preview supports audio amplification via Web Audio API.

5. **🚀 Fast Local FFmpeg Rendering**:
   - Uses precompiled native FFmpeg and FFprobe binaries.
   - Real-time progress bar with percentage and status updates.
   - Side-by-side comparison modal with direct MP4 video download.
   - Built-in **Demo Video Generator** for instant testing without needing an existing video file.

---

## 🚀 Quick Start

### Option 1: Double-click `run.bat` (Windows)
Simply double click `run.bat`. It will automatically check dependencies, build the frontend, launch the server, and open your browser at `http://localhost:5000`.

### Option 2: Command Line
```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Build the frontend into docs/
npm run build

# 3. Start the server
npm start
```
Open **http://localhost:5000** in your browser.

### Hosting on GitHub Pages (Static Hosting from `main` + `/docs`)
The project is pre-configured to build directly into the `docs/` folder with relative paths and client-side fallback rendering so you can host it for free on GitHub Pages:

1. Push your repository to GitHub (`main` branch).
2. On GitHub, navigate to your repository: **Settings** → **Pages** (in the left sidebar).
3. Under **Build and deployment** → **Branch**:
   - Select branch: **`main`**
   - Select folder: **`/docs`**
4. Click **Save**.
5. Your web video editor will be live at:
   **`https://hvtanh07.github.io/Video-Editor/`**

> [!NOTE]
> On GitHub Pages, the editor runs entirely in the browser using HTML5 Canvas, Web Audio API, and MediaRecorder for cutting, cropping, speed adjustments, and export. When run locally (`npm start` or `run.bat`), it also leverages the native high-speed FFmpeg engine!

### Development Mode (with Hot Reload)
```bash
# In terminal 1:
npm run server

# In terminal 2:
npm run dev
```

---

## 🛠 Tech Stack

- **Frontend**: React 19, Vite 8, Lucide React, Web Audio API, HTML5 Video.
- **Backend**: Express, Multer, fluent-ffmpeg, @ffmpeg-installer/ffmpeg, @ffprobe-installer/ffprobe.
- **Video Engine**: FFmpeg with `libx264`, `aac`, `crop`, `setpts`, `atempo`, and `volume` filters.
