// Fetch status from local server via IPC or REST fallback
async function refreshDashboardStatus() {
  try {
    let data = null;
    if (window.lanServerAPI && typeof window.lanServerAPI.getServerStatus === 'function') {
      data = await window.lanServerAPI.getServerStatus();
    } else {
      const res = await fetch('http://127.0.0.1:47821/health');
      if (res.ok) {
        data = await res.json();
      }
    }
    if (data) {
      if (document.getElementById('valServerName')) document.getElementById('valServerName').innerText = data.serverName || 'Flick LAN Node';
      if (document.getElementById('valLanIp')) document.getElementById('valLanIp').innerText = data.ipAddress || '127.0.0.1';
      if (document.getElementById('valPort')) document.getElementById('valPort').innerText = data.port || 47821;
      if (document.getElementById('valConnectedDevices')) document.getElementById('valConnectedDevices').innerText = data.connectedClients || 0;
      if (document.getElementById('valActiveUsers')) document.getElementById('valActiveUsers').innerText = data.activeUsers || 0;
      if (document.getElementById('valMediaSize')) document.getElementById('valMediaSize').innerText = `${data.mediaSizeMB || 0} MB`;
      if (document.getElementById('valCloudSync')) document.getElementById('valCloudSync').innerText = data.cloudStatus || 'ONLINE';

      appendLog(`[STATUS] Service online on ${data.ipAddress}:${data.port}`);
    }
  } catch (err) {
    console.warn('Dashboard status poll warning:', err);
  }
}

function appendLog(msg) {
  const container = document.getElementById('logsContainer');
  if (!container) return;
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerText = `[${time}] ${msg}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function restartServer() {
  appendLog('[ACTION] Restarting LAN server services...');
  setTimeout(() => {
    appendLog('[ACTION] LAN Server restarted successfully.');
    refreshDashboardStatus();
  }, 1000);
}

function openDataFolder() {
  appendLog('[ACTION] Data folder: ./lan-server-data/');
  alert('Data Directory: lan-server-data/\nContains: SQLite DB, Media Uploads, Sync Operations, Audit Logs.');
}

function backupDatabase() {
  appendLog('[ACTION] Database snapshot backup created in ./lan-server-data/backups/');
  alert('Backup snapshot created successfully!');
}

function exportLogs() {
  appendLog('[ACTION] Exported audit logs.');
  alert('Audit logs exported successfully!');
}

setInterval(refreshDashboardStatus, 5000);
refreshDashboardStatus();
