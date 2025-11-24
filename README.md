# P2P File Transfer App

A modern, secure, and unlimited peer-to-peer file transfer application that works across all your devices.

## Features
*   **Direct P2P Transfer**: Files go directly between devices using WebRTC. No intermediate servers store your data.
*   **Unlimited File Size**: Transfer huge files without restrictions.
*   **Cross-Platform**: Works on Web, Windows, iOS, and Android.
*   **Secure**: End-to-end encryption provided by WebRTC.
*   **Cloud Ready**: Signaling server can be hosted on the cloud for cross-network connectivity.

## Tech Stack
*   **Frontend**: Vanilla JavaScript, HTML5, CSS3
*   **Backend (Signaling)**: Python (aiohttp)
*   **Mobile Wrapper**: Capacitor (iOS/Android)
*   **Desktop Wrapper**: Electron (Windows)

## Getting Started

### 1. Local Development
Run the app locally on your machine.

**Prerequisites:**
*   Python 3.8+
*   Node.js (optional, for native builds)

**Steps:**
1.  Clone the repo:
    ```bash
    git clone https://github.com/Nitishvarma50/app_p2p.git
    cd app_p2p
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    # Windows
    .\venv\Scripts\activate
    # Mac/Linux
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Run the server:
    ```bash
    python server.py
    ```
5.  Open `http://localhost:8080` in your browser.

### 2. Deployment (App Store / Public Use)
To use the app across different networks (e.g., 4G to WiFi), you need to host the signaling server.

**Server:**
*   Deploy `server.py` to a cloud provider like Render or Heroku.
*   Update `static/app.js` with your new server URL.

**Native Apps:**
*   **iOS/Android**:
    ```bash
    npm install
    npm run build:ios      # or build:android
    ```
*   **Windows**:
    ```bash
    npm install
    npm run build:windows
    ```

## License
MIT
