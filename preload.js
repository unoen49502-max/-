const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mascot', {
  setInteractive: (on) => ipcRenderer.send('set-interactive', !!on),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  reportPaused: (state) => ipcRenderer.send('paused-state', !!state),
  onCommand: (callback) => ipcRenderer.on('command', (_e, cmd) => callback(cmd)),
});
