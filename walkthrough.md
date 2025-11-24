# Deployment Guide

You have successfully transformed your local P2P app into an architecture ready for the App Store! Here is how to build and deploy it.

## 1. Deploy the Server (Cloud)
The signaling server must be online for devices to find each other.

### Option A: Render (Free & Easy)
1.  Push your code to GitHub.
2.  Sign up at [render.com](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repo.
5.  **Settings**:
    *   **Runtime**: Python 3
    *   **Build Command**: `pip install -r requirements.txt`
    *   **Start Command**: `python server.py`
6.  Click **Create Web Service**.
7.  **Copy the URL** (e.g., `https://p2p-transfer.onrender.com`).
8.  **Update `static/app.js`**: Paste this URL into the `SIGNALING_SERVER_URL` constant.

## 2. Build the Mobile App (iOS/Android)
We use **Capacitor** to wrap your web app.

### Prerequisites
*   **Node.js** installed.
*   **Xcode** (for iOS) or **Android Studio** (for Android).

### Steps
1.  Open a terminal in your project folder.
2.  Initialize Capacitor (if not done):
    ```bash
    npm install
    npx cap init
    ```
3.  **Build for iOS**:
    ```bash
    npm run build:ios
    ```
    *   This opens Xcode. Connect your iPhone and click "Run" (Play button).
4.  **Build for Android**:
    ```bash
    npm run build:android
    ```
    *   This opens Android Studio. Connect your phone and click "Run".

## 3. Build the Windows App
We use **Electron** to create a standalone `.exe`.

### Steps
1.  Open terminal.
2.  **Test Locally**:
    ```bash
    npm start
    ```
3.  **Build `.exe`**:
    ```bash
    npm run build:windows
    ```
    *   This will create a `dist` folder containing your installer (e.g., `P2P Transfer Setup 1.0.0.exe`).

## Summary of Changes Made
*   **`server.py`**: Updated to support Cloud Hosting (CORS, Environment Variables).
*   **`app.js`**: Updated to connect to a remote server.
*   **`package.json`**: Added build scripts.
*   **`capacitor.config.json`**: Added mobile configuration.
*   **`electron-main.js`**: Added Windows app configuration.
