using CampusQrGenerator.Services;
using CampusQrGenerator.ViewModels;
using System.Windows;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace CampusQrGenerator.Views
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();

            var qrService = new QrGeneratorService();
            var pdfService = new PdfExportService();
            var printService = new PrintService();
            var httpClientFactory = new HttpClientFactory();
            var apiService = new ApiService(httpClientFactory);
            var apiSyncService = new ApiSyncService(apiService);

            var viewModel = new MainViewModel(qrService, pdfService, printService, apiSyncService);
            DataContext = viewModel;

            // Hook up the high-DPI card drawing function to the view model
            viewModel.RenderCardDelegate = RenderCardVisual;
        }

        private BitmapSource? RenderCardVisual()
        {
            if (CardVisualBorder == null) return null;

            // 1. Make sure layout is up to date and obtain ActualWidth and ActualHeight
            CardVisualBorder.UpdateLayout();
            double width = CardVisualBorder.ActualWidth;
            double height = CardVisualBorder.ActualHeight;

            if (width <= 0 || height <= 0)
            {
                width = 380;
                height = 570;
            }

            // 2. Measure and Arrange before rendering
            var size = new Size(width, height);
            CardVisualBorder.Measure(size);
            CardVisualBorder.Arrange(new Rect(size));
            CardVisualBorder.UpdateLayout();

            // 3. Render using RenderTargetBitmap at 600 DPI (6.25x scaling from 96 logical DPI) for high-resolution printing & export
            double dpi = 600.0;
            double scale = dpi / 96.0;
            int renderWidth = (int)Math.Ceiling(width * scale);
            int renderHeight = (int)Math.Ceiling(height * scale);

            var renderBitmap = new RenderTargetBitmap(
                renderWidth,
                renderHeight,
                dpi,
                dpi,
                PixelFormats.Pbgra32);

            // 4. Capture the entire CardVisualBorder cleanly without double scaling
            var drawingVisual = new DrawingVisual();
            using (var context = drawingVisual.RenderOpen())
            {
                var brush = new VisualBrush(CardVisualBorder)
                {
                    Stretch = Stretch.None
                };
                RenderOptions.SetBitmapScalingMode(brush, BitmapScalingMode.HighQuality);
                
                // Because RenderTargetBitmap has dpi=600, drawing logical rectangle (0,0,width,height) exactly fills the physical bitmap (renderWidth,renderHeight)
                context.DrawRectangle(brush, null, new Rect(0, 0, width, height));
            }

            renderBitmap.Render(drawingVisual);

            // Restore UI measurement state cleanly
            CardVisualBorder.Measure(size);
            CardVisualBorder.Arrange(new Rect(size));
            CardVisualBorder.UpdateLayout();

            return renderBitmap;
        }
    }
}
