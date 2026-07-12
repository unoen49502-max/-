const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

// Linux 環境では透過ウィンドウが GPU 合成と相性が悪いことがあるため無効化しておく
app.disableHardwareAcceleration();

let win = null;
let tray = null;
let paused = false;

const TRAY_ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAATUlEQVR4nGNgoCb4v9TpP9lqQBIwjE8zVjXIEqRgijRT5BKC/iPLEKoaoCEnh6EBXYy2BlAtDE5E2YAx1WMCq2ZiDcGrmZAhRGkmFQAAp7GZyMm/2bkAAAAASUVORK5CYII=';

function trayIcon() {
  return nativeImage.createFromDataURL('data:image/png;base64,' + TRAY_ICON_BASE64);
}

// 作業領域(タスクバー等を除いた領域)いっぱいに透明ウィンドウを広げる
function fitToWorkArea() {
  if (!win) return;
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds(workArea);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'まんなかに呼ぶ',
      click: () => win && win.webContents.send('command', 'center'),
    },
    {
      label: paused ? 'おさんぽ再開' : 'おさんぽ停止',
      click: () => win && win.webContents.send('command', 'toggle-pause'),
    },
    { type: 'separator' },
    { label: '終了', click: () => app.quit() },
  ]);
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // キャラクター以外の場所はクリックを下のアプリへ素通しする
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => (win = null));
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  createWindow();

  tray = new Tray(trayIcon());
  tray.setToolTip('デスクトップマスコット');
  tray.setContextMenu(buildMenu());

  screen.on('display-metrics-changed', fitToWorkArea);
  screen.on('display-added', fitToWorkArea);
  screen.on('display-removed', fitToWorkArea);
});

// キャラクターの上にマウスが乗っている間だけウィンドウを操作可能にする
ipcMain.on('set-interactive', (_e, interactive) => {
  if (win) win.setIgnoreMouseEvents(!interactive, { forward: true });
});

ipcMain.on('show-context-menu', () => {
  if (win) buildMenu().popup({ window: win });
});

ipcMain.on('paused-state', (_e, state) => {
  paused = !!state;
  if (tray) tray.setContextMenu(buildMenu());
});

app.on('window-all-closed', () => app.quit());
