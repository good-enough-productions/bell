# 🔔 Tabby Bell — Urgent Partner Assistance PWA

A Progressive Web App (PWA) designed for home partner communication when in separate rooms. When one partner needs assistance, pressing the central "Bell" button triggers an instant urgent push notification on the other partner's Android device, optionally including a custom message or preset. Active requests can be marked complete, and all interactions are logged to a Google Sheet database.

![Tabby Bell PWA](data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='128' fill='%234f46e5'/><path fill='white' d='M256 64a32 32 0 0 0-32 32v4.64C147.2 110.88 96 166.4 96 234.67V352H64v32h384v-32h-32V234.67c0-68.27-51.2-123.79-128-134.03V96a32 32 0 0 0-32-32zm0 384a48 48 0 0 0 48-48h-96a48 48 0 0 0 48 48z'/></svg>)

## 🚀 Live Demo & PWA Installation

Open the hosted GitHub Pages URL on your mobile phone or desktop:
- **PWA App**: [Tabby Bell Live App](https://good-enough-productions.github.io/tabby-bell/)
- **Android Installation**: On Android Chrome, tap the menu (⋮) > **"Add to Home screen"** to install as a standalone native-feeling app!

---

## ✨ Features

- **Tactile Bell Trigger**: Giant glowing "Ring Bell" button with pulse micro-animations and built-in AudioContext double-chime bell sound.
- **Presets & Custom Text**: Tap quick chips (*"Can you come here?"*, *"Help in bedroom"*, *"Heavy lifting"*, *"Quick question"*) or type a custom note.
- **Urgent Android Lock-Screen Notifications**: Integrates with `ntfy.sh` (Priority 5) to sound loud alerts on Android even when sleeping/locked.
- **Google Sheets Database**: Connects to your private Google Sheet via a free Google Apps Script Web App.
- **Active State & Resolution**: Real-time status card lets the requesting partner mark alerts completed on their end, tracking total duration.
- **History View**: Complete log of all past rings with status badges, timestamps, and messages.

---

## 🛠️ Setup Instructions

### 1. Android Urgent Push Notifications (`ntfy.sh`)
1. Download the free **ntfy app** from Google Play Store or F-Droid on your Android device.
2. In the ntfy app, tap `+` to subscribe to a topic name of your choice (e.g. `tabby-bell-home-13579`).
3. In Tabby Bell PWA > **Settings**, set **Ntfy Topic Name** to `tabby-bell-home-13579`.
4. Tap **Send Test Notification** to confirm your phone rings!

### 2. Google Sheet Database Setup (Google Apps Script)
1. Create a new Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Replace any existing code in `Code.gs` with the contents of [`apps_script.js`](./apps_script.js).
4. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the generated **Web App URL**.
6. Paste the URL into Tabby Bell PWA > **Settings > Apps Script Web App URL** and tap **Save Settings**.

---

## 📁 Repository Structure

```
├── index.html        # PWA layout & UI components
├── styles.css        # Modern dark theme design system
├── app.js            # Audio chime, state, ntfy & Google Sheets controller
├── apps_script.js    # Google Apps Script Web App backend code
├── sw.js             # Service Worker for offline PWA caching
├── manifest.json     # PWA manifest configuration
└── README.md         # Documentation
```

---

## 📄 License

MIT License &copy; 2026. Built with Antigravity.
