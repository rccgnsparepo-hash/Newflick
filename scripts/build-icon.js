import sharp from 'sharp';
import fs from 'fs';

async function convertIcon() {
  if (fs.existsSync('public/flick_pwa_logo.jpg')) {
    await sharp('public/flick_pwa_logo.jpg')
      .resize(256, 256)
      .png()
      .toFile('public/icon.png');
    console.log('Icon converted to PNG successfully.');
  } else {
    console.error('Source JPG icon not found.');
    process.exit(1);
  }
}

convertIcon();
