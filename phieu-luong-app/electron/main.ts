import { app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';
import { registerIpcHandlers } from './ipc/handlers';
import { sweepLeakedPdfs } from './modules/pdfRenderer';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Phiếu Lương',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools chỉ mở khi DEBUG=1 — tránh phiền mắt khi test bình thường.
    // Mở thủ công bất cứ lúc nào: Cmd+Opt+I (Mac) / Ctrl+Shift+I (Win/Linux)
    if (process.env.DEBUG === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    console.log('[updater] Có phiên bản mới — đang tải về ngầm...');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Cập nhật sẵn sàng',
      message: 'Đã tải xong phiên bản mới. Khởi động lại để áp dụng?',
      buttons: ['Khởi động lại ngay', 'Để sau'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Lỗi:', err.message);
  });

  // Kiểm tra sau 3 giây để window kịp render xong
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);

  // Check định kỳ mỗi 4 tiếng — user để app mở cả ngày vẫn nhận update
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  setInterval(() => autoUpdater.checkForUpdates(), FOUR_HOURS);
}

app.whenReady().then(() => {
  const swept = sweepLeakedPdfs();
  if (swept > 0) console.log(`[startup] dọn ${swept} temp PDF còn sót từ session trước`);
  registerIpcHandlers();
  createMainWindow();

  if (!isDev) setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
