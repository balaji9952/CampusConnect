using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace CampusQrGenerator.Services
{
    public class PrintService : IPrintService
    {
        public void PrintCard(ImageSource cardImage, string qrNumber)
        {
            var printDialog = new PrintDialog();
            if (printDialog.ShowDialog() == true)
            {
                // Create an image control containing the source image
                var image = new Image
                {
                    Source = cardImage,
                    Stretch = Stretch.Uniform,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                    // Keep card print dimensions clean (around 3.5 inches x 5.25 inches)
                    Width = 350,
                    Height = 525
                };
                RenderOptions.SetBitmapScalingMode(image, BitmapScalingMode.HighQuality);

                // Create a container grid to center it
                var printGrid = new Grid();
                printGrid.Children.Add(image);

                // Get page sizes
                double pageWidth = printDialog.PrintableAreaWidth;
                double pageHeight = printDialog.PrintableAreaHeight;

                // Measure and arrange the layout for printer coordinates
                printGrid.Measure(new Size(pageWidth, pageHeight));
                printGrid.Arrange(new Rect(0, 0, pageWidth, pageHeight));

                printDialog.PrintVisual(printGrid, $"Campus QR Card - {qrNumber}");
            }
        }
    }
}
