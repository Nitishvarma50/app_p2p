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
            window.location.reload(); // Simple way to reset state
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
        item.innerHTML = `
            <div class="file-icon">
                <span class="material-icons-round">${type === 'upload' ? 'arrow_upward' : 'arrow_downward'}</span>
            </div>
            <div class="file-details">
                <div class="file-name" title="${name}">${name}</div>
                <div class="file-meta">
                    <span>${this.formatSize(size)}</span>
                    <span class="status">0%</span>
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
        let wsUrl;
        if (SIGNALING_SERVER_URL) {
            // Use configured URL, ensuring wss/ws protocol
            const url = new URL(SIGNALING_SERVER_URL);
            const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${url.host}/ws`;
        } else {
            // Fallback to local relative path
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            wsUrl = `${protocol}//${window.location.host}/ws`;
        }

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => UI.updateConnectionStatus('Server Connected', 'connected');
        this.socket.onclose = () => UI.updateConnectionStatus('Disconnected', 'error');
        this.socket.onmessage = (e) => this.handleSignalingMessage(JSON.parse(e.data));
    },

    createRoom() {
        this.isInitiator = true;
        this.socket.send(JSON.stringify({ action: 'join' }));
    },

    joinRoom(roomId) {
        this.isInitiator = false;
        this.socket.send(JSON.stringify({ action: 'join', room: roomId }));
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
                break;
        }
    },

    async createPeerConnection(targetPeerId) {
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
            } else if (state === 'disconnected' || state === 'failed') {
                UI.updateConnectionStatus('Connection Lost', 'error');
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
    }
};

// --- File Transfer Manager ---
const FileTransfer = {
    CHUNK_SIZE: 16 * 1024, // 16KB
    wakeLock: null,
    incoming: {
        buffer: [],
        writable: null,
        mode: 'blob', // 'blob' or 'stream'
        receivedSize: 0,
        metadata: null,
        startTime: 0
    },

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

    processFiles(files) {
        this.requestWakeLock();
        Array.from(files).forEach(file => this.sendFile(file));
    },

    async sendFile(file) {
        if (!Network.sendData(JSON.stringify({
            type: 'metadata',
            name: file.name,
            size: file.size,
            fileType: file.type
        }))) {
            UI.showToast('Connection not ready', 'error');
            return;
        }

        const fileId = Date.now() + Math.random().toString(36).substr(2, 5);
        UI.addFileItem(fileId, file.name, file.size, 'upload');

        const reader = new FileReader();
        let offset = 0;

        reader.onload = (e) => {
            Network.sendData(e.target.result);
            offset += e.target.result.byteLength;

            const percent = (offset / file.size) * 100;
            UI.updateProgress(fileId, percent);

            if (offset < file.size) {
                if (Network.dataChannel.bufferedAmount > 16 * 1024 * 1024) {
                    setTimeout(readSlice, 50);
                } else {
                    readSlice();
                }
            } else {
                Network.sendData(JSON.stringify({ type: 'end' }));
                UI.updateProgress(fileId, 100, 'Completed');
                this.releaseWakeLock();
            }
        };

        const readSlice = () => {
            const slice = file.slice(offset, offset + this.CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        readSlice();
    },

    async handleMessage(data) {
        if (typeof data === 'string') {
            const msg = JSON.parse(data);
            if (msg.type === 'metadata') {
                this.requestWakeLock();
                this.incoming.metadata = msg;
                this.incoming.receivedSize = 0;
                this.incoming.startTime = Date.now();
                this.incoming.id = Date.now(); // Temp ID

                // Try File System Access API
                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: msg.name,
                        });
                        this.incoming.writable = await handle.createWritable();
                        this.incoming.mode = 'stream';
                    } catch (e) {
                        console.log('File Picker cancelled or failed, falling back to Blob', e);
                        this.incoming.buffer = [];
                        this.incoming.mode = 'blob';
                    }
                } else {
                    this.incoming.buffer = [];
                    this.incoming.mode = 'blob';
                }

                UI.addFileItem(this.incoming.id, msg.name, msg.size, 'download');
            } else if (msg.type === 'end') {
                await this.saveFile();
                this.releaseWakeLock();
            }
        } else {
            // Binary Data
            this.incoming.receivedSize += data.byteLength;

            if (this.incoming.mode === 'stream' && this.incoming.writable) {
                await this.incoming.writable.write(data);
            } else {
                this.incoming.buffer.push(data);
            }

            if (this.incoming.metadata) {
                const percent = (this.incoming.receivedSize / this.incoming.metadata.size) * 100;
                UI.updateProgress(this.incoming.id, percent);
            }
        }
    },

    async saveFile() {
        const { metadata, buffer, mode, writable } = this.incoming;

        if (mode === 'stream' && writable) {
            await writable.close();
            UI.updateProgress(this.incoming.id, 100, 'Saved');
            UI.showToast(`Received ${metadata.name}`, 'success');
            this.incoming.writable = null;
            this.incoming.metadata = null;
        } else {
            const blob = new Blob(buffer, { type: metadata.fileType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = metadata.name;
            a.click();
            URL.revokeObjectURL(url);

            UI.updateProgress(this.incoming.id, 100, 'Saved');
            UI.showToast(`Received ${metadata.name}`, 'success');

            // Reset
            this.incoming.buffer = [];
            this.incoming.metadata = null;
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    UI.init();
    Network.init();
});
