import sharp from 'sharp';
import fs from 'fs';

async function convertIcon() {
  try {
    if (fs.existsSync('public/flick_pwa_logo.jpg')) {
      await sharp('public/flick_pwa_logo.jpg')
        .resize(512, 512)
        .png({ compressionLevel: 9 })
        .toFile('public/icon.png.tmp');
      
      fs.renameSync('public/icon.png.tmp', 'public/icon.png');
      console.log('✓ Icon converted to 512x512 PNG successfully.');
    } else {
      console.error('⚠️ Source JPG icon (public/flick_pwa_logo.jpg) not found.');
    }
  } catch (err) {
    console.error('❌ Failed to convert icon:', err);
  }
}

convertIcon();
