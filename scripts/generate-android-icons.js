import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateAllIcons() {
  console.log('🚀 Starting Full Android & App Icon Generation...');

  // 1. Locate source icon
  let sourcePath = '';
  if (fs.existsSync('src/assets/images/flick_app_icon_1785051300778.jpg')) {
    sourcePath = 'src/assets/images/flick_app_icon_1785051300778.jpg';
  } else if (fs.existsSync('public/icon.png')) {
    sourcePath = 'public/icon.png';
  } else if (fs.existsSync('public/flick_pwa_logo.jpg')) {
    sourcePath = 'public/flick_pwa_logo.jpg';
  }

  if (!sourcePath) {
    console.error('❌ No source icon found to generate from.');
    return;
  }

  console.log(`✓ Using source icon: ${sourcePath}`);

  // Ensure directories exist
  const dirs = [
    'public',
    'assets',
    'android/app/src/main/res/drawable',
    'android/app/src/main/res/drawable-night',
    'android/app/src/main/res/mipmap-mdpi',
    'android/app/src/main/res/mipmap-hdpi',
    'android/app/src/main/res/mipmap-xhdpi',
    'android/app/src/main/res/mipmap-xxhdpi',
    'android/app/src/main/res/mipmap-xxxhdpi',
    'android/app/src/main/assets/public'
  ];

  const splashDirs = [
    'drawable-land-mdpi', 'drawable-land-hdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi',
    'drawable-port-mdpi', 'drawable-port-hdpi', 'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi',
    'drawable-land-night-mdpi', 'drawable-land-night-hdpi', 'drawable-land-night-xhdpi', 'drawable-land-night-xxhdpi', 'drawable-land-night-xxxhdpi',
    'drawable-port-night-mdpi', 'drawable-port-night-hdpi', 'drawable-port-night-xhdpi', 'drawable-port-night-xxhdpi', 'drawable-port-night-xxxhdpi'
  ];

  splashDirs.forEach(d => dirs.push(`android/app/src/main/res/${d}`));

  dirs.forEach(d => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });

  const sourceBuffer = await sharp(sourcePath).toBuffer();

  // 1. Generate Web & PWA Icons
  console.log('Generating Web & PWA Icons...');
  await sharp(sourceBuffer).resize(512, 512).png({ quality: 100 }).toFile('public/icon.png');
  await sharp(sourceBuffer).resize(1024, 1024).jpeg({ quality: 95 }).toFile('public/flick_pwa_logo.jpg');
  await sharp(sourceBuffer).resize(1024, 1024).png({ quality: 100 }).toFile('assets/icon.png');
  await sharp(sourceBuffer).resize(1024, 1024).jpeg({ quality: 95 }).toFile('assets/icon.jpg');

  // Copy to android assets directory if it exists
  if (fs.existsSync('android/app/src/main/assets/public')) {
    await sharp(sourceBuffer).resize(512, 512).png().toFile('android/app/src/main/assets/public/icon.png');
    await sharp(sourceBuffer).resize(1024, 1024).jpeg().toFile('android/app/src/main/assets/public/flick_pwa_logo.jpg');
  }

  // 2. Generate Android Mipmap Icons
  console.log('Generating Android Mipmap Icons...');
  const mipmaps = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
  ];

  for (const m of mipmaps) {
    const targetDir = `android/app/src/main/res/${m.dir}`;
    
    // Standard icon
    await sharp(sourceBuffer)
      .resize(m.size, m.size)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // Round icon (with circular crop)
    const circleSvg = Buffer.from(
      `<svg width="${m.size}" height="${m.size}"><circle cx="${m.size/2}" cy="${m.size/2}" r="${m.size/2}" fill="#fff"/></svg>`
    );
    await sharp(sourceBuffer)
      .resize(m.size, m.size)
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // Adaptive Foreground (contain inside 72% inner area with padding)
    const fgInner = Math.round(m.fgSize * 0.72);
    const fgPadded = await sharp(sourceBuffer)
      .resize(fgInner, fgInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round((m.fgSize - fgInner) / 2),
        bottom: m.fgSize - fgInner - Math.round((m.fgSize - fgInner) / 2),
        left: Math.round((m.fgSize - fgInner) / 2),
        right: m.fgSize - fgInner - Math.round((m.fgSize - fgInner) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    // Adaptive Background (Dark #050505 background)
    await sharp({
      create: {
        width: m.fgSize,
        height: m.fgSize,
        channels: 4,
        background: { r: 5, g: 5, b: 5, alpha: 1 }
      }
    })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_background.png'));
  }

  // 3. Generate Android Status Notification Icon (ic_stat_flick_logo.png)
  console.log('Generating Notification Status Bar Icons...');
  if (fs.existsSync('android/app/src/main/res/drawable/ic_stat_flick_logo.xml')) {
    try { fs.unlinkSync('android/app/src/main/res/drawable/ic_stat_flick_logo.xml'); } catch (e) {}
  }
  await sharp(sourceBuffer)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile('android/app/src/main/res/drawable/ic_stat_flick_logo.png');

  // 4. Generate Splash Screens
  console.log('Generating Android Splash Screens...');
  const baseSplash = await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: { r: 5, g: 5, b: 5, alpha: 1 }
    }
  });

  const logoForSplash = await sharp(sourceBuffer)
    .resize(700, 700, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const splashBuffer = await baseSplash
    .composite([{ input: logoForSplash, gravity: 'center' }])
    .png()
    .toBuffer();

  await sharp(splashBuffer).toFile('assets/splash.png');
  await sharp(splashBuffer).jpeg({ quality: 95 }).toFile('assets/splash.jpg');

  // Generate drawables
  const splashSizes = [
    { dir: 'drawable', w: 480, h: 800 },
    { dir: 'drawable-night', w: 480, h: 800 },
    { dir: 'drawable-port-mdpi', w: 480, h: 800 },
    { dir: 'drawable-port-hdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xhdpi', w: 1080, h: 1920 },
    { dir: 'drawable-port-xxhdpi', w: 1440, h: 2560 },
    { dir: 'drawable-port-xxxhdpi', w: 1600, h: 2560 },
    { dir: 'drawable-land-mdpi', w: 800, h: 480 },
    { dir: 'drawable-land-hdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xhdpi', w: 1920, h: 1080 },
    { dir: 'drawable-land-xxhdpi', w: 2560, h: 1440 },
    { dir: 'drawable-land-xxxhdpi', w: 2560, h: 1600 },
  ];

  for (const s of splashSizes) {
    const targetDir = `android/app/src/main/res/${s.dir}`;
    const targetDirNight = `android/app/src/main/res/${s.dir.replace('drawable-', 'drawable-night-').replace('drawable-port', 'drawable-port-night').replace('drawable-land', 'drawable-land-night')}`;

    const iconSize = Math.round(Math.min(s.w, s.h) * 0.45);
    const resizedLogo = await sharp(sourceBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const splashImg = await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 5, g: 5, b: 5, alpha: 1 }
      }
    })
      .composite([{ input: resizedLogo, gravity: 'center' }])
      .png()
      .toBuffer();

    if (fs.existsSync(targetDir)) {
      await sharp(splashImg).toFile(path.join(targetDir, 'splash.png'));
    }
    if (fs.existsSync(targetDirNight)) {
      await sharp(splashImg).toFile(path.join(targetDirNight, 'splash.png'));
    }
  }

  console.log('✅ ALL ANDROID ICONS & ASSETS GENERATED SUCCESSFULLY!');
}

generateAllIcons().catch(err => {
  console.error('❌ Error generating icons:', err);
  process.exit(1);
});
