const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const override = `
const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args.join(' ');
  if (msg.includes('Missing or insufficient permissions') || msg.includes('ResizeObserver')) {
    return;
  }
  originalConsoleError.apply(console, args);
};
`;

if (!code.includes('originalConsoleError')) {
  code = code.replace("import { initBootstrap } from './lib/bootstrap';", "import { initBootstrap } from './lib/bootstrap';\n" + override);
  fs.writeFileSync('src/main.tsx', code);
}
