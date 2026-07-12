const fs = require('fs');

function patchFile(file) {
  try {
    let code = fs.readFileSync(file, 'utf8');
    code = code.replace(/console\.error/g, 'console.warn');
    fs.writeFileSync(file, code);
  } catch (e) {
    console.log(`Could not patch ${file}`);
  }
}

const files = [
  'src/components/ProfileSettingsModal.tsx',
  'src/components/SecureNewsFlow.tsx',
  'src/components/LiveSportsHub.tsx',
  'src/components/ChatSection.tsx',
  'src/components/FeedSection.tsx',
  'src/components/SettingsAccountTab.tsx',
  'src/components/AuthScreen.tsx',
  'src/components/WorkspaceHub.tsx',
  'src/components/UserProfileModal.tsx',
  'src/lib/pushNotifications.ts',
  'src/lib/offlineQueue.ts',
  'src/lib/services.ts',
  'src/lib/deepLinkManager.ts',
  'src/App.tsx',
  'src/contexts/ConnectivityContext.tsx',
  'src/contexts/AuthContext.tsx'
];

files.forEach(patchFile);
