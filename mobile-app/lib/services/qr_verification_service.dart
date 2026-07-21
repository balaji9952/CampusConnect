import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:campus_connect/models/verified_location.dart';
import 'package:campus_connect/services/api_service.dart';

/// Typed exception for QR verification failures.
enum QrErrorCode {
  invalidQr,
  qrDisabled,
  qrExpired,
  locationInactive,
  rateLimited,
  unauthorized,
  networkError,
  unknown,
}

class QrException implements Exception {
  final QrErrorCode code;
  final String message;
  const QrException(this.code, this.message);

  @override
  String toString() => 'QrException(${code.name}): $message';
}

/// Handles QR code verification with the backend.
/// Sends the raw QR payload + JWT + device ID to POST /api/locations/verify-qr.
class QrVerificationService {
  static const _storage = FlutterSecureStorage();
  static const _deviceIdKey = 'campus_device_id';

  final ApiService _apiService = ApiService();

  /// Returns the persistent device ID, generating one if not yet stored.
  Future<String> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    await _storage.write(key: _deviceIdKey, value: hex);
    return hex;
  }

  /// Verifies a QR code scanned by the mobile scanner.
  /// Returns [VerifiedLocation] on success.
  /// Throws [QrException] with a typed code on all failure paths.
  Future<VerifiedLocation> verifyQr(String qrCode) async {
    final deviceId = await getOrCreateDeviceId();
    debugPrint('[QR] Verifying QR payload (length=${qrCode.length})...');

    try {
      final response = await _apiService.postWithHeaders(
        '/locations/verify-qr',
        body: {'qrCode': qrCode},
        extraHeaders: {'X-Device-ID': deviceId},
      );

      if (response == null) {
        throw const QrException(QrErrorCode.networkError, 'No response from server.');
      }

      debugPrint('[QR] Verification successful: ${response['locationName']}');
      return VerifiedLocation.fromJson(response as Map<String, dynamic>);
    } on ApiException catch (e) {
      debugPrint('[QR] ApiException status=${e.statusCode} message=${e.message}');
      // Map HTTP status codes to typed QR errors
      // The backend returns the error code in the JSON body but ApiException already extracts the message
      final msg = e.message.toLowerCase();
      if (e.statusCode == 429) {
        throw const QrException(
          QrErrorCode.rateLimited,
          'Too many scan attempts. Please wait and try again.',
        );
      } else if (e.statusCode == 401) {
        throw const QrException(
          QrErrorCode.unauthorized,
          'Authentication required. Please log in again.',
        );
      } else if (msg.contains('disabled')) {
        throw const QrException(
          QrErrorCode.qrDisabled,
          'This QR code has been disabled. Contact an administrator.',
        );
      } else if (msg.contains('expired')) {
        throw const QrException(
          QrErrorCode.qrExpired,
          'This QR code has expired. Ask admin to regenerate it.',
        );
      } else if (msg.contains('inactive')) {
        throw const QrException(
          QrErrorCode.locationInactive,
          'This location is currently inactive.',
        );
      } else if (e.statusCode == 400) {
        throw const QrException(
          QrErrorCode.invalidQr,
          'Invalid QR code. Please scan a valid campus QR.',
        );
      } else {
        throw QrException(QrErrorCode.unknown, e.message);
      }
    } catch (e) {
      if (e is QrException) rethrow;
      debugPrint('[QR] Unexpected error: $e');
      throw QrException(QrErrorCode.networkError, 'Unable to reach the server: $e');
    }
  }
}
