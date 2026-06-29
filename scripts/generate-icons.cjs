/**
 * SmartLex Icon Generator
 * 生成 PNG 图标（16/48/128 px），纯 Node.js 无外部依赖
 * 使用：node scripts/generate-icons.cjs
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'extension', 'icons');

// -- 颜色 --
const BG = [0x63, 0x66, 0xf1, 0xff]; // Indigo-500
const WHITE = [0xff, 0xff, 0xff, 0xff];

/** 创建 RGBA 像素缓冲 */
function createBuffer(w, h) {
  return Buffer.alloc(w * h * 4, 0);
}

/** 填充整个图像为背景色 */
function fillRect(buf, w, _h, x, y, rw, rh, color) {
  for (let py = y; py < y + rh && py < _h; py++) {
    for (let px = x; px < x + rw && px < w; px++) {
      const i = (py * w + px) * 4;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = color[3];
    }
  }
}

/** 填充圆角矩形 */
function fillRoundedRect(buf, w, h, x, y, rw, rh, r, color) {
  for (let py = y; py < y + rh && py < h; py++) {
    for (let px = x; px < x + rw && px < w; px++) {
      // 圆角裁剪
      let inside = true;
      if (px < x + r && py < y + r) {
        const dx = x + r - px, dy = y + r - py;
        inside = dx * dx + dy * dy <= r * r;
      } else if (px >= x + rw - r && py < y + r) {
        const dx = px - (x + rw - r), dy = y + r - py;
        inside = dx * dx + dy * dy <= r * r;
      } else if (px < x + r && py >= y + rh - r) {
        const dx = x + r - px, dy = py - (y + rh - r);
        inside = dx * dx + dy * dy <= r * r;
      } else if (px >= x + rw - r && py >= y + rh - r) {
        const dx = px - (x + rw - r), dy = py - (y + rh - r);
        inside = dx * dx + dy * dy <= r * r;
      }
      if (inside) {
        const i = (py * w + px) * 4;
        buf[i] = color[0];
        buf[i + 1] = color[1];
        buf[i + 2] = color[2];
        buf[i + 3] = color[3];
      }
    }
  }
}

/** 绘制简单的 "SL" 文字（像素字体） */
function drawText(buf, w, _h, text, cx, cy, size, color) {
  const LETTERS = {
    S: [
      [2, 1, 6], [1, 1, 2], [1, 3, 2], [2, 5, 6], [6, 6, 2], [6, 8, 2], [2, 9, 6],
    ],
    L: [
      [1, 1, 2], [1, 1, 9], [1, 9, 6],
    ],
  };

  const chars = text.split('');
  let offsetX = cx - chars.length * size * 2;

  for (const ch of chars) {
    const glyph = LETTERS[ch];
    if (!glyph) continue;
    for (const [row, colStart, colEnd] of glyph) {
      const py = Math.round(cy - size * 4.5 + row / 10 * size * 10);
      const px1 = Math.round(offsetX + (colStart / 10) * size * 10);
      const px2 = Math.round(offsetX + (colEnd / 10) * size * 10);
      for (let px = px1; px < px2 && px < w; px++) {
        for (let dy = 0; dy < Math.max(1, size / 4); dy++) {
          const i = ((py + dy) * w + px) * 4;
          if (i >= 0 && i < buf.length) {
            buf[i] = color[0];
            buf[i + 1] = color[1];
            buf[i + 2] = color[2];
            buf[i + 3] = color[3];
          }
        }
      }
    }
    offsetX += size * 8;
  }
}

/** 编码为 PNG 并保存 */
function savePNG(buf, w, h, filepath) {
  // 为每行添加 filter byte (0)
  const rawData = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    rawData[y * (1 + w * 4)] = 0; // filter: none
    buf.copy(rawData, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR 块
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // 位深
  ihdr[9] = 6;  // 颜色类型 6 = RGBA
  ihdr[10] = 0; // 压缩
  ihdr[11] = 0; // 滤波
  ihdr[12] = 0; // 隔行
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT 块
  const idatChunk = createChunk('IDAT', deflated);

  // IEND 块
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
  fs.writeFileSync(filepath, png);
  console.log(`  ✔ ${path.basename(filepath)} (${w}x${h})`);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeB, data]);
  const crc = crc32(crcData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);  // >>> 0 converts to unsigned
  return Buffer.concat([len, typeB, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ============================================================
// 生成图标
// ============================================================

function generateIcon(size) {
  const buf = createBuffer(size, size);
  const r = Math.round(size * 0.19); // 圆角半径 ~19%

  // 圆角靛蓝背景
  fillRoundedRect(buf, size, size, 0, 0, size, size, r, BG);

  // 中央 白色 "SL" 文字
  drawText(buf, size, size, 'SL', size / 2, size / 2, size / 18, WHITE);

  return buf;
}

// 生成 16/48/128
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

[16, 48, 128].forEach((s) => {
  const buf = generateIcon(s);
  savePNG(buf, s, s, path.join(OUT_DIR, `icon-${s}.png`));
});

console.log('\n✅ Icons generated in extension/icons/');
