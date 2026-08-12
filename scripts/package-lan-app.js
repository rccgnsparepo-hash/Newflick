import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('===================================================');
console.log('   Flick LAN Packaging Script: Frontend + Server   ');
console.log('===================================================');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  // 1. Build Vite frontend app
  console.log('[1/4] Building Vite frontend Web App...');
  execSync('npx vite build', { cwd: rootDir, stdio: 'inherit' });

  // 2. Build LAN Server TypeScript
  console.log('[2/4] Building LAN Server TypeScript Backend...');
  execSync('npm --prefix lan-server run build', { cwd: rootDir, stdio: 'inherit' });

  // 3. Copy dist/ frontend build into lan-server/dist/public
  const frontendDistDir = path.join(rootDir, 'dist');
  const lanServerPublicDir = path.join(rootDir, 'lan-server', 'dist', 'public');

  console.log('[3/4] Copying web app build to lan-server/dist/public...');
  if (fs.existsSync(frontendDistDir)) {
    if (!fs.existsSync(lanServerPublicDir)) {
      fs.mkdirSync(lanServerPublicDir, { recursive: true });
    }
    copyRecursiveSync(frontendDistDir, lanServerPublicDir);
    console.log('✓ Successfully copied static frontend assets into LAN Server bundle.');
  } else {
    console.warn('⚠️ Frontend build directory dist/ does not exist!');
  }

  // 4. Run electron-builder to generate installer executable binaries (EXE/AppImage/DMG)
  console.log('[4/4] Generating LAN Server desktop executables (release artifacts)...');
  execSync('npx electron-builder --project . --config electron-builder.yml', { cwd: path.join(rootDir, 'lan-server'), stdio: 'inherit' });

  console.log('===================================================');
  console.log('✓ SUCCESS: LAN Server desktop application bundled!');
  console.log('  Artifacts located in: lan-server/release/');
  console.log('===================================================');
} catch (error) {
  console.error('❌ Failed to package LAN application:', error);
  process.exit(1);
}
