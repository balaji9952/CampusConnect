using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;

namespace CampusQrGenerator.Services
{
    public interface IHttpClientFactory
    {
        HttpClient CreateClient();
    }

    public class HttpClientFactory : IHttpClientFactory
    {
        public HttpClient CreateClient()
        {
            return new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        }
    }

    public interface IApiService
    {
        string LocalUrl { get; set; }
        string NgrokUrl { get; set; }
        string SelectedUrl { get; set; }
        string ActiveUrl { get; }
        bool IsOffline { get; }
        string ConnectionStatusText { get; }

        void LoadSettings();
        void SaveSettings(string localUrl, string ngrokUrl);
        Task<bool> CheckServerAsync();
        Task<ApiResponse<QrCodePayload>> CreateQrAsync(QrCodePayload payload);
        Task<ApiResponse<List<QrCodePayload>>> GetQrListAsync();
        Task<ApiResponse<QrCodePayload>> UpdateQrAsync(int id, object data);
        Task<ApiResponse<bool>> DeleteQrAsync(int id);
    }

    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public string Message { get; set; } = string.Empty;
        public int StatusCode { get; set; }
        public Exception? Error { get; set; }
    }

    public class QrCodePayload
    {
        public string qrNumber { get; set; } = string.Empty;
        public string location { get; set; } = string.Empty;
        public string? block { get; set; }
        public string floor { get; set; } = string.Empty;
        public string qrValue { get; set; } = string.Empty;
        public string pngPath { get; set; } = string.Empty;
        public string pdfPath { get; set; } = string.Empty;
        public string internalCode { get; set; } = string.Empty;
        public string category { get; set; } = string.Empty;
        public string department { get; set; } = string.Empty;
        public string status { get; set; } = string.Empty;
        public string routingType { get; set; } = string.Empty;
        public string qrImageBase64 { get; set; } = string.Empty;
    }

    public class SettingsData
    {
        public string LocalUrl { get; set; } = "http://103.207.1.91:3019";
        public string NgrokUrl { get; set; } = "";
        public string SelectedUrl { get; set; } = "http://103.207.1.91:3019";
    }

    public class ApiService : IApiService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _settingsFilePath;

        public string LocalUrl { get; set; } = "http://103.207.1.91:3019";
        public string NgrokUrl { get; set; } = "";
        public string SelectedUrl { get; set; } = "http://103.207.1.91:3019";

        public string ActiveUrl { get; private set; } = "http://103.207.1.91:3019";
        public string ConnectionStatusText { get; private set; } = "🔴 Server Offline";
        public bool IsOffline { get; private set; } = true;

        public ApiService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            _settingsFilePath = Path.Combine(baseDir, "appsettings.json");

            LoadSettings();
        }

        private void LogToFile(string message)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string logDir = Path.Combine(baseDir, "Logs");
                if (!Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }
                string logPath = Path.Combine(logDir, "app.log");
                string logMessage = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}{Environment.NewLine}";
                MessageBox.Show(logPath);
                File.AppendAllText(logPath, logMessage);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to write to log file: {ex.Message}");
            }
        }

        public void LoadSettings()
        {
            try
            {
                if (File.Exists(_settingsFilePath))
                {
                    string json = File.ReadAllText(_settingsFilePath);
                    var settings = JsonSerializer.Deserialize<SettingsData>(json);
                    if (settings != null)
                    {
                        LocalUrl = settings.LocalUrl;
                        NgrokUrl = settings.NgrokUrl;
                        SelectedUrl = settings.SelectedUrl;
                        ActiveUrl = SelectedUrl;
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load settings: {ex.Message}");
            }
        }

        public void SaveSettings(string localUrl, string ngrokUrl)
        {
            try
            {
                LocalUrl = localUrl;
                NgrokUrl = ngrokUrl;

                var data = new SettingsData
                {
                    LocalUrl = LocalUrl,
                    NgrokUrl = NgrokUrl,
                    SelectedUrl = SelectedUrl
                };

                string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsFilePath, json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to save settings: {ex.Message}");
            }
        }

        private void SaveSelectedUrl(string selectedUrl)
        {
            try
            {
                SelectedUrl = selectedUrl;
                var data = new SettingsData
                {
                    LocalUrl = LocalUrl,
                    NgrokUrl = NgrokUrl,
                    SelectedUrl = SelectedUrl
                };
                string json = JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsFilePath, json);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to save selected URL: {ex.Message}");
            }
        }

        public async Task<bool> CheckServerAsync()
        {
            // First check Local Server
            bool isLocalOnline = await PingServerAsync(LocalUrl);
            if (isLocalOnline)
            {
                ActiveUrl = LocalUrl;
                SaveSelectedUrl(LocalUrl);
                ConnectionStatusText = $"🟢 Connected ({LocalUrl})";
                IsOffline = false;
                return true;
            }

            // If Local is offline, check ngrok URL
            if (!string.IsNullOrWhiteSpace(NgrokUrl))
            {
                bool isNgrokOnline = await PingServerAsync(NgrokUrl);
                if (isNgrokOnline)
                {
                    ActiveUrl = NgrokUrl;
                    SaveSelectedUrl(NgrokUrl);
                    ConnectionStatusText = $"🟢 Connected ({NgrokUrl})";
                    IsOffline = false;
                    return true;
                }
            }

            // If both fail, keep SelectedUrl but show Offline status
            ActiveUrl = SelectedUrl;
            ConnectionStatusText = "🔴 Server Offline";
            IsOffline = true;
            return false;
        }

        private async Task<bool> PingServerAsync(string baseUrl)
        {
            if (string.IsNullOrWhiteSpace(baseUrl)) return false;
            try
            {
                string url = baseUrl.TrimEnd('/') + "/health";
                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(2);
                var response = await client.GetAsync(url);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        public async Task<ApiResponse<QrCodePayload>> CreateQrAsync(QrCodePayload payload)
        {
            MessageBox.Show("CreateQrAsync Entered");
            LogToFile("CreateQrAsync Entered");
            LogToFile("Starting QR Sync...");
            await CheckServerAsync();

            string url = ActiveUrl.TrimEnd('/') + "/api/qrcodes";
            LogToFile($"API URL: {url}");

            string jsonPayload = string.Empty;
            try
            {
                jsonPayload = JsonSerializer.Serialize(payload);
                LogToFile($"Payload: {jsonPayload}");
            }
            catch (Exception ex)
            {
                LogToFile($"Serialization Exception: {ex.Message}");
            }

            var apiResponse = new ApiResponse<QrCodePayload>();

            if (IsOffline)
            {
                LogToFile("Device is offline. Sync aborted.");
                apiResponse.Success = false;
                apiResponse.StatusCode = 0;
                apiResponse.Message = "Device is offline";
                return apiResponse;
            }

            try
            {
                using var client = _httpClientFactory.CreateClient();
                var response = await client.PostAsJsonAsync(url, payload);

                LogToFile($"HTTP Status: {response.StatusCode} ({(int)response.StatusCode})");

                string responseBody = await response.Content.ReadAsStringAsync();
                LogToFile($"Response: {responseBody}");

                apiResponse.StatusCode = (int)response.StatusCode;
                if (response.IsSuccessStatusCode)
                {
                    apiResponse.Success = true;
                    apiResponse.Message = "QR Synced Successfully";
                }
                else
                {
                    apiResponse.Success = false;
                    apiResponse.Message = $"API error: {response.ReasonPhrase}";
                }
            }
            catch (Exception ex)
            {
                LogToFile($"Any Exception: {ex.Message}");
                LogToFile($"Exception details: {ex.StackTrace}");
                apiResponse.Success = false;
                apiResponse.Error = ex;
                apiResponse.Message = ex.Message;
            }

            return apiResponse;
        }

        public async Task<ApiResponse<List<QrCodePayload>>> GetQrListAsync()
        {
            var apiResponse = new ApiResponse<List<QrCodePayload>>();
            await CheckServerAsync();
            if (IsOffline)
            {
                apiResponse.Success = false;
                apiResponse.Message = "Device is offline";
                return apiResponse;
            }

            try
            {
                string url = ActiveUrl.TrimEnd('/') + "/api/qrcodes";
                using var client = _httpClientFactory.CreateClient();
                var response = await client.GetAsync(url);
                apiResponse.StatusCode = (int)response.StatusCode;
                if (response.IsSuccessStatusCode)
                {
                    var data = await response.Content.ReadFromJsonAsync<List<QrCodePayload>>();
                    apiResponse.Success = true;
                    apiResponse.Data = data;
                }
            }
            catch (Exception ex)
            {
                apiResponse.Success = false;
                apiResponse.Error = ex;
                apiResponse.Message = ex.Message;
            }
            return apiResponse;
        }

        public async Task<ApiResponse<QrCodePayload>> UpdateQrAsync(int id, object data)
        {
            var apiResponse = new ApiResponse<QrCodePayload>();
            await CheckServerAsync();
            if (IsOffline)
            {
                apiResponse.Success = false;
                apiResponse.Message = "Device is offline";
                return apiResponse;
            }

            try
            {
                string url = ActiveUrl.TrimEnd('/') + $"/api/qrcodes/{id}";
                using var client = _httpClientFactory.CreateClient();
                var response = await client.PutAsJsonAsync(url, data);
                apiResponse.StatusCode = (int)response.StatusCode;
                if (response.IsSuccessStatusCode)
                {
                    apiResponse.Success = true;
                }
            }
            catch (Exception ex)
            {
                apiResponse.Success = false;
                apiResponse.Error = ex;
                apiResponse.Message = ex.Message;
            }
            return apiResponse;
        }

        public async Task<ApiResponse<bool>> DeleteQrAsync(int id)
        {
            var apiResponse = new ApiResponse<bool>();
            await CheckServerAsync();
            if (IsOffline)
            {
                apiResponse.Success = false;
                apiResponse.Message = "Device is offline";
                return apiResponse;
            }

            try
            {
                string url = ActiveUrl.TrimEnd('/') + $"/api/qrcodes/{id}";
                using var client = _httpClientFactory.CreateClient();
                var response = await client.DeleteAsync(url);
                apiResponse.StatusCode = (int)response.StatusCode;
                if (response.IsSuccessStatusCode)
                {
                    apiResponse.Success = true;
                    apiResponse.Data = true;
                }
            }
            catch (Exception ex)
            {
                apiResponse.Success = false;
                apiResponse.Error = ex;
                apiResponse.Message = ex.Message;
            }
            return apiResponse;
        }
    }
}
