import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lanServerAPI', {
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  backupDatabase: () => ipcRenderer.invoke('backup-database')
});
