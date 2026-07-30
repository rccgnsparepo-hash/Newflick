const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace(
  `window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('Missing or insufficient permissions')) {
    e.preventDefault();
  }
});`,
  `window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('Missing or insufficient permissions')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});`
);
fs.writeFileSync('src/main.tsx', code);
