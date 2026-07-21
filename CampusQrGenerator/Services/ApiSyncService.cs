using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;

namespace CampusQrGenerator.Services
{
    public interface IApiSyncService
    {
        string LocalUrl { get; set; }
        string NgrokUrl { get; set; }
        string SelectedUrl { get; set; }
        string ActiveUrl { get; }
        string ConnectionStatusText { get; }
        bool IsOffline { get; }
        int PendingSyncCount { get; }

        void LoadSettings();
        void SaveSettings(string localUrl, string ngrokUrl);
        Task CheckConnectivityAsync();
        Task<bool> SubmitQrCodeAsync(
            string qrNumber, 
            string location, 
            string? block, 
            string floor, 
            string qrValue, 
            string pngPath, 
            string pdfPath,
            string internalCode,
            string category,
            string department,
            string status,
            string routingType,
            string qrImageBase64
        );
        Task SyncPendingQrsAsync();
    }

    public class ApiSyncService : IApiSyncService
    {
        private readonly IApiService _apiService;
        private readonly string _pendingFilePath;

        public string LocalUrl
        {
            get => _apiService.LocalUrl;
            set => _apiService.LocalUrl = value;
        }

        public string NgrokUrl
        {
            get => _apiService.NgrokUrl;
            set => _apiService.NgrokUrl = value;
        }

        public string SelectedUrl
        {
            get => _apiService.SelectedUrl;
            set => _apiService.SelectedUrl = value;
        }

        public string ActiveUrl => _apiService.ActiveUrl;
        public string ConnectionStatusText => _apiService.ConnectionStatusText;
        public bool IsOffline => _apiService.IsOffline;

        public int PendingSyncCount
        {
            get
            {
                var list = LoadPendingQrs();
                return list.Count;
            }
        }

        public ApiSyncService(IApiService apiService)
        {
            _apiService = apiService;
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            _pendingFilePath = Path.Combine(baseDir, "pending_qrcodes.json");
        }

        public void LoadSettings()
        {
            _apiService.LoadSettings();
        }

        public void SaveSettings(string localUrl, string ngrokUrl)
        {
            _apiService.SaveSettings(localUrl, ngrokUrl);
        }

        public async Task CheckConnectivityAsync()
        {
            await _apiService.CheckServerAsync();
        }

        public async Task<bool> SubmitQrCodeAsync(
            string qrNumber, 
            string location, 
            string? block, 
            string floor, 
            string qrValue, 
            string pngPath, 
            string pdfPath,
            string internalCode,
            string category,
            string department,
            string status,
            string routingType,
            string qrImageBase64
        )
        {
            MessageBox.Show("SubmitQrCodeAsync Entered");
            var payload = new QrCodePayload
            {
                qrNumber = qrNumber,
                location = location,
                block = block,
                floor = floor,
                qrValue = qrValue,
                pngPath = pngPath,
                pdfPath = pdfPath,
                internalCode = internalCode,
                category = category,
                department = department,
                status = status,
                routingType = routingType,
                qrImageBase64 = qrImageBase64
            };

            MessageBox.Show("Calling CreateQrAsync");
            var res = await _apiService.CreateQrAsync(payload);
            if (res.Success)
            {
                return true;
            }
            else
            {
                CachePendingQr(payload);
                return false;
            }
        }

        public async Task SyncPendingQrsAsync()
        {
            var pending = LoadPendingQrs();
            if (pending.Count == 0) return;

            await _apiService.CheckServerAsync();
            if (_apiService.IsOffline) return;

            var remaining = new List<QrCodePayload>();
            foreach (var payload in pending)
            {
                var res = await _apiService.CreateQrAsync(payload);
                if (!res.Success)
                {
                    remaining.Add(payload);
                }
            }

            WritePendingQrs(remaining);
        }

        private List<QrCodePayload> LoadPendingQrs()
        {
            try
            {
                if (File.Exists(_pendingFilePath))
                {
                    string json = File.ReadAllText(_pendingFilePath);
                    return JsonSerializer.Deserialize<List<QrCodePayload>>(json) ?? new List<QrCodePayload>();
                }
            }
            catch
            {
            }
            return new List<QrCodePayload>();
        }

        private void CachePendingQr(QrCodePayload payload)
        {
            var list = LoadPendingQrs();
            list.RemoveAll(q => q.qrNumber.Equals(payload.qrNumber, StringComparison.OrdinalIgnoreCase));
            list.Add(payload);
            WritePendingQrs(list);
        }

        private void WritePendingQrs(List<QrCodePayload> list)
        {
            try
            {
                if (list.Count == 0)
                {
                    if (File.Exists(_pendingFilePath)) File.Delete(_pendingFilePath);
                }
                else
                {
                    string json = JsonSerializer.Serialize(list, new JsonSerializerOptions { WriteIndented = true });
                    File.WriteAllText(_pendingFilePath, json);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to write pending QRs: {ex.Message}");
            }
        }
    }
}
