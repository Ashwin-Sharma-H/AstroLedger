# 🌌 AstroLedger (ആസ്ട്രോ ലെഡ്ജർ)

> **A professional, offline-first Vedic Astrology Consultation & Client Practice Management Suite.**  
> Crafted with a dark cosmic glassmorphic aesthetic for traditional Jyotish practitioners and modern astrological consultants.

---

## 📖 Overview

**AstroLedger** is a specialized desktop and mobile-responsive practice management application designed for Vedic Astrologers (*Jyotsyans*). It replaces fragmented paper notebooks and generic spreadsheets with a unified astrological ledger featuring:

- **Client Astrological Registry**: Track birth star (*Nakshatra* in English & Malayalam), *Rashi*, date of birth, time of birth, birth place, and contact information.
- **Consultation Workspace**: Dual-pane master-detail consultation studio with static astrological identity cards and independently scrolling observation & remedy notes.
- **Vedic Remedies & Homam Tracking**: Structured records for *Pariharams*, temple visits, gemstones, and homams.
- **Offline-First Synchronization**: Local SQLite database with automated background sync, device pairing via QR codes, and multi-device support (Desktop, Tablet, Phone).
- **Printable Dossier Reports**: A4 formatted printable astrological consultation summaries for clients.
- **Responsive Mobile Companion**: Collapsible desktop navigation bar and a tailored 1-tap mobile interface with sticky tab navigation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TanStack Query (React Query), Lucide Icons, Vanilla CSS Design System |
| **Backend** | Python 3.11+, Django, Django REST Framework (DRF), Django Channels (WebSockets) |
| **Database** | SQLite (Offline-first local ledger) |
| **Cross-Platform** | Electron (Desktop desktop wrapper), Progressive Web App (PWA) / Responsive Mobile Viewport |
| **Security & Sync** | JWT Authentication, QR Token-based Device Pairing, Audit Logging, Delta Synchronization Engine |

---

## ✨ Key Features

### 1. Dual-Pane Consultation Workspace
- **Pinned Horoscopic Identity**: Astrological identity (Nakshatra, Rashi, DOB, Time, Place) stays anchored on the left.
- **Isolated Right Scroll**: In-depth planetary analysis (*Graha Nila* & *Dasha-Bhukti*), inquiries, and remedies scroll independently.
- **Mobile 1-Tap Switching**: Seamless 50/50 toggle tabs (`[ 📜 Dossier ]` and `[ 📋 Visits & Info ]`) with zero horizontal overflow on mobile phones.

### 2. Client Astrological Identity Card
- Native bilingual support (English + Malayalam Malayalam script for all 27 Nakshatras and 12 Rashis).
- Automatic age calculation from birth date.
- Complete past visit timeline with visit numbering and inquiry summaries.

### 3. Record Consultation Modal
- Modal dialog for logging new client visits directly without leaving the workspace.
- Prescribe remedies, advice, and schedule automated follow-ups.
- Circular glassmorphic close controls and keyboard shortcuts (`Escape` to dismiss).

### 4. Collapsible Desktop Navigation Sidebar
- Quick toggle button and `Ctrl + B` (or `Cmd + B`) keyboard shortcut.
- Collapses from 260px down to a 72px icon-only rail to maximize chart and consultation space.
- Persists collapsed state in `localStorage`.

### 5. Multi-Device Pairing & Cloud Sync
- Generate secure pairing QR codes for tablets and mobile phones.
- Real-time sync status indicator (`Cloud Synced`, `Syncing`, `Offline`).
- Offline mutation queueing with automatic background replay when reconnected.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Ashwin-Sharma-H/AstroLedger.git
cd AstroLedger
```

### 2. Quick Start (Windows)
Run the one-click startup batch script:
```cmd
Start_AstroLedger.bat
```
This automatically activates Python virtual environment, launches the Django backend on port `8000`, and starts Vite dev server on port `5173`.

### 3. Manual Setup

#### Backend Setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run migrations
python backend/manage.py migrate

# Start backend development server
python backend/manage.py runserver
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📱 Mobile Access & Pairing

1. Ensure your computer and phone are connected to the same Wi-Fi network.
2. Click the **Pair** button in the top navigation bar to display the QR code.
3. Scan the QR code or navigate to `http://<your-computer-ip>:5173` on your mobile browser.

---

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
