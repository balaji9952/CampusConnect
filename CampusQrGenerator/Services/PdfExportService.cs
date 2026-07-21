using PdfSharp.Drawing;
using PdfSharp.Pdf;
using System;
using System.IO;

namespace CampusQrGenerator.Services
{
    public class PdfExportService : IPdfExportService
    {
        public void ExportToPdf(string cardImagePath, string pdfOutputPath)
        {
            if (!File.Exists(cardImagePath))
            {
                throw new FileNotFoundException("Card image file not found.", cardImagePath);
            }

            using var document = new PdfDocument();
            document.Info.Title = "Campus QR Identification";
            document.Info.Author = "Mount Zion College of Engineering and Technology";

            var page = document.AddPage();
            page.Size = PdfSharp.PageSize.A4;

            using var gfx = XGraphics.FromPdfPage(page);
            using var image = XImage.FromFile(cardImagePath);

            // A4 is 595 x 842 points.
            // Target size for the card on A4: 350 x 525 points (approx 4.8" x 7.3")
            double cardWidth = 350;
            double cardHeight = 525;

            // Center coordinates
            double x = (page.Width.Point - cardWidth) / 2;
            double y = (page.Height.Point - cardHeight) / 2;

            gfx.DrawImage(image, x, y, cardWidth, cardHeight);
            
            document.Save(pdfOutputPath);
        }
    }
}
