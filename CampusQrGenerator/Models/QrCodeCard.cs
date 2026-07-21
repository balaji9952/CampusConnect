using System;

namespace CampusQrGenerator.Models
{
    public class QrCodeCard
    {
        public string QrNumber { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public string Block { get; set; } = string.Empty;
        public string Floor { get; set; } = string.Empty;
        public string EncodedUrl { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;

        public string DisplayText =>
            string.IsNullOrWhiteSpace(Floor)
                ? $"{QrNumber} - {Location}"
                : $"{QrNumber} - {Location} ({Floor})";
    }
}
