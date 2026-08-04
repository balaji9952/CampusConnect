'use strict';

import * as path from 'path';
import * as fs from 'fs';
import * as QRCode from 'qrcode';
import { Jimp, BlendMode, ResizeStrategy, loadFont, HorizontalAlign } from 'jimp';
import { LAYOUT_SPEC_V1 } from '../config/layout-spec';

// ─── Config ────────────────────────────────────────────────────────────────────

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'qrcodes');
const COLLEGE_LOGO_URL = process.env['COLLEGE_LOGO_URL'] ?? '';
const QR_BASE_URL = process.env['QR_IMAGE_BASE_URL'] ?? '';

let _cachedLogo: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── PNG DPI Patching ──────────────────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[i] = c;
}

function calculateCrc32(buffer: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function patchPngDpi(filePath: string, dpi: number) {
  try {
    const pngBuffer = fs.readFileSync(filePath);
    if (pngBuffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return;
    
    let offset = 8;
    while (offset < pngBuffer.length) {
      const length = pngBuffer.readUInt32BE(offset);
      const type = pngBuffer.toString('ascii', offset + 4, offset + 8);
      if (type === 'pHYs') return;
      if (type === 'IDAT') break;
      offset += 8 + length + 4;
    }

    const ppm = Math.round(dpi / 0.0254);
    const physChunk = Buffer.alloc(21);
    physChunk.writeUInt32BE(9, 0);
    physChunk.write('pHYs', 4);
    physChunk.writeUInt32BE(ppm, 8);
    physChunk.writeUInt32BE(ppm, 12);
    physChunk.writeUInt8(1, 16);
    
    const crc = calculateCrc32(physChunk.subarray(4, 17));
    physChunk.writeUInt32BE(crc, 17);

    const before = pngBuffer.subarray(0, 33);
    const after = pngBuffer.subarray(33);
    fs.writeFileSync(filePath, Buffer.concat([before, physChunk, after]));
  } catch (err) {
    console.error('Failed to patch PNG DPI', err);
  }
}

// ─── Logo Fetching ─────────────────────────────────────────────────────────────

async function fetchCollegeLogo(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (_cachedLogo) return _cachedLogo;

  if (!COLLEGE_LOGO_URL) {
    console.warn('[qr-generator] COLLEGE_LOGO_URL not set — generating QR without logo.');
    _cachedLogo = new Jimp({ width: 1, height: 1, color: 0x00000000 });
    return _cachedLogo;
  }

  let logoBuffer: Buffer;

  if (COLLEGE_LOGO_URL.startsWith('file://')) {
    const rawPath = COLLEGE_LOGO_URL.replace(/^file:\/\//, '');
    let resolvedPath = path.resolve(rawPath);
    if (!path.isAbsolute(rawPath)) {
      resolvedPath = path.resolve(__dirname, '..', '..', rawPath);
    }
    const filePath = resolvedPath.replace(/\//g, path.sep);
    logoBuffer = fs.readFileSync(filePath);
  } else {
    try {
      logoBuffer = await fetch(COLLEGE_LOGO_URL)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer() as Promise<ArrayBuffer>;
        })
        .then(ab => Buffer.from(ab));
    } catch (err) {
      console.warn('[qr-generator] Failed to fetch college logo — generating QR without logo:', err);
      _cachedLogo = new Jimp({ width: 1, height: 1, color: 0x00000000 });
      return _cachedLogo;
    }
  }

  try {
    const logo: any = await Jimp.read(logoBuffer); // eslint-disable-line @typescript-eslint/no-explicit-any
    _cachedLogo = logo;
  } catch (err) {
    console.warn('[qr-generator] Failed to process college logo — generating QR without logo:', err);
    _cachedLogo = new Jimp({ width: 1, height: 1, color: 0x00000000 });
  }

  return _cachedLogo;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function hexToJimpColor(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return ((r << 24) | (g << 16) | (b << 8) | 0xFF) >>> 0;
}

function getBestFontPath(logicalSize: number, scale: number): string {
  const targetSize = logicalSize * scale;
  const availableSizes = [8, 10, 12, 14, 16, 32, 64, 128];
  
  let closest = availableSizes[0];
  let minDiff = Math.abs(targetSize - closest);
  for (const size of availableSizes) {
    const diff = Math.abs(targetSize - size);
    if (diff < minDiff) {
      minDiff = diff;
      closest = size;
    }
  }
  
  const fontName = `open-sans-${closest}-black`;
  return path.join(__dirname, '..', '..', 'node_modules', '@jimp', 'plugin-print', 'fonts', 'open-sans', fontName, `${fontName}.fnt`);
}

// ─── Core Generator ───────────────────────────────────────────────────────────

export interface QrImageResult {
  filePath: string;
  imageUrl: string;
}

export interface RenderTarget {
  width?: number;
  height?: number;
  dpi: number;
}

/**
 * Generates a full visual card image (PNG) dynamically scaled relative to target DPI.
 */
export async function generateQrCard(params: {
  payload: string;
  filename: string;
  locationName: string;
  floor: string;
  qrNumber: string;
  spec: typeof LAYOUT_SPEC_V1;
  target: RenderTarget;
}): Promise<QrImageResult> {
  const { payload, filename, spec, target } = params;
  const outPath = path.join(UPLOADS_DIR, `${filename}.png`);

  // Cap DPI to 200 max to prevent RAM exhaustion on Render (512MB RAM limit)
  const safeDpi = Math.min(target?.dpi || 150, 200);

  // Target physical dimensions in inches based on Canva layout
  const widthInches = 6.27;
  const heightInches = 6.15;
  const canvasWidth = Math.round(widthInches * safeDpi);
  const canvasHeight = Math.round(heightInches * safeDpi);

  // QR is square, use the smaller dimension (height) to prevent cropping
  const qrSize = Math.min(canvasWidth, canvasHeight);

  // 1. Create fully transparent canvas so it drops cleanly into Canva
  const card = new Jimp({ width: canvasWidth, height: canvasHeight, color: 0x00000000 });

  // 2. Generate QR code
  const qrBuffer = await QRCode.toBuffer(payload, {
    width: qrSize,
    margin: 0, // Remove margins since we center it in the canvas
    errorCorrectionLevel: 'H',
    color: {
      dark:  '#101054',
      light: '#FFFFFF', // Keep white background behind QR code for scan reliability
    },
  });
  const qr: any = await Jimp.read(qrBuffer);

  // 3. Dynamic Circular Logo overlay on QR center
  const logoBoxSize = Math.round(qr.bitmap.width * spec.logoRatio);
  // The logo image itself will be 82% of the white box size to leave an 18% white margin
  const logoDrawSize = Math.round(logoBoxSize * 0.82);

  let rawLogo = await fetchCollegeLogo();
  if (rawLogo && rawLogo.bitmap.width > 1) {
    // scaleToFit/contain preserves aspect ratio so the logo isn't squished
    let logo = rawLogo.clone().contain({ w: logoDrawSize, h: logoDrawSize, mode: ResizeStrategy.BILINEAR });
    
    // Circular crop the logo image itself with antialiasing
    const radius = logoDrawSize / 2;
    for (let x = 0; x < logoDrawSize; x++) {
      for (let y = 0; y < logoDrawSize; y++) {
        const dx = x - radius + 0.5;
        const dy = y - radius + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) {
          logo.setPixelColor(0x00000000, x, y);
        } else if (dist > radius - 1.0) {
          const alpha = Math.round((1.0 - (dist - (radius - 1.0))) * 255);
          const currentHex = logo.getPixelColor(x, y);
          const existingAlpha = (currentHex >> 24) & 0xff;
          const b = (currentHex >> 16) & 0xff;
          const g = (currentHex >> 8) & 0xff;
          const r = currentHex & 0xff;
          const blendedAlpha = Math.round(existingAlpha * (1 - alpha / 255));
          const newHex = (((blendedAlpha << 24) | (b << 16) | (g << 8) | r) >>> 0);
          logo.setPixelColor(newHex, x, y);
        }
      }
    }

    // Draw the perfect white circular margin on the QR code
    const qrWidth = qr.bitmap.width;
    const qrHeight = qr.bitmap.height;
    const centerX = qrWidth / 2;
    const centerY = qrHeight / 2;
    const bgRadius = Math.ceil(logoBoxSize / 2);
    const bgRadiusSq = bgRadius * bgRadius;

    for (let x = Math.max(0, Math.floor(centerX - bgRadius)); x < Math.min(qrWidth, Math.ceil(centerX + bgRadius)); x++) {
      for (let y = Math.max(0, Math.floor(centerY - bgRadius)); y < Math.min(qrHeight, Math.ceil(centerY + bgRadius)); y++) {
        const dx = x - centerX + 0.5;
        const dy = y - centerY + 0.5;
        const distSq = dx * dx + dy * dy;
        if (distSq <= bgRadiusSq) {
          const dist = Math.sqrt(distSq);
          if (dist > bgRadius - 1) {
            const alpha = 1.0 - (dist - (bgRadius - 1));
            const currentHex = qr.getPixelColor(x, y);
            const existingAlpha = (currentHex >> 24) & 0xff;
            const b = (currentHex >> 16) & 0xff;
            const g = (currentHex >> 8) & 0xff;
            const r = currentHex & 0xff;
            const outA = Math.round(existingAlpha * (1 - alpha) + 255 * alpha);
            const newHex = (((outA << 24) | (b << 16) | (g << 8) | r) >>> 0);
            qr.setPixelColor(newHex, x, y);
          } else {
            qr.setPixelColor(0xFFFFFFFF, x, y);
          }
        }
      }
    }

    // Composite logo in the absolute center
    const logoX = Math.floor(centerX - logoDrawSize / 2);
    const logoY = Math.floor(centerY - logoDrawSize / 2);
    qr.composite(logo, logoX, logoY, {
      mode: BlendMode.SRC_OVER,
      opacitySource: 1,
      opacityDest: 1
    });
  }

  // 4. Center QR in canvas
  const qrX = Math.round((canvasWidth - qrSize) / 2);
  const qrY = Math.round((canvasHeight - qrSize) / 2);
  card.composite(qr, qrX, qrY);

  // 5. Write finished card image to disk
  await (card as any).write(outPath);
  
  // 5.1 Inject pHYs chunk so Canva reads the exact physical dimension
  if (target?.dpi) {
    patchPngDpi(outPath, target.dpi);
  }

  // 6. Build relative public URL
  const imageUrl = QR_BASE_URL
    ? `${QR_BASE_URL}/${filename}.png`
    : `/uploads/qrcodes/${filename}.png`;

  return { filePath: outPath, imageUrl };
}

/**
 * Backward compatibility wrapper
 */
export async function generateQrWithLogo(payload: string, filename: string): Promise<QrImageResult> {
  return generateQrCard({
    payload,
    filename,
    locationName: 'Campus Connect',
    floor: '',
    qrNumber: filename,
    spec: LAYOUT_SPEC_V1,
    target: { dpi: 96 }
  });
}

export function generateQrUrl(payload: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`;
}
