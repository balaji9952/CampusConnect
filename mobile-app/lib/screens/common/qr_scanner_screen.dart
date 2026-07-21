import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:campus_connect/screens/common/complaint_form_screen.dart';
import 'package:campus_connect/services/qr_verification_service.dart';
import 'package:campus_connect/services/ticket_service.dart';

/// Camera-only QR scanner screen.
///
/// Security constraints enforced here:
/// - CAMERA ONLY: no gallery, no image import, no manual entry
/// - Debounced scanning (1 scan per 2 seconds) to prevent duplicate API calls
/// - Shows typed error feedback for each failure mode
/// - Navigates to ComplaintFormScreen on success (location locked)
class QrScannerScreen extends StatefulWidget {
  final TicketService ticketService;

  const QrScannerScreen({super.key, required this.ticketService});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen>
    with WidgetsBindingObserver {
  final MobileScannerController _controller = MobileScannerController(
    facing: CameraFacing.back,  // Rear camera only
    // No fromGallery, no image import options
  );
  final QrVerificationService _qrService = QrVerificationService();

  bool _isProcessing = false;
  bool _hasError = false;
  String _errorMessage = '';
  DateTime? _lastScanTime;

  static const _debounceMs = 2000; // 2-second debounce between scans

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) _controller.stop();
    if (state == AppLifecycleState.resumed && !_isProcessing) _controller.start();
  }

  void _setError(String message) {
    if (!mounted) return;
    setState(() {
      _hasError = true;
      _errorMessage = message;
      _isProcessing = false;
    });
    // Auto-clear error and resume scanning after 3.5 seconds
    Future.delayed(const Duration(milliseconds: 3500), () {
      if (mounted) {
        setState(() { _hasError = false; _errorMessage = ''; });
        _controller.start();
      }
    });
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;
    final rawValue = barcode.rawValue!;

    // Debounce: ignore scans within 2 seconds of the last one
    final now = DateTime.now();
    if (_lastScanTime != null &&
        now.difference(_lastScanTime!).inMilliseconds < _debounceMs) {
      return;
    }
    if (_isProcessing) return;

    _lastScanTime = now;
    _controller.stop(); // Pause while processing

    setState(() { _isProcessing = true; _hasError = false; });

    try {
      final verifiedLocation = await _qrService.verifyQr(rawValue);
      if (!mounted) return;

      // Navigate to complaint form with locked, verified location
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ComplaintFormScreen(
            verifiedLocation: verifiedLocation,
            ticketService: widget.ticketService,
          ),
        ),
      );
    } on QrException catch (e) {
      _setError(_friendlyMessage(e));
    } catch (e) {
      _setError('An unexpected error occurred. Please try again.');
    }
  }

  String _friendlyMessage(QrException e) {
    switch (e.code) {
      case QrErrorCode.invalidQr:
        return '❌ Invalid QR Code\nPlease scan a valid campus QR.';
      case QrErrorCode.qrDisabled:
        return '🚫 QR Disabled\nThis QR has been disabled by an admin.';
      case QrErrorCode.qrExpired:
        return '⏰ QR Expired\nAsk admin to regenerate the QR code.';
      case QrErrorCode.locationInactive:
        return '📍 Location Inactive\nThis location is currently unavailable.';
      case QrErrorCode.rateLimited:
        return '⚠️ Too Many Scans\nPlease wait a moment before trying again.';
      case QrErrorCode.unauthorized:
        return '🔒 Session Expired\nPlease log in again.';
      case QrErrorCode.networkError:
        return '📡 No Connection\nPlease check your internet and try again.';
      case QrErrorCode.unknown:
        return '⚠️ ${e.message}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Scan Location QR', style: TextStyle(fontWeight: FontWeight.w600)),
        centerTitle: true,
        actions: [
          // Torch toggle
          IconButton(
            icon: const Icon(Icons.flash_on),
            tooltip: 'Toggle flashlight',
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          // Responsive: constrain scanner width on wide screens (tablets)
          final maxWidth = constraints.maxWidth > 500 ? 500.0 : constraints.maxWidth;

          return Center(
            child: SizedBox(
              width: maxWidth,
              height: constraints.maxHeight,
              child: Stack(
                children: [
                  // ── Camera Feed ────────────────────────────────────────────
                  MobileScanner(
                    controller: _controller,
                    onDetect: _onDetect,
                    // Camera only — no fromGallery, no image picker
                  ),

                  // ── Scan frame overlay ─────────────────────────────────────
                  Center(
                    child: _ScanFrame(
                      size: maxWidth * 0.72,
                      isProcessing: _isProcessing,
                    ),
                  ),

                  // ── Top instruction banner ─────────────────────────────────
                  Positioned(
                    top: 16,
                    left: 16,
                    right: 16,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.qr_code_scanner, color: Colors.white, size: 20),
                          const SizedBox(height: 4),
                          Text(
                            _isProcessing
                                ? 'Verifying location...'
                                : 'Point camera at the location QR code',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Loading overlay ────────────────────────────────────────
                  if (_isProcessing)
                    Positioned.fill(
                      child: ColoredBox(
                        color: Colors.black38,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                            decoration: BoxDecoration(
                              color: Colors.black87,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                CircularProgressIndicator(color: Color(0xFF6C63FF)),
                                SizedBox(height: 14),
                                Text(
                                  'Verifying QR Code...',
                                  style: TextStyle(color: Colors.white, fontSize: 14),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                  // ── Error banner ───────────────────────────────────────────
                  if (_hasError)
                    Positioned(
                      bottom: 48,
                      left: 24,
                      right: 24,
                      child: AnimatedOpacity(
                        opacity: _hasError ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 300),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFB71C1C),
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.3),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Text(
                            _errorMessage,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ),
                    ),

                  // ── Bottom step indicator ──────────────────────────────────
                  Positioned(
                    bottom: 16,
                    left: 16,
                    right: 16,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _StepDot(label: '1', title: 'Scan QR', isActive: true),
                        _StepLine(),
                        _StepDot(label: '2', title: 'Submit', isActive: false),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Animated scan-frame corner brackets
class _ScanFrame extends StatelessWidget {
  final double size;
  final bool isProcessing;

  const _ScanFrame({required this.size, required this.isProcessing});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          // Dim overlay outside frame
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(
                  color: isProcessing
                      ? const Color(0xFF6C63FF)
                      : Colors.white,
                  width: 2.5,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          // Scan line animation
          if (!isProcessing)
            const _ScanLine(),
        ],
      ),
    );
  }
}

class _ScanLine extends StatefulWidget {
  const _ScanLine();

  @override
  State<_ScanLine> createState() => _ScanLineState();
}

class _ScanLineState extends State<_ScanLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0, end: 1).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Positioned(
        top: _anim.value * 240,
        left: 12,
        right: 12,
        child: Container(
          height: 2,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Colors.transparent, Color(0xFF6C63FF), Colors.transparent],
            ),
            borderRadius: BorderRadius.circular(1),
          ),
        ),
      ),
    );
  }
}

class _StepDot extends StatelessWidget {
  final String label;
  final String title;
  final bool isActive;

  const _StepDot({required this.label, required this.title, required this.isActive});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: isActive ? const Color(0xFF6C63FF) : Colors.white24,
          child: Text(label,
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
        ),
        const SizedBox(height: 4),
        Text(title, style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}

class _StepLine extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 2,
      margin: const EdgeInsets.only(bottom: 16, left: 4, right: 4),
      color: Colors.white24,
    );
  }
}
