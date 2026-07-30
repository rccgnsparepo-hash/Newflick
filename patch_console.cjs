const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const override = `
const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args.map(arg => arg instanceof Error ? arg.message : typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg)).join(' ');
  if (msg.includes('Missing or insufficient permissions') || msg.includes('ResizeObserver')) {
    return;
  }
  originalConsoleError.apply(console, args);
};
`;

code = code.replace(/const originalConsoleError = console\.error;[\s\S]*?originalConsoleError\.apply\(console, args\);\n};\n/, override);
fs.writeFileSync('src/main.tsx', code);
