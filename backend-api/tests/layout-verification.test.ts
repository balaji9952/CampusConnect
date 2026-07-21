'use strict';

import { generateQrCard } from '../src/utils/qr-generator';
import { LAYOUT_SPEC_V1 } from '../src/config/layout-spec';
import { Jimp, diff } from 'jimp';
import * as path from 'path';
import * as fs from 'fs';

async function runTests() {
  console.log('--- STARTING LAYOUT VERIFICATION TESTS ---');
  try {
    const testPayload = 'http://localhost:3030/scan/QR-1000';
    const testFilename = 'verify_test_card';
    const fixtureDir = path.join(__dirname, 'fixtures');
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    const goldenPath = path.join(fixtureDir, 'golden_card.png');

    console.log('[Test 1] Generating Preview Card (96 DPI Target)...');
    const previewResult = await generateQrCard({
      payload: testPayload,
      filename: testFilename,
      locationName: 'Toilet',
      floor: 'Ground Floor',
      qrNumber: 'QR-1000',
      spec: LAYOUT_SPEC_V1,
      target: { dpi: 96 }
    });

    const previewImg = await Jimp.read(previewResult.filePath);
    console.log(`- Dimensions: ${previewImg.bitmap.width}x${previewImg.bitmap.height}`);
    
    // Assert dimensions for 1x scale
    if (previewImg.bitmap.width !== 380 || previewImg.bitmap.height !== 570) {
      throw new Error(`FAIL: Preview card size mismatch. Expected 380x570, got ${previewImg.bitmap.width}x${previewImg.bitmap.height}`);
    }
    console.log('- [Assert] 380x570 dimensions match.');

    // Assert key anchor pixel points (Bottom bar color check at logical X=50, Y=520)
    const bottomBarPixel = previewImg.getPixelColor(50, 520);
    // #F8F9FA translated: R=248, G=249, B=250.
    const r = (bottomBarPixel >> 24) & 0xff;
    const g = (bottomBarPixel >> 16) & 0xff;
    const b = (bottomBarPixel >> 8) & 0xff;
    if (r !== 248 || g !== 249 || b !== 250) {
      throw new Error(`FAIL: Bottom bar color anchor mismatch. Expected #F8F9FA (248,249,250), got (${r},${g},${b})`);
    }
    console.log('- [Assert] Anchor colors are correct.');

    console.log('[Test 2] Generating High-Resolution Card (600 DPI Target)...');
    const highResResult = await generateQrCard({
      payload: testPayload,
      filename: `${testFilename}_highres`,
      locationName: 'Toilet',
      floor: 'Ground Floor',
      qrNumber: 'QR-1000',
      spec: LAYOUT_SPEC_V1,
      target: { dpi: 600 }
    });

    const highResImg = await Jimp.read(highResResult.filePath);
    console.log(`- Dimensions: ${highResImg.bitmap.width}x${highResImg.bitmap.height}`);
    
    // Assert dimensions for 6.25x scale (380 * 6.25 = 2375, 570 * 6.25 = 3562.5 -> rounded to 3563)
    if (highResImg.bitmap.width !== 2375 || highResImg.bitmap.height !== 3563) {
      throw new Error(`FAIL: High-Res card size mismatch. Expected 2375x3563, got ${highResImg.bitmap.width}x${highResImg.bitmap.height}`);
    }
    console.log('- [Assert] 2375x3563 High-DPI dimensions match.');

    // Golden Image Diff Verification
    if (!fs.existsSync(goldenPath)) {
      console.log(`- No baseline golden card found. Saving current rendering as golden baseline: ${goldenPath}`);
      fs.copyFileSync(previewResult.filePath, goldenPath);
    } else {
      console.log('- Baseline golden card found. Comparing pixel parity...');
      const goldenImg = await Jimp.read(goldenPath);
      
      // Perform pixel-by-pixel jimp diff comparison
      const difference = diff(previewImg, goldenImg);
      console.log(`- Diff Variance Percentage: ${(difference.percent * 100).toFixed(4)}%`);
      if (difference.percent > 0.005) { // Allow less than 0.5% drift
        throw new Error(`FAIL: Golden card visual diff mismatch! Variance is ${(difference.percent * 100).toFixed(4)}%`);
      }
      console.log('- [Assert] Visual diff passes within safe tolerance (<0.5%).');
    }

    console.log('--- ALL LAYOUT VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('LAYOUT TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
