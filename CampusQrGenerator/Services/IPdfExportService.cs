namespace CampusQrGenerator.Services
{
    public interface IPdfExportService
    {
        void ExportToPdf(string cardImagePath, string pdfOutputPath);
    }
}
