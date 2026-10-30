import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const casesDir = path.resolve('public/img/cases');
const imgDir = path.resolve('public/img');

async function convertDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
      const base = path.basename(file, ext);
      const inputPath = path.join(dir, file);
      const outputPath = path.join(dir, `${base}.webp`);
      
      await sharp(inputPath)
        .webp({ quality: 85 })
        .toFile(outputPath);
      
      const statBefore = fs.statSync(inputPath).size;
      const statAfter = fs.statSync(outputPath).size;
      console.log(`Converted ${file}: ${Math.round(statBefore/1024)}KB -> ${Math.round(statAfter/1024)}KB`);
    }
  }
}

await convertDir(imgDir);
await convertDir(casesDir);
console.log('WebP conversion completed!');
