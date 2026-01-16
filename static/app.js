/**
 * Airsetu File Transfer App
 * Modular architecture for better maintainability
 */

// --- Configuration ---
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

const RENDER_URL = 'https://app-p2p.onrender.com/';
let SIGNALING_SERVER_URL = RENDER_URL;

// If running locally in Electron, use the local server (localhost:8080)
// This allows you to test locally without deploying, while Android uses the Render URL.
if (navigator.userAgent.indexOf('Electron') > -1) {
    console.log('Running in Electron: Using local server');
    SIGNALING_SERVER_URL = '';
}

// --- UI Manager ---
const UI = {
    elements: {
        joinScreen: document.getElementById('joinScreen'),
        transferScreen: document.getElementById('transferScreen'),
        createBtn: document.getElementById('createBtn'),
        joinBtn: document.getElementById('joinBtn'),
        leaveBtn: document.getElementById('leaveBtn'),
        roomInput: document.getElementById('roomInput'),
        roomIdDisplay: document.getElementById('roomIdDisplay'),
        connectionStatus: document.getElementById('connectionStatus'),
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        fileList: document.getElementById('fileList'),
        toastContainer: document.getElementById('toastContainer'),
        transferCount: document.getElementById('transferCount'),
        emptyState: document.getElementById('emptyState'),
        saveLocation: document.getElementById('saveLocation'), // New Element
    },

    init() {
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.elements.createBtn.addEventListener('click', () => Network.createRoom());
        this.elements.joinBtn.addEventListener('click', () => {
            const room = this.elements.roomInput.value.trim();
            if (room) Network.joinRoom(room);
            else UI.showToast('Please enter a Room ID', 'error');
        });

        this.elements.leaveBtn.addEventListener('click', () => {
            Network.leaveRoom();
        });

        this.elements.roomIdDisplay.addEventListener('click', () => {
            const code = this.elements.roomIdDisplay.querySelector('.code-text').textContent;
            navigator.clipboard.writeText(code).then(() => UI.showToast('Room ID copied to clipboard'));
        });

        // Drag & Drop
        const dz = this.elements.dropZone;
        dz.addEventListener('click', () => this.elements.fileInput.click());
        dz.addEventListener('dragover', (e) => {
            e.preventDefault();
            dz.classList.add('drag-over');
        });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            dz.classList.remove('drag-over');
            if (e.dataTransfer.files.length) FileTransfer.processFiles(e.dataTransfer.files);
        });

        this.elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) FileTransfer.processFiles(e.target.files);
        });
    },

    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screenName === 'transfer') {
            this.elements.transferScreen.classList.add('active');
            this.elements.joinScreen.classList.remove('active');
        } else {
            this.elements.joinScreen.classList.add('active');
            this.elements.transferScreen.classList.remove('active');
        }
    },

    updateConnectionStatus(status, type = 'neutral') {
        const el = this.elements.connectionStatus;
        const dot = el.querySelector('.status-dot');
        const text = el.querySelector('.status-text');

        text.textContent = status;
        dot.className = 'status-dot'; // Reset
        if (type === 'connected') dot.classList.add('connected');
        else if (type === 'error') dot.style.backgroundColor = 'var(--error-color)';
        else if (type === 'warning') {
            dot.classList.add('warning');
            dot.style.backgroundColor = 'var(--warning-color)';
        }
    },

    setRoomId(id) {
        this.elements.roomIdDisplay.querySelector('.code-text').textContent = id;
    },

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        if (type === 'error') toast.style.borderLeftColor = 'var(--error-color)';
        else if (type === 'success') toast.style.borderLeftColor = 'var(--success-color)';

        this.elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    addFileItem(fileId, name, size, type) {
        this.elements.emptyState.style.display = 'none';

        const item = document.createElement('div');
        item.className = 'file-item';
        item.id = `file-${fileId}`;

        // Auto-save logic: No buttons needed for download
        // But if type is upload, we assume auto-start too.

        item.innerHTML = `
            <div class="file-icon">
                <span class="material-icons-round">${type === 'upload' ? 'arrow_upward' : 'arrow_downward'}</span>
            </div>
            <div class="file-details">
                <div class="file-name" title="${name}">${name}</div>
                <div class="file-meta">
                    <span>${this.formatSize(size)}</span>
                    <span class="status">${type === 'download' ? 'Waiting...' : '0%'}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
        `;
        this.elements.fileList.prepend(item);
        this.updateTransferCount();
    },

    updateProgress(fileId, percent, statusText) {
        const item = document.getElementById(`file-${fileId}`);
        if (!item) return;

        const bar = item.querySelector('.progress-fill');
        const status = item.querySelector('.status');

        bar.style.width = `${percent}%`;
        if (statusText) status.textContent = statusText;
        else status.textContent = `${Math.round(percent)}%`;

        if (percent >= 100) {
            bar.style.backgroundColor = 'var(--success-color)';
        }
    },

    updateTransferCount() {
        const count = this.elements.fileList.querySelectorAll('.file-item').length;
        this.elements.transferCount.textContent = count;
    },

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

// --- Network Manager ---
const Network = {
    socket: null,
    peerConnection: null,
    dataChannel: null,
    myPeerId: null,
    currentRoom: null,
    isInitiator: false,
    iceServers: [],
    heartbeatInterval: null,

    async init() {
        try {
            // Determine base URL for API calls
            const baseUrl = SIGNALING_SERVER_URL || window.location.origin;
            // Remove trailing slash if present
            const cleanBaseUrl = baseUrl.replace(/\/$/, '');

            const res = await fetch(`${cleanBaseUrl}/config`);
            const config = await res.json();
            this.iceServers = config.iceServers;
        } catch (e) {
            console.error('Failed to fetch config', e);
        }
        this.connectSignaling();
    },

    connectSignaling() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }
        let wsUrl;
        if (SIGNALING_SERVER_URL) {
            // Use configured URL, ensuring wss/ws protocol
            try {
                const url = new URL(SIGNALING_SERVER_URL);
                const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${url.host}/ws`;
            } catch (e) {
                console.error("Invalid SIGNALING_SERVER_URL, falling back:", e);
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${window.location.host}/ws`;
            }
        } else {
            // Fallback to local relative path
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}/ws`;
        }

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => UI.updateConnectionStatus('Server Connected', 'connected');
        this.socket.onclose = (e) => {
            UI.updateConnectionStatus('Disconnected', 'error');
            console.error('WebSocket Closed:', e);
            UI.showToast(`Connection lost: Code ${e.code}, Reason: ${e.reason || 'Unknown'}`, 'error');
        };
        this.socket.onerror = (e) => {
            console.error('WebSocket Error:', e);
            UI.showToast('Connection Error. Check console/logs.', 'error');
        };
        this.socket.onmessage = (e) => this.handleSignalingMessage(JSON.parse(e.data));
    },

    createRoom() {
        this.isInitiator = true;
        this.socket.send(JSON.stringify({ action: 'join' }));
    },

    joinRoom(roomId) {
        this.isInitiator = false;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: 'join', room: roomId }));
        } else {
            UI.showToast('Server not connected. Reconnecting...', 'warning');
            this.connectSignaling();
        }
    },

    leaveRoom() {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ action: 'leave' }));
        }
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        window.location.reload();
    },

    async handleSignalingMessage(msg) {
        console.log('Signal:', msg.type);
        switch (msg.type) {
            case 'joined':
                this.myPeerId = msg.peer_id;
                this.currentRoom = msg.room_id;
                UI.setRoomId(this.currentRoom);
                UI.showScreen('transfer');
                UI.showToast(`Joined room: ${this.currentRoom}`);

                if (msg.peers.length > 0) {
                    this.isInitiator = true;
                    this.createPeerConnection(msg.peers[0]);
                }
                break;

            case 'peer-joined':
                UI.showToast('Peer connecting...', 'info');
                break;

            case 'signal':
                if (!this.peerConnection) {
                    this.isInitiator = false;
                    await this.createPeerConnection(msg.sender);
                }
                this.handleWebRTCSignal(msg.payload, msg.sender);
                break;

            case 'peer-left':
                if (this.peerConnection) {
                    this.peerConnection.close();
                    this.peerConnection = null;
                    this.dataChannel = null;
                }
                UI.updateConnectionStatus('Peer Left', 'error');
                UI.showToast('Peer disconnected', 'error');
                FileTransfer.releaseWakeLock();
                this.stopHeartbeat();
                break;
        }
    },

    async createPeerConnection(targetPeerId) {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

        this.peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                this.sendSignal('candidate', e.candidate, targetPeerId);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection State:', state);
            if (state === 'connected') {
                UI.updateConnectionStatus('Peer Connected', 'connected');
                UI.showToast('Secure connection established', 'success');
                FileTransfer.requestWakeLock();
                this.startHeartbeat();
            } else if (state === 'disconnected') {
                UI.updateConnectionStatus('Peer Disconnected (WAITING)', 'warning');
                console.log('Peer disconnected, waiting for possible reconnection or failure');
            } else if (state === 'failed' || state === 'closed') {
                UI.updateConnectionStatus('Connection Lost', 'error');
                UI.showToast('Peer connection lost permanently', 'error');
                FileTransfer.releaseWakeLock();
                this.stopHeartbeat();
            }
        };

        if (this.isInitiator) {
            this.dataChannel = this.peerConnection.createDataChannel('fileTransfer');
            this.setupDataChannel(this.dataChannel);

            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            this.sendSignal('offer', offer, targetPeerId);
        } else {
            this.peerConnection.ondatachannel = (e) => {
                this.dataChannel = e.channel;
                this.setupDataChannel(this.dataChannel);
            };
        }
    },

    async handleWebRTCSignal(payload, sender) {
        if (payload.type === 'offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            this.sendSignal('answer', answer, sender);
        } else if (payload.type === 'answer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (payload.candidate) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload));
            } catch (e) {
                console.error('ICE Error', e);
            }
        }
    },

    setupDataChannel(channel) {
        channel.onopen = () => console.log('Data Channel Open');
        channel.onmessage = (e) => FileTransfer.handleMessage(e.data);
    },

    sendSignal(type, payload, target) {
        this.socket.send(JSON.stringify({
            action: 'signal',
            target: target,
            payload: type === 'candidate' ? payload : { type, ...payload }
        }));
    },

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(data);
            return true;
        }
        return false;
    },

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.dataChannel && this.dataChannel.readyState === 'open') {
                this.dataChannel.send(JSON.stringify({ type: 'ping' }));
            }
        }, 5000); // Send ping every 5 seconds
    },

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
};

// --- File Transfer Manager ---
const FileTransfer = {
    CHUNK_SIZE: 65536, // 64KB
    wakeLock: null,

    // Stores files waiting to be sent
    pendingUploads: new Map(),

    // Stores active downloads
    activeDownloads: new Map(),

    // Stores metadata for pending downloads (unused in auto-save mode)
    pendingDownloads: new Map(),

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (err) {
                console.error('Wake Lock error:', err);
            }
        }
    },

    async releaseWakeLock() {
        if (this.wakeLock) {
            await this.wakeLock.release();
            this.wakeLock = null;
        }
    },

    async processFiles(files) {
        // Wake Lock is now managed by Network connection state
        for (const file of Array.from(files)) {
            await this.queueFile(file);
        }
    },

    async queueFile(file) {
        const fileId = Date.now() + Math.random().toString(36).substr(2, 5);

        // Store file for later sending
        this.pendingUploads.set(fileId, file);

        UI.addFileItem(fileId, file.name, file.size, 'upload');
        UI.updateProgress(fileId, 0, 'Waiting for acceptance...');

        if (!Network.sendData(JSON.stringify({
            type: 'metadata',
            fileId: fileId,
            name: file.name,
            size: file.size,
            fileType: file.type
        }))) {
            UI.showToast('Connection not ready', 'error');
            this.pendingUploads.delete(fileId);
        }
    },

    async acceptFile(fileId, metadata) {
        // Initialize active download state
        this.activeDownloads.set(fileId, {
            metadata,
            buffer: [],
            receivedSize: 0,
            startTime: Date.now()
        });

        // Notify sender to start
        Network.sendData(JSON.stringify({
            type: 'accept',
            fileId: fileId
        }));

        UI.updateProgress(fileId, 0, 'Downloading...');
    },

    async startTransfer(fileId) {
        const file = this.pendingUploads.get(fileId);
        if (!file) return;

        const channel = Network.dataChannel;
        // High watermark: 16MB. If buffer > 16MB, we stop pushing.
        const MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024;

        // Set low watermark (threshold) for the event
        channel.bufferedAmountLowThreshold = this.CHUNK_SIZE;

        let offset = 0;
        const reader = new FileReader();

        const sendChunk = () => {
            if (offset >= file.size) return; // Done inside loop, but safety check

            const slice = file.slice(offset, offset + this.CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            const data = e.target.result;

            try {
                Network.sendData(data);
                offset += data.byteLength;

                const percent = (offset / file.size) * 100;
                UI.updateProgress(fileId, percent);

                if (offset < file.size) {
                    if (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
                        // Wait for buffer to drain
                        const startWait = Date.now();
                        const onLowBuffer = () => {
                            channel.removeEventListener('bufferedamountlow', onLowBuffer);
                            sendChunk();
                        };
                        channel.addEventListener('bufferedamountlow', onLowBuffer);
                    } else {
                        // Buffer is fine, keep pushing immediately
                        sendChunk();
                    }
                } else {
                    // Finished
                    Network.sendData(JSON.stringify({ type: 'end', fileId: fileId }));
                    UI.updateProgress(fileId, 100, 'Completed');
                    this.pendingUploads.delete(fileId);
                }
            } catch (err) {
                console.error("Error sending chunk:", err);
                UI.showToast("Transfer Error", "error");
            }
        };

        // Start the loop
        sendChunk();
    },

    async handleMessage(data) {
        if (typeof data === 'string') {
            const msg = JSON.parse(data);

            if (msg.type === 'ping') return;

            if (msg.type === 'metadata') {
                // AUTO-SAVE LOGIC:
                UI.addFileItem(msg.fileId, msg.name, msg.size, 'download');
                await this.acceptFile(msg.fileId, msg);
            }
            else if (msg.type === 'accept') {
                // Sender received acceptance
                this.startTransfer(msg.fileId);
            }
            else if (msg.type === 'end') {
                const download = this.activeDownloads.get(msg.fileId);
                if (download) {
                    await this.saveFile(msg.fileId);
                }
            }
        } else {
            // Binary Data
            const activeKeys = Array.from(this.activeDownloads.keys());
            if (activeKeys.length === 0) return;

            const fileId = activeKeys[0]; // Assume the first one
            const download = this.activeDownloads.get(fileId);

            download.receivedSize += data.byteLength;
            download.buffer.push(data);

            const percent = (download.receivedSize / download.metadata.size) * 100;
            UI.updateProgress(fileId, percent);
        }
    },

    async saveFile(fileId) {
        const download = this.activeDownloads.get(fileId);
        if (!download) return;

        const { metadata, buffer } = download;

        // Check if running in Capacitor (Native)
        const isNative = window.Capacitor && window.Capacitor.isNative;

        if (isNative) {
            try {
                // Create Blob from all chunks
                const blob = new Blob(buffer);

                // For Android "Save As" functionality, we use the Share API.
                // We write the file to the Cache directory first, then Share it.
                // This lets the user pick "Save to..." or any app they want.

                try {
                    const tempPath = `temp_${Date.now()}_${metadata.name}`;
                    await this.writeBlobSmartly(tempPath, blob, Directory.Cache);

                    const uriResult = await Filesystem.getUri({
                        path: tempPath,
                        directory: Directory.Cache
                    });

                    await Share.share({
                        title: 'Save File',
                        text: `Saving ${metadata.name}`,
                        url: uriResult.uri,
                        dialogTitle: 'Save File To...'
                    });

                    UI.updateProgress(fileId, 100, 'Shared/Saved');
                    UI.showToast('File opened in Share sheet', 'success');

                    // Cleanup temp file later if possible, but Cache is auto-cleaned by OS eventually.
                } catch (e) {
                    console.error('Share Error:', e);
                    // Fallback to Downloads if Share fails
                    try {
                        await this.writeBlobSmartly(metadata.name, blob, Directory.Downloads);
                        UI.updateProgress(fileId, 100, 'Saved to Downloads');
                        UI.showToast(`Saved ${metadata.name} to Downloads`, 'success');
                    } catch (err) {
                        console.error('Fallback Save Error:', err);
                        UI.showToast('Failed to save file', 'error');
                    }
                }
            } catch (e) {
                console.error('Save Error:', e);
                UI.showToast('Error saving file', 'error');
            }
        } else {
            // WEB: Auto-download to browser defaults (Downloads)
            const blob = new Blob(buffer, { type: metadata.fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = metadata.name;
            a.click();
            URL.revokeObjectURL(url);

            UI.updateProgress(fileId, 100, 'Saved');
            UI.showToast(`Saved ${metadata.name}`, 'success');
        }

        this.activeDownloads.delete(fileId);
    },

    async writeBlobSmartly(filename, blob, directory) {
        const CHUNK_SIZE = 512 * 1024; // 512KB chunks to separate binder transactions
        const totalSize = blob.size;
        let offset = 0;
        let isFirstChunk = true;

        while (offset < totalSize) {
            const chunkBlob = blob.slice(offset, offset + CHUNK_SIZE);
            const base64Data = await this.blobToBase64(chunkBlob);

            if (isFirstChunk) {
                await Filesystem.writeFile({
                    path: filename,
                    data: base64Data,
                    directory: directory,
                    recursive: true
                });
                isFirstChunk = false;
            } else {
                await Filesystem.appendFile({
                    path: filename,
                    data: base64Data,
                    directory: directory
                });
            }

            offset += CHUNK_SIZE;

            // Optional: Update progress for saving phase if needed,
            // but we usually treat 'save' as the final 100% step.
        }
    },

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                // Strip the data URL prefix (e.g. "data:application/octet-stream;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
};

// Expose FileTransfer to window for UI onclick handlers
window.FileTransfer = FileTransfer;
window.Network = Network;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Network.init();

    // App State Handling
    App.addListener('appStateChange', ({ isActive }) => {
        console.log('App state changed. Is active?', isActive);
        if (isActive) {
            // App came to foreground
            if (Network.socket && Network.socket.readyState === WebSocket.CLOSED) {
                console.log('Reconnecting WebSocket...');
                Network.connectSignaling();
            }
        }
    });

    // Start Foreground Service (Android only)
    if (window.Capacitor && window.Capacitor.isNative && window.Capacitor.getPlatform() === 'android') {
        try {
            ForegroundService.startForegroundService({
                id: 123,
                title: "Airsetu",
                body: "Running in background to keep connection alive",
                smallIcon: "ic_launcher", // Ensure this resource exists
            }).then(() => console.log('Foreground Service Started'))
                .catch(err => console.error('Failed to start Foreground Service', err));
        } catch (e) {
            console.error('Error calling Foreground Service', e);
        }
    }
});
