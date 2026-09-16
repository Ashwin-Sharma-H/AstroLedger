<div align="center">

<img src="./desktop/assets/logo.png" width="96" alt="AstroLedger Logo" />

# 🌌 AstroLedger (ആസ്ട്രോ ലെഡ്ജർ)
### *Professional Offline-First Vedic Astrology Practice Management Suite*

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Android-4F46E5.svg?style=flat-square)](#-platform-support)
[![Architecture](https://img.shields.io/badge/Architecture-Offline--First%20%26%20Local%20Sync-059669.svg?style=flat-square)](#-architecture)
[![Desktop](https://img.shields.io/badge/Desktop-Electron%20%2B%20PyInstaller-F59E0B.svg?style=flat-square)](#-build--packaging)
[![Mobile](https://img.shields.io/badge/Mobile-Capacitor%206%20APK-8B5CF6.svg?style=flat-square)](#-build--packaging)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](#-license--copyright)

<p align="center">
  A sovereign, privacy-centric practice management suite built for Vedic Astrologers (<em>Jyotsyans</em>).<br>
  Combines classical horoscopic workflows with offline-first local storage, zero-config desktop packaging, and camera QR pairing over private Wi-Fi.
</p>

</div>

---

## ⚡ Highlights

* **100% Data Sovereignty**: All charts, consultation records, and notes remain on your local hardware—zero third-party cloud lock-in.
* **Bilingual Vedic Engine**: Native Malayalam script and English for all 27 Nakshatras (*അശ്വതി* to *രേവതി*) and 12 Rashis (*മേടം* to *മീനം*).
* **Dual-Pane Consultation Studio**: Pinned horoscopic identity card on the left with independently scrolling observations, *Graha Nila*, and remedies on the right.
* **Instant A4 Printable Dossiers**: 1-click formatted consultation summaries ready to print or hand out to clients.
* **Private Wi-Fi Sync**: Connect your Android phone to your desktop host via ephemeral QR code pairing—no internet connection required.
* **Turnkey Multi-Platform**: Self-contained Windows installer (`.exe`) with embedded server and standalone Android package (`.apk`).

---

## 🏛️ Architecture

AstroLedger uses a local **Hub-and-Spoke** topology where the primary desktop workstation acts as the authoritative ledger node, and mobile companions operate as autonomous, offline-capable satellites over local Wi-Fi:

```text
┌──────────────────────────────────────┐             Local Wi-Fi Network             ┌──────────────────────────────────────┐
│       🖥️ Desktop Workstation         │    (Private WebSockets & REST API)          │        📱 Mobile Companion           │
│  • Electron 29 Shell (React 18)      │ ◄─────────────────────────────────────────► │  • Capacitor 6 Native Shell (React)  │
│  • Standalone PyInstaller Server     │              Port: 8000                     │  • Hardware Camera QR Scanner        │
│  • Authoritative Local SQLite DB     │                                             │  • Encrypted Local IndexedDB Cache   │
└──────────────────────────────────────┘                                             └──────────────────────────────────────┘
                   │                                                                                    │
                   ▼                                                                                    ▼
      [ Direct Local File Storage ]                                                        [ Instant Offline Mutations ]
      [ Zero Cloud / Privacy First ]                                                       [ Background Auto-Replay    ]
```

---

## 🛠️ Technology Stack

| Component | Stack | Purpose |
|---|---|---|
| **Desktop Shell** | Electron 29 + TypeScript | Native Windows container and background server supervisor |
| **Desktop Backend** | Python 3.11, Django 5, Daphne, Channels | Standalone compiled ASGI server via PyInstaller (Zero Python setup for clients) |
| **Mobile Runtime** | Capacitor 6 + Android SDK | Native Android container with hardware camera barcode scanner |
| **Frontend UI** | React 18, Vite, TanStack Query | Cosmic glassmorphic dark UI with client-side query caching |
| **Offline Storage** | IndexedDB (`idb`) + SQLite | Persistent offline mutation queue and local ACID database |

---

## 🚀 Quick Start (Development)

### Prerequisites
* **Node.js** v18+ & **Python** v3.10 / v3.11
* *(Optional for Android builds)*: Android Studio & SDK API 34

```bash
# 1. Clone repository
git clone https://github.com/Ashwin-Sharma-H/AstroLedger.git
cd AstroLedger

# 2. Setup & Run Backend (Terminal 1)
python -m venv venv
.\venv\Scripts\activate          # Windows (or: source venv/bin/activate on Linux/macOS)
pip install -r backend/requirements.txt
cd backend && python manage.py migrate
python manage.py runserver 8000

# 3. Setup & Run Frontend (Terminal 2)
cd frontend
npm install
npm run dev                      # App runs at http://localhost:5173

# 4. (Optional) Run Electron Desktop Shell (Terminal 3)
cd desktop && npm install && npm run start
```

---

## 📦 Build & Packaging

Build standalone, production-ready deliverables with unified root commands:

### 1. Windows Desktop Installer (`.exe`)
```bash
npm run build:desktop
```
* Compiles standalone backend binary via PyInstaller, builds React frontend, and packages via `electron-builder`.
* **Output**: `desktop/release/AstroLedger Setup 1.0.0.exe` (NSIS installer with silent Windows Firewall setup).

### 2. Android APK (`.apk`)
```bash
npm run build:apk
```
* Generates all adaptive icons/splash screens, synchronizes web assets, and compiles debug APK via Gradle.
* **Output**: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📱 Mobile Pairing Walkthrough

1. Ensure your PC and phone are connected to the **same Wi-Fi router or hotspot**.
2. On your Desktop app, click **Pair Device** in the navigation header to display your unique pairing QR code.
3. Open **AstroLedger** on your Android phone, tap **Scan QR**, and point the camera at the desktop screen.
4. The devices perform an instant cryptographic handshake and begin real-time sync.

> [!TIP]
> If Windows Firewall blocks local port `8000`, run **`Allow_Firewall_Port8000.bat`** as Administrator.

---

## 🧰 Developer Utilities

| Script / Command | Description |
|---|---|
| `npm run build:desktop` | Full production build of backend, frontend, and Windows desktop installer |
| `npm run build:apk` | Regenerates all Android icons, syncs assets, and builds Android APK |
| `npm run icons:android` | Generates all 5 density launcher icons & 11 splash screens from master logo |
| `Allow_Firewall_Port8000.bat` | 1-click script to configure Windows Defender Firewall for local sync port `8000` |
| `rebuild_and_launch_desktop.bat` | Rebuilds desktop package and launches fresh instance for testing |
| `reset_client_data.bat` | Clears `%APPDATA%` to verify clean first-time onboarding states |
| `npm run test:backend` | Runs Django automated unit test suite |

---

## 📄 License & Copyright

Copyright © 2026 **AstroLedger Jyotish Technologies**. All rights reserved.

This software, source code, and associated documentation are proprietary and confidential. Unauthorized copying, distribution, modification, public display, or reverse engineering via any medium is strictly prohibited.

---

<div align="center">
  <sub>Built for Vedic Astrology Practitioners • Cosmic Precision with Modern Engineering</sub>
</div>
