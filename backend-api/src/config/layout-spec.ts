'use strict';

export const LAYOUT_SPEC_V1 = {
  version: 1,
  
  // Logical Canvas boundaries
  cardWidth: 380,
  cardHeight: 570,
  padding: 28,
  
  // Spacing between elements
  elementSpacing: 18,
  textLineSpacing: 6,
  
  // Sizing
  qrBoxSize: 240,
  qrBoxPadding: 12,
  qrImageSize: 216, // qrBoxSize - (2 * qrBoxPadding)
  logoRatio: 0.28,  // Logo width is 28% of QR width
  logoBackingRatio: 0.55, // Backing circle radius = logoSize * 0.55 (creates a white margin around the logo)
  
  // Styling
  qrBoxBackground: '#F8F9FA',
  qrBoxBorder: '#E8EAED',
  qrBoxCornerRadius: 12,
  textColor: '#202124',
  textSecondaryColor: '#5F6368',
  bottomBarBackground: '#F8F9FA',
  bottomBarBorder: '#E8EAED',
  bottomBarCornerRadius: 8,
  
  // Bottom Bar Sizing
  bottomBarHeight: 40,
  bottomBarPaddingX: 12,
  bottomBarPaddingY: 10,
  
  // Typography sizes
  nameFontSize: 22,
  floorFontSize: 14,
};
