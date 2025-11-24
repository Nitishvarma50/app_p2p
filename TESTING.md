# Testing Guide for P2P File Transfer App

This guide details how to run and test the P2P file transfer application in different scenarios.

## Prerequisites

1.  **Python 3.7+** installed.
2.  **Dependencies** installed:
    ```bash
    pip install -r requirements.txt
    ```

---

## Scenario 1: Local Testing (Single Device)

This is the easiest way to verify the application logic (UI, Signaling, File Transfer) works.

1.  **Start the Server**:
    ```bash
    python server.py
    ```
    *You should see: `Starting server on port 8080`*

2.  **Open the App**:
    *   Open your browser (Chrome/Edge/Firefox).
    *   Open **two separate tabs** to: `http://localhost:8080`

3.  **Test the Flow**:
    *   **Tab 1**: Click **"Create New Room"**.
        *   You will join a room. Copy the **Room ID** (click the code at the top right).
    *   **Tab 2**: Paste the Room ID into the input field and click **"Join Room"**.
    *   **Verify Connection**: Both tabs should show a green status: **"Peer Connected"**.
    *   **Send File**:
        *   In Tab 1, drag and drop a file (or click to browse).
        *   In Tab 2, you should see the file appear and download automatically (or prompt to save).

---

## Scenario 2: Network Testing (Two Devices) - HTTPS (Recommended)

To test between a PC and a Phone (or another PC), you **MUST** use HTTPS. Modern browsers block WebRTC (camera, mic, p2p) on insecure HTTP connections (except localhost).

### 1. Generate SSL Certificates
You need a self-signed certificate.

1.  Install the cryptography library:
    ```bash
    pip install cryptography
    ```
2.  Run the generation script:
    ```bash
    python generate_cert.py
    ```
    *This creates `cert.pem` and `key.pem`.*

### 2. Start the Secure Server
Run the server with the certificate arguments:
```bash
python server.py --cert cert.pem --key key.pem --port 8080
```
*You should see: `Starting server with HTTPS on port 8080`*

### 3. Connect Devices
1.  **Find your PC's Local IP**:
    *   Windows: Run `ipconfig` in terminal (look for IPv4 Address, e.g., `192.168.1.5`).
    *   Mac/Linux: Run `ifconfig` or `ip a`.
2.  **Access the App**:
    *   **PC**: Go to `https://<YOUR_IP>:8080` (or `https://localhost:8080`).
    *   **Phone**: Connect to the **same Wi-Fi**. Open browser and go to `https://<YOUR_IP>:8080`.
3.  **Handle Security Warning**:
    *   Since the certificate is self-signed, your browser will show a "Not Secure" warning.
    *   **Chrome/Edge**: Click "Advanced" -> "Proceed to <IP> (unsafe)".
    *   **Safari (iOS)**: You might need to click "Show Details" -> "visit this website".

### 4. Test Transfer
*   Create a room on one device.
*   Join with the ID on the other device.
*   Transfer files!

---

## Scenario 3: Network Testing - HTTP (Advanced/Debug)

If you cannot generate certificates, you can force Chrome to allow WebRTC over HTTP.

1.  **Start Server (HTTP)**: `python server.py`
2.  **Configure Chrome (Android/Desktop)**:
    *   Go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
    *   Enable the flag.
    *   Add your server URL to the text box: `http://<YOUR_IP>:8080`
    *   Relaunch Chrome.
3.  **Access**: Go to `http://<YOUR_IP>:8080`.

---

## Troubleshooting

*   **"Connection Lost" / Peers won't connect**:
    *   Ensure both devices are on the **same Wi-Fi network**.
    *   Check your **Firewall** settings. Windows Firewall might block Python. Allow it if prompted.
    *   If using a VPN, try disabling it.
*   **File Transfer Stuck**:
    *   Refresh both pages and try again.
    *   Check the browser console (F12) for errors.
*   **Mobile Safari Issues**:
    *   Ensure you are using **HTTPS**. iOS is very strict about WebRTC permissions.
