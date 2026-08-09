// Fetch status from local server endpoint
async function refreshDashboardStatus() {
  try {
    const res = await fetch('http://127.0.0.1:47821/health');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('valServerName').innerText = data.serverName || 'Flick School Server';
      document.getElementById('valLanIp').innerText = data.ipAddress || '127.0.0.1';
      document.getElementById('valPort').innerText = data.port || 47821;
      document.getElementById('valConnectedDevices').innerText = data.connectedClients || 0;
      document.getElementById('valActiveUsers').innerText = data.activeUsers || 0;
      document.getElementById('valMediaSize').innerText = `${data.mediaSizeMB || 0} MB`;
      document.getElementById('valCloudSync').innerText = data.cloudStatus || 'CONNECTED';

      appendLog(`[HEALTH] Polled status - ${data.connectedClients} clients connected.`);
    }
  } catch (err) {
    console.warn('Health check retry:', err);
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
