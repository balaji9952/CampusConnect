using CampusQrGenerator.Models;
using CampusQrGenerator.Services;
using Microsoft.Win32;
using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace CampusQrGenerator.ViewModels
{
    public class MainViewModel : ViewModelBase
    {
        private readonly IQrGeneratorService _qrGeneratorService;
        private readonly IPdfExportService _pdfExportService;
        private readonly IPrintService _printService;

        // Input Fields
        private string _qrNumber = string.Empty;
        private string _location = string.Empty;
        private string _selectedFloor = string.Empty;
        private string _baseUrl = "https://your-domain.com/scan/";
        private bool _isAutoIncrement = false;
        private string _internalCode = string.Empty;
        private string _selectedCategory = "General";
        private string _selectedDepartment = "No Department";
        private string _selectedStatus = "Active";
        private string _selectedRoutingType = "Department Routed";

        // Validation Errors
        private string _qrNumberError = string.Empty;
        private string _locationError = string.Empty;
        private string _floorError = string.Empty;

        // UI States
        private bool _isGenerated = false;
        private ImageSource? _qrCodeImage;
        private bool _isDarkMode = false;
        private string _lastSaveDirectory = string.Empty;

        // Collections for dropdowns

        public ObservableCollection<string> Floors { get; } = new()
        {
            "Ground Floor", "First Floor", "Second Floor", "Third Floor"
        };

        public ObservableCollection<string> Categories { get; } = new()
        {
            "General", "Academic", "Library", "Hostel", "Transport", "Canteen", "Sports"
        };

        public ObservableCollection<string> Departments { get; } = new()
        {
            "Artificial Intelligence and Data Science",
            "Civil Engineering",
            "Computer Science and Engineering",
            "Electrical and Electronics Engineering",
            "Electronics and Communication Engineering",
            "Mechanical Engineering",
            "No Department"
        };

        public ObservableCollection<string> StatusOptions { get; } = new()
        {
            "Active", "Disabled"
        };

        public ObservableCollection<string> RoutingTypes { get; } = new()
        {
            "Department Routed", "Global Routed"
        };

        // History
        public ObservableCollection<QrCodeCard> History { get; } = new();
        private QrCodeCard? _selectedHistoryItem;

        // Delegate to View for rendering the high-DPI visual
        public Func<BitmapSource?>? RenderCardDelegate { get; set; }

        private readonly IApiSyncService _apiSyncService;

        // Connectivity & Settings Properties
        private string _connectionStatusText = "🔴 Server Offline";
        private bool _isOffline = true;
        private int _pendingSyncCount = 0;
        private string _localUrlSetting = string.Empty;
        private string _ngrokUrlSetting = string.Empty;

        public string ConnectionStatusText
        {
            get => _connectionStatusText;
            set => SetProperty(ref _connectionStatusText, value);
        }

        public bool IsOffline
        {
            get => _isOffline;
            set
            {
                if (SetProperty(ref _isOffline, value))
                {
                    OnPropertyChanged(nameof(ShowRetryButton));
                }
            }
        }

        public int PendingSyncCount
        {
            get => _pendingSyncCount;
            set
            {
                if (SetProperty(ref _pendingSyncCount, value))
                {
                    OnPropertyChanged(nameof(ShowRetryButton));
                }
            }
        }

        public bool ShowRetryButton => IsOffline && PendingSyncCount > 0;

        public string LocalUrlSetting
        {
            get => _localUrlSetting;
            set => SetProperty(ref _localUrlSetting, value);
        }

        public string NgrokUrlSetting
        {
            get => _ngrokUrlSetting;
            set => SetProperty(ref _ngrokUrlSetting, value);
        }

        public ICommand RetrySyncCommand { get; }
        public ICommand SaveSettingsCommand { get; }

        public MainViewModel(
            IQrGeneratorService qrGeneratorService,
            IPdfExportService pdfExportService,
            IPrintService printService,
            IApiSyncService apiSyncService)
        {
            _qrGeneratorService = qrGeneratorService;
            _pdfExportService = pdfExportService;
            _printService = printService;
            _apiSyncService = apiSyncService;

            // Load setting values
            LocalUrlSetting = _apiSyncService.LocalUrl;
            NgrokUrlSetting = _apiSyncService.NgrokUrl;

            // Commands
            GenerateCommand = new RelayCommand(GenerateQr);
            SavePngCommand = new RelayCommand(SavePng, () => IsGenerated);
            ExportPdfCommand = new RelayCommand(ExportPdf, () => IsGenerated);
            PrintCommand = new RelayCommand(PrintCard, () => IsGenerated);
            ClearCommand = new RelayCommand(ClearFields);
            ToggleThemeCommand = new RelayCommand(ToggleTheme);
            RetrySyncCommand = new RelayCommand(async () => await RetrySyncAsync());
            SaveSettingsCommand = new RelayCommand(SaveSettings);

            // Initialize last save directory to Documents
            _lastSaveDirectory = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);

            // Add some default initial settings
            QrNumber = "QR-001";

            // Startup check connectivity
            Task.Run(async () =>
            {
                await _apiSyncService.CheckConnectivityAsync();
                UpdateConnectionState();
                
                // Automatic background polling for connectivity and sync
                while (true)
                {
                    await Task.Delay(15000); // Poll every 15 seconds
                    await _apiSyncService.CheckConnectivityAsync();
                    UpdateConnectionState();
                    if (!_apiSyncService.IsOffline && _apiSyncService.PendingSyncCount > 0)
                    {
                        await _apiSyncService.SyncPendingQrsAsync();
                        UpdateConnectionState();
                    }
                }
            });
        }

        private void UpdateConnectionState()
        {
            ConnectionStatusText = _apiSyncService.ConnectionStatusText;
            IsOffline = _apiSyncService.IsOffline;
            PendingSyncCount = _apiSyncService.PendingSyncCount;
            
            if (!_apiSyncService.IsOffline)
            {
                BaseUrl = _apiSyncService.ActiveUrl.TrimEnd('/') + "/scan";
            }
        }

        private async Task RetrySyncAsync()
        {
            if (_apiSyncService.IsOffline)
            {
                MessageBox.Show("Cannot sync. Server is still offline.", "Offline", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            await _apiSyncService.SyncPendingQrsAsync();
            UpdateConnectionState();
            
            if (PendingSyncCount == 0)
            {
                MessageBox.Show("All pending QR records synchronized successfully!", "Sync Success", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            else
            {
                MessageBox.Show($"Sync completed. {PendingSyncCount} records failed to sync.", "Sync Partial", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void SaveSettings()
        {
            if (string.IsNullOrWhiteSpace(LocalUrlSetting))
            {
                MessageBox.Show("Local Server URL is required.", "Validation Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            _apiSyncService.SaveSettings(LocalUrlSetting, NgrokUrlSetting ?? string.Empty);
            
            // Re-trigger connectivity check
            Task.Run(async () =>
            {
                await _apiSyncService.CheckConnectivityAsync();
                UpdateConnectionState();
                
                Application.Current.Dispatcher.Invoke(() =>
                {
                    MessageBox.Show("Settings saved and connection tested successfully!", "Settings Saved", MessageBoxButton.OK, MessageBoxImage.Information);
                });
            });
        }

        // Properties
        public string QrNumber
        {
            get => _qrNumber;
            set
            {
                if (SetProperty(ref _qrNumber, value))
                {
                    ValidateQrNumber();
                }
            }
        }

        public string Location
        {
            get => _location;
            set
            {
                if (SetProperty(ref _location, value))
                {
                    ValidateLocation();
                }
            }
        }


        public string SelectedFloor
        {
            get => _selectedFloor;
            set
            {
                if (SetProperty(ref _selectedFloor, value))
                {
                    ValidateFloor();
                }
            }
        }

        public string BaseUrl
        {
            get => _baseUrl;
            set => SetProperty(ref _baseUrl, value);
        }

        public bool IsAutoIncrement
        {
            get => _isAutoIncrement;
            set => SetProperty(ref _isAutoIncrement, value);
        }

        public string InternalCode
        {
            get => _internalCode;
            set => SetProperty(ref _internalCode, value);
        }

        public string SelectedCategory
        {
            get => _selectedCategory;
            set => SetProperty(ref _selectedCategory, value);
        }

        public string SelectedDepartment
        {
            get => _selectedDepartment;
            set => SetProperty(ref _selectedDepartment, value);
        }

        public string SelectedStatus
        {
            get => _selectedStatus;
            set => SetProperty(ref _selectedStatus, value);
        }

        public string SelectedRoutingType
        {
            get => _selectedRoutingType;
            set => SetProperty(ref _selectedRoutingType, value);
        }

        // Errors
        public string QrNumberError
        {
            get => _qrNumberError;
            set => SetProperty(ref _qrNumberError, value);
        }

        public string LocationError
        {
            get => _locationError;
            set => SetProperty(ref _locationError, value);
        }


        public string FloorError
        {
            get => _floorError;
            set => SetProperty(ref _floorError, value);
        }

        // States
        public bool IsGenerated
        {
            get => _isGenerated;
            set
            {
                if (SetProperty(ref _isGenerated, value))
                {
                    CommandManager.InvalidateRequerySuggested();
                }
            }
        }

        public ImageSource? QrCodeImage
        {
            get => _qrCodeImage;
            set => SetProperty(ref _qrCodeImage, value);
        }

        public bool IsDarkMode
        {
            get => _isDarkMode;
            set => SetProperty(ref _isDarkMode, value);
        }

        public QrCodeCard? SelectedHistoryItem
        {
            get => _selectedHistoryItem;
            set
            {
                if (SetProperty(ref _selectedHistoryItem, value) && value != null)
                {
                    LoadFromHistory(value);
                }
            }
        }

        // Commands
        public ICommand GenerateCommand { get; }
        public ICommand SavePngCommand { get; }
        public ICommand ExportPdfCommand { get; }
        public ICommand PrintCommand { get; }
        public ICommand ClearCommand { get; }
        public ICommand ToggleThemeCommand { get; }

        // Logic
        private bool ValidateAll()
        {
            bool isValid = true;
            isValid &= ValidateQrNumber();
            isValid &= ValidateLocation();
            isValid &= ValidateFloor();
            return isValid;
        }

        private bool ValidateQrNumber()
        {
            if (string.IsNullOrWhiteSpace(QrNumber))
            {
                QrNumberError = "QR Number is required.";
                return false;
            }
            QrNumberError = string.Empty;
            return true;
        }

        private bool ValidateLocation()
        {
            if (string.IsNullOrWhiteSpace(Location))
            {
                LocationError = "Location is required.";
                return false;
            }
            LocationError = string.Empty;
            return true;
        }


        private bool ValidateFloor()
        {
            if (string.IsNullOrWhiteSpace(SelectedFloor))
            {
                FloorError = "Floor must be selected.";
                return false;
            }
            FloorError = string.Empty;
            return true;
        }

        private void GenerateQr()
        {
            if (!ValidateAll())
            {
                MessageBox.Show("Please fix validation errors before generating.", "Validation Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                // Ensure BaseUrl is set correctly
                if (!_apiSyncService.IsOffline)
                {
                    BaseUrl = _apiSyncService.ActiveUrl.TrimEnd('/') + "/scan";
                }

                // Format the URL to encode. If BaseUrl is empty, we just encode the QR Number.
                string contentToEncode = string.IsNullOrWhiteSpace(BaseUrl) 
                    ? QrNumber 
                    : $"{BaseUrl.TrimEnd('/')}/{QrNumber}";

                // Define logo path
                string logoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Assets", "logo.png");

                // Generate QR
                var image = _qrGeneratorService.GenerateQrCode(contentToEncode, logoPath);
                QrCodeImage = image;
                IsGenerated = true;

                // Add to history if not already present
                AddToHistory(contentToEncode);

                // Auto-save PNG/PDF and submit to backend
                SaveOutputsAndSubmit(contentToEncode);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to generate QR Code: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void SaveOutputsAndSubmit(string qrValue)
        {
            if (RenderCardDelegate == null) return;

            try
            {
                // Create Output directory relative to app executable
                string outputDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Output");
                if (!Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }

                string pngPath = Path.Combine(outputDir, $"{QrNumber}.png");
                string pdfPath = Path.Combine(outputDir, $"{QrNumber}.pdf");

                // Render visual card to high-DPI bitmap
                var bitmap = RenderCardDelegate();
                if (bitmap == null) return;

                // Save PNG file
                using (var fileStream = new FileStream(pngPath, FileMode.Create))
                {
                    var encoder = new PngBitmapEncoder();
                    encoder.Frames.Add(BitmapFrame.Create(bitmap));
                    encoder.Save(fileStream);
                }

                string qrImageBase64 = string.Empty;
                try
                {
                    if (File.Exists(pngPath))
                    {
                        byte[] imageBytes = File.ReadAllBytes(pngPath);
                        qrImageBase64 = Convert.ToBase64String(imageBytes);
                    }
                }
                catch { }

                // Save PDF using temp PNG
                string tempPngPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.png");
                try
                {
                    using (var fileStream = new FileStream(tempPngPath, FileMode.Create))
                    {
                        var encoder = new PngBitmapEncoder();
                        encoder.Frames.Add(BitmapFrame.Create(bitmap));
                        encoder.Save(fileStream);
                    }
                    _pdfExportService.ExportToPdf(tempPngPath, pdfPath);
                }
                finally
                {
                    if (File.Exists(tempPngPath))
                    {
                        try { File.Delete(tempPngPath); } catch { }
                    }
                }

                // Call backend API (or queue offline)
                string reqPngPath = $"Output/{QrNumber}.png";
                string reqPdfPath = $"Output/{QrNumber}.pdf";

                MessageBox.Show("Before SubmitQrCodeAsync");
                bool success = await _apiSyncService.SubmitQrCodeAsync(
                    QrNumber,
                    Location,
                    null,
                    SelectedFloor,
                    qrValue,
                    reqPngPath,
                    reqPdfPath,
                    InternalCode,
                    SelectedCategory,
                    SelectedDepartment,
                    SelectedStatus,
                    SelectedRoutingType,
                    qrImageBase64
                );
                MessageBox.Show("After SubmitQrCodeAsync");

                if (success)
                {
                    MessageBox.Show("QR Synced Successfully", "Success", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else
                {
                    MessageBox.Show("Server Offline", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }

                UpdateConnectionState();

                // Auto-increment after generation
                AutoIncrementQrNumber();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error automatically saving QR assets: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void AddToHistory(string encodedUrl)
        {
            // Avoid duplicate entries in history list
            for (int i = 0; i < History.Count; i++)
            {
                if (History[i].QrNumber.Equals(QrNumber, StringComparison.OrdinalIgnoreCase))
                {
                    History.RemoveAt(i);
                    break;
                }
            }

            var card = new QrCodeCard
            {
                QrNumber = QrNumber,
                Location = Location,
                Block = string.Empty,
                Floor = SelectedFloor,
                EncodedUrl = encodedUrl,
                Timestamp = DateTime.Now
            };

            History.Insert(0, card);
        }

        private void LoadFromHistory(QrCodeCard card)
        {
            _qrNumber = card.QrNumber;
            _location = card.Location;
            _selectedFloor = card.Floor;

            OnPropertyChanged(nameof(QrNumber));
            OnPropertyChanged(nameof(Location));
            OnPropertyChanged(nameof(SelectedFloor));

            // Clear errors
            QrNumberError = string.Empty;
            LocationError = string.Empty;
            FloorError = string.Empty;

            // Generate
            GenerateQr();
        }

        private void SavePng()
        {
            if (RenderCardDelegate == null) return;

            var saveFileDialog = new SaveFileDialog
            {
                Filter = "PNG Image (*.png)|*.png",
                DefaultExt = "png",
                FileName = $"{QrNumber}.png",
                InitialDirectory = _lastSaveDirectory
            };

            if (saveFileDialog.ShowDialog() == true)
            {
                try
                {
                    string filePath = saveFileDialog.FileName;
                    _lastSaveDirectory = Path.GetDirectoryName(filePath) ?? _lastSaveDirectory;

                    var bitmap = RenderCardDelegate();
                    if (bitmap != null)
                    {
                        using var fileStream = new FileStream(filePath, FileMode.Create);
                        var encoder = new PngBitmapEncoder();
                        encoder.Frames.Add(BitmapFrame.Create(bitmap));
                        encoder.Save(fileStream);

                        MessageBox.Show($"Image saved successfully to:\n{filePath}", "Success", MessageBoxButton.OK, MessageBoxImage.Information);

                        // Auto-increment after successful save/export
                        AutoIncrementQrNumber();
                    }
                }
                catch (Exception ex)
                {
                    if (Application.Current?.Dispatcher != null && Application.Current.Dispatcher.CheckAccess())
                    {
                        MessageBox.Show($"Failed to save image: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
        }

        private void ExportPdf()
        {
            if (RenderCardDelegate == null) return;

            var saveFileDialog = new SaveFileDialog
            {
                Filter = "PDF Document (*.pdf)|*.pdf",
                DefaultExt = "pdf",
                FileName = $"{QrNumber}.pdf",
                InitialDirectory = _lastSaveDirectory
            };

            if (saveFileDialog.ShowDialog() == true)
            {
                string pdfPath = saveFileDialog.FileName;
                _lastSaveDirectory = Path.GetDirectoryName(pdfPath) ?? _lastSaveDirectory;

                // Create a temporary PNG file to pass to PDFSharp
                string tempPngPath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}.png");

                try
                {
                    var bitmap = RenderCardDelegate();
                    if (bitmap != null)
                    {
                        using (var fileStream = new FileStream(tempPngPath, FileMode.Create))
                        {
                            var encoder = new PngBitmapEncoder();
                            encoder.Frames.Add(BitmapFrame.Create(bitmap));
                            encoder.Save(fileStream);
                        }

                        // Export to PDF using PDFSharp
                        _pdfExportService.ExportToPdf(tempPngPath, pdfPath);

                        MessageBox.Show($"PDF exported successfully to:\n{pdfPath}", "Success", MessageBoxButton.OK, MessageBoxImage.Information);

                        // Auto-increment after successful save/export
                        AutoIncrementQrNumber();
                    }
                }
                catch (Exception ex)
                {
                    if (Application.Current?.Dispatcher != null && Application.Current.Dispatcher.CheckAccess())
                    {
                        MessageBox.Show($"Failed to export PDF: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
                finally
                {
                    // Clean up temp file
                    if (File.Exists(tempPngPath))
                    {
                        try { File.Delete(tempPngPath); } catch { }
                    }
                }
            }
        }

        private void PrintCard()
        {
            if (RenderCardDelegate == null) return;

            try
            {
                var bitmap = RenderCardDelegate();
                if (bitmap != null)
                {
                    _printService.PrintCard(bitmap, QrNumber);
                    
                    // Auto-increment after successful print
                    AutoIncrementQrNumber();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to print: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void AutoIncrementQrNumber()
        {
            if (!IsAutoIncrement) return;
            if (string.IsNullOrWhiteSpace(QrNumber)) return;

            // Match numeric part at the end of the QR Code number (e.g. QR-001 -> QR- and 001)
            var match = System.Text.RegularExpressions.Regex.Match(QrNumber, @"^(.*?)(\d+)$");
            if (match.Success)
            {
                string prefix = match.Groups[1].Value;
                string numberStr = match.Groups[2].Value;
                if (int.TryParse(numberStr, out int num))
                {
                    num++;
                    QrNumber = prefix + num.ToString().PadLeft(numberStr.Length, '0');
                }
            }
        }

        private void ClearFields()
        {
            QrNumber = string.Empty;
            Location = string.Empty;
            SelectedFloor = string.Empty;
            InternalCode = string.Empty;
            SelectedCategory = "General";
            SelectedDepartment = "No Department";
            SelectedStatus = "Active";
            SelectedRoutingType = "Department Routed";
            
            QrCodeImage = null;
            IsGenerated = false;

            // Clear validation errors
            QrNumberError = string.Empty;
            LocationError = string.Empty;
            FloorError = string.Empty;
        }

        private void ToggleTheme()
        {
            IsDarkMode = !IsDarkMode;
            
            // Toggle theme resources in App
            var app = Application.Current as App;
            app?.ToggleTheme(IsDarkMode);
        }
    }
}
