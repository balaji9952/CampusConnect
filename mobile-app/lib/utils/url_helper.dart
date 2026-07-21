import 'package:campus_connect/config/api_config.dart';

class UrlHelper {
  /// Resolves an image URL safely.
  /// If it's already an absolute URL (starts with http), it returns it unchanged.
  /// If it's a relative path (e.g., /uploads/...), it prepends the serverBase.
  static String resolveImageUrl(String? path) {
    if (path == null || path.isEmpty) {
      return ''; // Or return a default placeholder asset URL if needed
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Ensure we don't double slash if serverBase ends with / or path starts with /
    final base = ApiConfig.serverBase.endsWith('/') 
        ? ApiConfig.serverBase.substring(0, ApiConfig.serverBase.length - 1)
        : ApiConfig.serverBase;
        
    final relativePath = path.startsWith('/') ? path : '/$path';
    return '$base$relativePath';
  }
}
