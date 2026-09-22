const fs = require('fs');
const path = require('path');
const { PNG } = require('d:/MYtaskAgent/backend/node_modules/pngjs');

const userUploadDir = 'C:/Users/synavos/.gemini/antigravity-ide/brain/c8b2f1fa-7345-4a05-81a8-e365e967e043/.user_uploaded';
const artifactsDir = 'C:/Users/synavos/.gemini/antigravity-ide/brain/c8b2f1fa-7345-4a05-81a8-e365e967e043';
const outDir = 'd:/MYtaskAgent/frontend/public/icons';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Flood fill helper to make background transparent from corners
function removeBackgroundFloodFill(png, isBgColor, feather = 2) {
  const w = png.width;
  const h = png.height;
  const visited = new Uint8Array(w * h);
  const queue = [];

  // Push 4 corners and borders
  for (let x = 0; x < w; x++) {
    queue.push(x, 0);
    queue.push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    queue.push(0, y);
    queue.push(w - 1, y);
  }

  while (queue.length > 0) {
    const cy = queue.pop();
    const cx = queue.pop();
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pIdx = (cy * w + cx) * 4;
    const r = png.data[pIdx];
    const g = png.data[pIdx + 1];
    const b = png.data[pIdx + 2];

    if (isBgColor(r, g, b, cx, cy)) {
      png.data[pIdx + 3] = 0; // Transparent

      // 4-neighbors
      if (cx > 0 && !visited[cy * w + (cx - 1)]) {
        queue.push(cx - 1, cy);
      }
      if (cx < w - 1 && !visited[cy * w + (cx + 1)]) {
        queue.push(cx + 1, cy);
      }
      if (cy > 0 && !visited[(cy - 1) * w + cx]) {
        queue.push(cx, cy - 1);
      }
      if (cy < h - 1 && !visited[(cy + 1) * w + cx]) {
        queue.push(cx, cy + 1);
      }
    }
  }

  // Smooth feathering at border
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const pIdx = (y * w + x) * 4;
      if (png.data[pIdx + 3] > 0) {
        // check if neighbor is transparent
        let transNeighbors = 0;
        if (png.data[(y * w + (x - 1)) * 4 + 3] === 0) transNeighbors++;
        if (png.data[(y * w + (x + 1)) * 4 + 3] === 0) transNeighbors++;
        if (png.data[((y - 1) * w + x) * 4 + 3] === 0) transNeighbors++;
        if (png.data[((y + 1) * w + x) * 4 + 3] === 0) transNeighbors++;

        if (transNeighbors > 0) {
          // slight alpha softening
          png.data[pIdx + 3] = Math.max(120, png.data[pIdx + 3] - transNeighbors * 30);
        }
      }
    }
  }

  return png;
}

// 1. Process Calendar
fs.createReadStream(path.join(userUploadDir, 'media_1788789980982.png'))
  .pipe(new PNG())
  .on('parsed', function () {
    // Background is near-white or light greyish vignette around calendar
    const transparentPng = removeBackgroundFloodFill(this, (r, g, b) => {
      return r > 235 && g > 235 && b > 235;
    });
    transparentPng.pack().pipe(fs.createWriteStream(path.join(outDir, 'calendar.png')));
    console.log('Calendar icon processed.');
  });

// 2. Process Courses
fs.createReadStream(path.join(userUploadDir, 'media_1788790106720.png'))
  .pipe(new PNG())
  .on('parsed', function () {
    // Background is dark (#171717, ~23, 23, 23)
    const transparentPng = removeBackgroundFloodFill(this, (r, g, b) => {
      return r < 35 && g < 35 && b < 35;
    });
    transparentPng.pack().pipe(fs.createWriteStream(path.join(outDir, 'courses.png')));
    console.log('Courses icon processed.');
  });

// 3. Process Settings
fs.createReadStream(path.join(userUploadDir, 'media_1788790171774.png'))
  .pipe(new PNG())
  .on('parsed', function () {
    // Background is dark checkerboard: blacks (0..5) and dark grays (20..50)
    const transparentPng = removeBackgroundFloodFill(this, (r, g, b) => {
      return r < 60 && g < 60 && b < 60;
    });
    transparentPng.pack().pipe(fs.createWriteStream(path.join(outDir, 'settings.png')));
    console.log('Settings icon processed.');
  });

// 4. Process Chatbot
fs.createReadStream(path.join(userUploadDir, 'media_1788790178185.png'))
  .pipe(new PNG())
  .on('parsed', function () {
    // Background is dark checkerboard
    const transparentPng = removeBackgroundFloodFill(this, (r, g, b) => {
      return r < 60 && g < 60 && b < 60;
    });
    transparentPng.pack().pipe(fs.createWriteStream(path.join(outDir, 'chatbot.png')));
    console.log('Chatbot icon processed.');
  });

// Copy raw originals as well as backup
fs.copyFileSync(path.join(userUploadDir, 'media_1788789980982.png'), path.join(outDir, 'calendar_raw.png'));
fs.copyFileSync(path.join(userUploadDir, 'media_1788790106720.png'), path.join(outDir, 'courses_raw.png'));
fs.copyFileSync(path.join(userUploadDir, 'media_1788790171774.png'), path.join(outDir, 'settings_raw.png'));
fs.copyFileSync(path.join(userUploadDir, 'media_1788790178185.png'), path.join(outDir, 'chatbot_raw.png'));
console.log('Raw backups saved.');
