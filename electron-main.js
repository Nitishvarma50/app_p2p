const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const SERVER_PORT = 8080;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

function startPythonServer() {
    // Check if server is already running
    const req = http.get(SERVER_URL, (res) => {
        console.log('Server already running');
        createWindow();
    });

    req.on('error', (err) => {
        console.log('Starting Python server...');
        serverProcess = spawn('python', ['server.py'], {
            cwd: __dirname,
            stdio: 'inherit' // Pipe output to console
        });

        serverProcess.on('error', (err) => {
            console.error('Failed to start server:', err);
        });

        // Wait for server to be ready
        setTimeout(createWindow, 1000);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Load from localhost instead of file://
    mainWindow.loadURL(SERVER_URL).catch(err => {
        console.log(`Failed to load ${SERVER_URL}, retrying...`);
        setTimeout(() => mainWindow.loadURL(SERVER_URL), 1000);
    });

    mainWindow.setMenuBarVisibility(false);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    startPythonServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
