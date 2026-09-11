# AstroLedger — Client Handover & Setup Guide

This guide explains how to install and set up **AstroLedger** for your client:
1. **On the Client's Windows PC** (Main Practice Computer)
2. **On the Client's Mobile Phone / Tablet** (Connected over Wi-Fi)

---

## Part 1: Setting Up the Client's Windows PC (100% Free & Local)

You have two delivery options for your client's computer:

### Method A: Production Windows Installer (.exe) — *Most Professional*
1. On your development PC, build the installer:
   ```powershell
   # In AstroLedger root:
   npm run build:desktop
   ```
2. In `desktop/release/`, take the generated file:
   **`AstroLedger-Setup-1.0.0.exe`**
3. Copy it to the client's PC (via USB drive or Google Drive).
4. Run the installer on the client's PC. It installs into `Program Files` and creates a golden **AstroLedger** icon on their desktop.
5. When the client double-clicks the icon:
   - Electron launches.
   - It automatically starts the backend server in the background (no black command prompt).
   - The practice window opens ready for consultations.

---

### Method B: Folder Copy with One-Click Launcher (`Start_AstroLedger.bat`)
If you want to hand over the application folder directly to the client:
1. Copy the `AstroLedger` folder to the client's computer (e.g. `C:\AstroLedger`).
2. Right-click **`Start_AstroLedger.bat`** -> **Send to > Desktop (create shortcut)**.
3. Right-click the desktop shortcut -> **Change Icon** -> pick `desktop/assets/icon.svg` or `icon.ico`.
4. When the client double-clicks this desktop shortcut, it automatically launches the background server and opens the application.

---

## Part 2: Setting Up the Client's Mobile Phone / Tablet (Instant QR Code Pairing)

Any smartphone (iPhone / Android) or tablet (iPad / Samsung Galaxy Tab) can connect to the client's main PC **over the clinic's Wi-Fi network at $0 cost with zero typing**.

### Step 1: Open QR Pairing on the Main PC
On the client's main PC in AstroLedger:
1. Click **"Pair Devices"** in the top navigation bar (or **"Pair Mobile / Devices (QR)"** in the left sidebar).
2. A window opens displaying a scannable **QR Code** tailored to the PC's local Wi-Fi address.

---

### Step 2: Scan from Phone or Tablet (Zero Configuration!)
1. Ensure the phone or tablet is connected to the **same clinic Wi-Fi** as the PC.
2. Open the phone's native **Camera app** (iOS Camera or Google Lens / Android Camera).
3. Point the camera at the QR code on the PC screen and tap the link that appears.
4. AstroLedger opens on the phone with the **server connection automatically configured**!
5. Log in with the astrologer's credentials.

> [!TIP]
> The astrologer can switch to the **"Active Devices"** tab on their PC at any time to see all currently linked phones/tablets, their online status, and disconnect any device with a single click.

---

### Step 3: Make it Look Like a Real Native App on the Phone
* **On iPhone / iPad (Safari)**:
  1. Tap the **Share button** (square with an arrow pointing up) at the bottom.
  2. Tap **Add to Home Screen**.
  3. Name it **AstroLedger**.
* **On Android (Chrome)**:
  1. Tap the **three-dots menu (⋮)** in the top-right.
  2. Tap **Add to Home screen** (or **Install app**).

**Result**: An **AstroLedger icon** will now appear on their phone's home screen. When tapped, it opens full-screen without browser address bars, looking and behaving like a native mobile app!

---

## Part 3: How the Client Uses It Daily

1. **In the Morning**: The astrologer boots their PC and opens **AstroLedger**.
2. **During Consultations**:
   - The astrologer can use their desktop monitor to view charts and enter detailed notes.
   - Or they can carry their tablet/phone anywhere in the clinic room and record consultations directly.
3. **Instant Sync**: Every change made on the tablet immediately updates the PC screen in real time via WebSockets.
4. **Offline Safety**: Even if the phone temporarily loses Wi-Fi, all notes are stored locally in IndexedDB and automatically sync to the PC as soon as connection resumes.
