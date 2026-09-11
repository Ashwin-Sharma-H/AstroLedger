import { contextBridge } from 'electron';

// Expose safe desktop system primitives to the React frontend
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: '1.0.0',
});
