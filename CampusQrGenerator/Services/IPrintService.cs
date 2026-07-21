using System.Windows.Media;

namespace CampusQrGenerator.Services
{
    public interface IPrintService
    {
        void PrintCard(ImageSource cardImage, string qrNumber);
    }
}
