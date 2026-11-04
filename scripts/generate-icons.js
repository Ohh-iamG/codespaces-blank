import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG generator using Node's built-in zlib
function createPng(width, height, drawPixelFn) {
  // RGBA buffer: (width * 4 + 1) * height
  const stride = width * 4 + 1;
  const rawData = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0; // Filter type 0: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // Helper for CRC32
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(typeStr, data) {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const len = data.length;
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(len, 0);

    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Ensure public directory exists
const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Drawing IZA Sovereign Glyph
// Center: emerald / cyan glowing hex/trinity glyph on deep slate #0f172a background
function drawIzaIcon(isMaskable) {
  return (x, y, w, h) => {
    // Normalised [-1, 1]
    const nx = (x - w / 2) / (w / 2);
    const ny = (y - h / 2) / (h / 2);
    const dist = Math.sqrt(nx * nx + ny * ny);

    // Deep slate bg: #0f172a = [15, 23, 42]
    // Border gradient: emerald #10b981 to cyan #06b6d4
    let r = 15, g = 23, b = 42, a = 255;

    // Outer glow for non-maskable / icon
    if (!isMaskable && dist > 0.95) {
      return [0, 0, 0, 0]; // Transparent outside circle for 'any'
    }

    // Outer circular boundary ring
    if (dist >= 0.78 && dist <= 0.84) {
      const t = (nx + 1) / 2; // gradient across
      r = Math.round(16 + t * (6 - 16));
      g = Math.round(185 + t * (182 - 185));
      b = Math.round(129 + t * (212 - 129));
      return [r, g, b, 255];
    }

    // Inner subtle radial highlight
    if (dist < 0.75) {
      const glow = Math.max(0, 1 - dist / 0.75);
      r = Math.min(255, Math.round(15 + glow * 25));
      g = Math.min(255, Math.round(23 + glow * 45));
      b = Math.min(255, Math.round(42 + glow * 65));
    }

    // Triangular/Hex Sovereign Emblem
    // Check if within stylized "I Z A" or Trinity nodes:
    // 3 Nodes at angles: -90 deg (top), 30 deg (bottom right), 150 deg (bottom left)
    const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    const nodeRadius = 0.48;

    for (const angle of angles) {
      const ncx = Math.cos(angle) * nodeRadius;
      const ncy = Math.sin(angle) * nodeRadius;
      const dNode = Math.hypot(nx - ncx, ny - ncy);

      if (dNode < 0.16) {
        // Glowing orbital node
        const glow = 1 - dNode / 0.16;
        return [
          Math.round(52 + glow * 10),
          Math.round(211 + glow * 44),
          Math.round(153 + glow * 50),
          255
        ];
      }
    }

    // Connective laser spokes between nodes
    for (let i = 0; i < 3; i++) {
      const a1 = angles[i];
      const a2 = angles[(i + 1) % 3];
      const x1 = Math.cos(a1) * nodeRadius;
      const y1 = Math.sin(a1) * nodeRadius;
      const x2 = Math.cos(a2) * nodeRadius;
      const y2 = Math.sin(a2) * nodeRadius;

      // Distance to segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      let t = ((nx - x1) * dx + (ny - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projY = y1 + t * dy;
      const dSeg = Math.hypot(nx - projX, ny - projY);

      if (dSeg < 0.04) {
        return [16, 185, 129, 230]; // Emerald line
      }
    }

    // Center Core: "I" core
    if (Math.abs(nx) < 0.06 && Math.abs(ny) < 0.22) {
      return [6, 182, 212, 255]; // Cyan core bar
    }

    // Center Top & Bottom caps
    if (Math.abs(nx) < 0.14 && (Math.abs(ny - 0.22) < 0.04 || Math.abs(ny + 0.22) < 0.04)) {
      return [52, 211, 153, 255];
    }

    return [r, g, b, a];
  };
}

// Generate PNGs
const p192 = createPng(192, 192, drawIzaIcon(false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), p192);

const p512 = createPng(512, 512, drawIzaIcon(false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), p512);

const pMaskable = createPng(512, 512, drawIzaIcon(true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pMaskable);

const appleIcon = createPng(180, 180, drawIzaIcon(true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

// Also generate SVG favicon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="24" fill="#0f172a" />
  <circle cx="50" cy="50" r="38" stroke="#10b981" stroke-width="3" stroke-dasharray="4 2" />
  <circle cx="50" cy="24" r="8" fill="#10b981" />
  <circle cx="73" cy="63" r="8" fill="#06b6d4" />
  <circle cx="27" cy="63" r="8" fill="#10b981" />
  <line x1="50" y1="24" x2="73" y2="63" stroke="#10b981" stroke-width="2" />
  <line x1="73" y1="63" x2="27" y2="63" stroke="#06b6d4" stroke-width="2" />
  <line x1="27" y1="63" x2="50" y2="24" stroke="#10b981" stroke-width="2" />
  <circle cx="50" cy="50" r="5" fill="#38bdf8" />
</svg>`;
fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), appleIcon);

console.log('Successfully generated PWA icon assets: pwa-192x192.png, pwa-512x512.png, pwa-maskable-512x512.png, apple-touch-icon.png, icon.svg, favicon.ico');
