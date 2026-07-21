using QRCoder;
using SkiaSharp;
using System;
using System.IO;
using System.Windows.Media.Imaging;

namespace CampusQrGenerator.Services
{
    public class QrGeneratorService : IQrGeneratorService
    {
        public BitmapSource GenerateQrCode(string content, string logoPath)
        {
            // 1. Generate QR Code bytes using QRCoder
            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.H);
            using var qrCode = new PngByteQRCode(qrCodeData);
            // 50 pixels per module gives a massive, ultra-high-resolution QR code (~1750 x 1750 pixels)
            byte[] qrCodeBytes = qrCode.GetGraphic(50);

            // 2. Decode the QR code image using SkiaSharp (often decoded as Gray8 or Index8 from PngByteQRCode)
            using var skBitmap = SKBitmap.Decode(qrCodeBytes);
            
            // 3. Create a brand new full 32-bit RGBA surface at full resolution (~1750x1750) to ensure high-DPI clarity
            using var fullColorBitmap = new SKBitmap(skBitmap.Width, skBitmap.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
            using var canvas = new SKCanvas(fullColorBitmap);

            // Clear surface with white background
            canvas.Clear(SKColors.White);

            // Draw the standard black and white QR code modules onto our full color canvas
            using var qrPaint = new SKPaint
            {
                IsAntialias = true,
                FilterQuality = SKFilterQuality.High
            };
            canvas.DrawBitmap(skBitmap, new SKRect(0, 0, skBitmap.Width, skBitmap.Height), qrPaint);

            // 4. Load and process the logo at its highest available resolution without low-quality interpolation
            if (File.Exists(logoPath))
            {
                try
                {
                    using var rawLogoBitmap = SKBitmap.Decode(logoPath);
                    if (rawLogoBitmap != null)
                    {
                        // Ensure logo bitmap is in RGBA space to preserve all RGB colors and alpha transparency
                        using var logoBitmap = rawLogoBitmap.ColorType == SKColorType.Rgba8888 || rawLogoBitmap.ColorType == SKColorType.Bgra8888
                            ? rawLogoBitmap
                            : rawLogoBitmap.Copy(SKColorType.Rgba8888);

                        int qrWidth = fullColorBitmap.Width;
                        int qrHeight = fullColorBitmap.Height;

                        // Logo size: 23% of the QR width (within required 20-25% range without affecting readability)
                        int logoSize = (int)(qrWidth * 0.23f);
                        
                        // Center coordinates
                        float centerX = qrWidth / 2f;
                        float centerY = qrHeight / 2f;
                        float halfSize = logoSize / 2f;

                        // Draw white circular background first behind the logo
                        float bgRadius = halfSize + (logoSize * 0.08f); // 8% border
                        using var bgPaint = new SKPaint
                        {
                            Color = SKColors.White,
                            IsAntialias = true,
                            Style = SKPaintStyle.Fill
                        };
                        canvas.DrawCircle(centerX, centerY, bgRadius, bgPaint);

                        // Define destination rectangle for the logo
                        var destRect = new SKRect(centerX - halfSize, centerY - halfSize, centerX + halfSize, centerY + halfSize);
                        
                        // We use a clip path to crop the logo to a circle while preserving exact RGB colors and alpha
                        using var clipPath = new SKPath();
                        clipPath.AddCircle(centerX, centerY, halfSize);
                        
                        canvas.Save();
                        canvas.ClipPath(clipPath, SKClipOperation.Intersect, true);
                        
                        // Draw the full color logo using high-quality cubic/Fant scaling and antialiasing
                        using var paint = new SKPaint
                        {
                            IsAntialias = true,
                            FilterQuality = SKFilterQuality.High,
                            BlendMode = SKBlendMode.SrcOver
                        };
                        canvas.DrawBitmap(logoBitmap, destRect, paint);
                        canvas.Restore();
                    }
                }
                catch
                {
                    // If logo loading or drawing fails, we still return the QR code without the logo
                }
            }

            // 5. Convert full color SKBitmap to WPF BitmapSource
            return ToBitmapSource(fullColorBitmap);
        }

        private BitmapSource ToBitmapSource(SKBitmap bitmap)
        {
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Png, 100);
            using var stream = new MemoryStream();
            data.SaveTo(stream);
            stream.Seek(0, SeekOrigin.Begin);

            var bitmapImage = new BitmapImage();
            bitmapImage.BeginInit();
            bitmapImage.CacheOption = BitmapCacheOption.OnLoad;
            bitmapImage.StreamSource = stream;
            bitmapImage.EndInit();
            bitmapImage.Freeze();
            return bitmapImage;
        }
    }
}
