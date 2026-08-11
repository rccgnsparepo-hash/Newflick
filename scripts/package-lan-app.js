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
  // 0. Ensure valid PNG and ICO icon assets exist for cross-platform desktop builds
  console.log('[0/4] Verifying LAN desktop icon assets...');
  try {
    const pngPath = path.join(rootDir, 'public', 'icon.png');
    const icoPath = path.join(rootDir, 'public', 'icon.ico');
    let needsGen = false;

    if (!fs.existsSync(pngPath) || !fs.existsSync(icoPath)) {
      needsGen = true;
    } else {
      const pngHeader = fs.readFileSync(pngPath).subarray(0, 8).toString('hex');
      if (pngHeader !== '89504e470d0a1a0a') {
        needsGen = true;
      }
    }

    if (needsGen) {
      console.log('Generating valid PNG and ICO icons from PWA logo...');
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default || sharpModule;
      const logoPath = path.join(rootDir, 'public', 'flick_pwa_logo.jpg');
      
      const png512 = await sharp(logoPath).resize(512, 512, { fit: 'cover' }).png().toBuffer();
      fs.writeFileSync(pngPath, png512);

      const png256 = await sharp(logoPath).resize(256, 256, { fit: 'cover' }).png().toBuffer();
      const header = Buffer.alloc(6);
      header.writeUInt16LE(0, 0);
      header.writeUInt16LE(1, 2);
      header.writeUInt16LE(1, 4);

      const entry = Buffer.alloc(16);
      entry.writeUInt8(0, 0);
      entry.writeUInt8(0, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(png256.length, 8);
      entry.writeUInt32LE(22, 12);

      const icoBuf = Buffer.concat([header, entry, png256]);
      fs.writeFileSync(icoPath, icoBuf);
      console.log('✓ Successfully generated public/icon.png and public/icon.ico');
    } else {
      console.log('✓ Valid PNG and ICO icons present.');
    }
  } catch (err) {
    console.warn('⚠️ Icon verification warning:', err.message);
  }

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
  execSync('npx electron-builder --config electron-builder.yml', { cwd: path.join(rootDir, 'lan-server'), stdio: 'inherit' });

  console.log('===================================================');
  console.log('✓ SUCCESS: LAN Server desktop application bundled!');
  console.log('  Artifacts located in: lan-server/release/');
  console.log('===================================================');
} catch (error) {
  console.error('❌ Failed to package LAN application:', error);
  process.exit(1);
}
