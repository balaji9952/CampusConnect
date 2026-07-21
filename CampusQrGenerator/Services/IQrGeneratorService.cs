using System.Windows.Media.Imaging;

namespace CampusQrGenerator.Services
{
    public interface IQrGeneratorService
    {
        BitmapSource GenerateQrCode(string content, string logoPath);
    }
}
