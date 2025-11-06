const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  selectOutputFolder: (defaultPath) => ipcRenderer.invoke('select-output-folder', defaultPath),
  downloadVideo: (url) => ipcRenderer.invoke('download-video', url),
  extractClip: (options) => ipcRenderer.invoke('extract-clip', options),
  extractFrame: (options) => ipcRenderer.invoke('extract-frame', options),
  exportQueue: (options) => ipcRenderer.invoke('export-queue', options),
  getVideoDuration: (videoPath) => ipcRenderer.invoke('get-video-duration', videoPath),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, data) => callback(data)),
  onDownloadStatus: (callback) => ipcRenderer.on('download-status', (event, data) => callback(data)),
  onExportProgress: (callback) => ipcRenderer.on('export-progress', (event, data) => callback(data)),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openFolder: (folderPath) => ipcRenderer.send('open-folder', folderPath)
});