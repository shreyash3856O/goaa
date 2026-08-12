# HH Goa 2026 — Shoreline PFP Poster Generator

An official single-page web application for **HH Goa 2026** that lets builders upload their photo, fit it inside a branded avatar frame, and instantly download or share to X (Twitter) with `#FrameInGoa`.

---

## 🚀 How to Deploy on Vercel

### Option A: Via Vercel CLI (Fastest)

Run the following command in your terminal inside the project directory:

```bash
npx vercel
```

Follow the interactive prompts (select default options). Your app will be live on Vercel in ~15 seconds!

---

### Option B: Via GitHub & Vercel Dashboard

1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for HH Goa 2026 PFP Generator"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/hh-goa-2026-pfp.git
   git push -u origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your `hh-goa-2026-pfp` repository.
4. Click **Deploy**. Vercel will automatically host the static site with SSL and global CDN caching!

---

## 🛠️ Features Included

- **Zero Signup / Gate**: Instant upload → frame → download/share.
- **HEIC iPhone Support**: Automatic client-side HEIC-to-JPEG conversion via `heic2any`.
- **Live Webcam Selfie Stream**: Camera capture via browser `navigator.mediaDevices.getUserMedia`.
- **Side-by-Side Sticky Editor**: Canvas preview stays locked in view while adjusting themes, stamps, and zoom.
- **Direct X Sharing**: Copy to Clipboard (`Ctrl + V`), Web Share API on Mobile, and Live Tweet Preview Modal.
- **100% Client-Side**: High-DPI 1200×1200 px Canvas compositing engine with zero server dependencies.

---

## 💻 Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:8080/` in your browser.
