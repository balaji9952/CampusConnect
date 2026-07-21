import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/config/api_config.dart';
import 'package:campus_connect/services/api_service.dart';

/// A single complaint category as returned by GET /api/categories
class ComplaintCategory {
  final int id;
  final String name;
  final String? icon;

  const ComplaintCategory({required this.id, required this.name, this.icon});

  factory ComplaintCategory.fromJson(Map<String, dynamic> json) =>
      ComplaintCategory(
        id: json['id'] as int,
        name: json['name']?.toString() ?? '',
        icon: json['icon']?.toString(),
      );
}

class TicketService {
  final ApiService _apiService = ApiService();
  List<Ticket> _tickets = [];

  /// Cached categories fetched from the DB — avoids repeated requests
  List<ComplaintCategory> _categories = [];

  List<Ticket> get tickets => List.unmodifiable(_tickets);
  List<ComplaintCategory> get categories => List.unmodifiable(_categories);

  int get unreadNotificationCount => 0; // TODO: Connect to live notifications API

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 1: Fetch categories dynamically from the API so IDs always match DB
  // ─────────────────────────────────────────────────────────────────────────
  Future<List<ComplaintCategory>> fetchCategories() async {
    try {
      final response = await _apiService.get('/categories');
      debugPrint('GET /categories RESPONSE: $response');

      if (response != null && response['success'] == true) {
        final List<dynamic> data = response['data'];
        _categories = data
            .map((e) => ComplaintCategory.fromJson(e as Map<String, dynamic>))
            .toList();
        debugPrint('GET /categories PARSED: ${_categories.length} categories');
      }
    } catch (e, stackTrace) {
      debugPrint('FETCH CATEGORIES ERROR: $e');
      debugPrintStack(stackTrace: stackTrace);
      // Non-fatal: return empty list — form will show fallback
    }
    return _categories;
  }

  Future<void> fetchTickets({String? ticketType, int limit = 50}) async {
    try {
      String url = '/tickets?limit=$limit';
      if (ticketType != null) {
        url += '&ticket_type=$ticketType';
      }
      final response = await _apiService.get(url);
      debugPrint('GET /tickets RESPONSE: $response');

      if (response != null && response['success'] == true) {
        final List<dynamic> data = response['data'];
        _tickets = data.map((e) => Ticket.fromJson(e)).toList();
        debugPrint('GET /tickets PARSED successfully. Count: ${_tickets.length}');
      }
    } catch (e, stackTrace) {
      debugPrint('FETCH TICKETS ERROR: $e');
      debugPrintStack(stackTrace: stackTrace);
      rethrow;
    }
  }

  /// Locally updates the tickets list based on a realtime event
  void handleRealtimeUpdate(String event, Map<String, dynamic> data) {
    final ticket = Ticket.fromJson(data);
    if (event == 'ticket_created') {
      if (!_tickets.any((t) => t.id == ticket.id)) {
        _tickets.insert(0, ticket);
      }
    } else {
      final index = _tickets.indexWhere((t) => t.id == ticket.id);
      if (index != -1) {
        _tickets[index] = ticket;
      } else {
        // If not found (e.g. ticket was assigned to us just now), we insert it
        if (event == 'ticket_assigned') {
          _tickets.insert(0, ticket);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 1 + FIX 3: categoryId now comes from the live DB (no hardcoded index).
  //   photo: XFile? — uses XFile.readAsBytes() which handles content:// URIs on Android
  // ─────────────────────────────────────────────────────────────────────────
  Future<Ticket?> createTicket({
    required int locationId,
    required int categoryId,
    required String title,
    required String description,
    required String qrVerificationToken,  // Required for QR verification flow
    XFile? photo,
  }) async {
    debugPrint('═══════════ CREATE TICKET ═══════════');
    debugPrint('photo XFile: $photo');
    debugPrint('photo.path: ${photo?.path}');
    debugPrint('photo.name: ${photo?.name}');
    debugPrint('photo is null: ${photo == null}');

    final response = await _apiService.post('/tickets', body: {
      'title': title,
      'description': description,
      'location_id': locationId,
      'category_id': categoryId,
      'priority': 1,
      'qr_verification_token': qrVerificationToken,
    });

    if (response != null && response['success'] == true) {
      final ticket = Ticket.fromJson(response['data']);
      _tickets.insert(0, ticket);

      // FIX 3: Read bytes from XFile — works on ALL platforms including Android content:// URIs
      if (photo != null) {
        debugPrint('PHOTO UPLOAD STARTING for ticket ${ticket.id}');
        try {
          final bytes = await photo.readAsBytes();
          debugPrint('Photo bytes read: ${bytes.length} bytes');
          await uploadPhotoBytes(ticket.id, bytes, photo.name);
          debugPrint('✅ PHOTO UPLOAD SUCCESS for ticket ${ticket.id}');
        } catch (e, stackTrace) {
          debugPrint('❌ PHOTO UPLOAD FAILED for ticket ${ticket.id}: $e');
          debugPrintStack(stackTrace: stackTrace);
          // Non-fatal: ticket is created; photo failure should not block the user
        }
      } else {
        debugPrint('PHOTO UPLOAD SKIPPED — no photo selected');
      }

      return ticket;
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIX 3 (v3): Uploads photo bytes via multipart/form-data.
  // Uses http.MultipartFile.fromBytes() — no file path required.
  // Works on Android (content:// URIs), iOS, and desktop.
  // ─────────────────────────────────────────────────────────────────────────
  Future<void> uploadPhotoBytes(String ticketId, List<int> bytes, String filename) async {
    debugPrint('═══════════ UPLOAD PHOTO BYTES ═══════════');
    debugPrint('ticketId: $ticketId');
    debugPrint('filename: $filename');
    debugPrint('bytes length: ${bytes.length}');

    final token = await _apiService.getToken();
    final url = Uri.parse('${ApiConfig.apiBase}/tickets/$ticketId/photo');
    debugPrint('Upload URL: $url');
    debugPrint('Token present: ${token != null && token.isNotEmpty}');

    final request = http.MultipartRequest('POST', url);
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    // fromBytes() — no filesystem path needed, works with content:// URIs
    final multipartFile = http.MultipartFile.fromBytes(
      'photo',          // Must match multer field name on backend
      bytes,
      filename: filename.isNotEmpty ? filename : 'photo.jpg',
      contentType: MediaType('image', 'jpeg'), // Force image/jpeg
    );
    request.files.add(multipartFile);
    debugPrint('MultipartFile ready: field=photo filename=${multipartFile.filename} length=${multipartFile.length}');

    final streamed = await request.send().timeout(const Duration(seconds: 30));
    final responseBody = await http.Response.fromStream(streamed);

    debugPrint('Upload response status: ${responseBody.statusCode}');
    debugPrint('Upload response body: ${responseBody.body}');

    if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
      throw Exception('Photo upload failed [${streamed.statusCode}]: ${responseBody.body}');
    }
  }

  Future<Ticket?> getTicketById(String id) async {
    final response = await _apiService.get('/tickets/$id');
    if (response != null && response['success'] == true) {
      return Ticket.fromJson(response['data']);
    }
    return null;
  }

  Future<Ticket?> updateTicketStatus(String id, int status, [String? remarks]) async {
    final response = await _apiService.patch('/tickets/$id/status', body: {
      'status': status,
      if (remarks != null && remarks.isNotEmpty) 'remarks': remarks,
    });
    if (response != null && response['success'] == true) {
      return Ticket.fromJson(response['data']);
    }
    return null;
  }

  Future<Ticket?> assignTicket(String id, String staffName) async {
    final response = await _apiService.patch('/tickets/$id/assign', body: {
      'assigned_to_name': staffName,
    });
    if (response != null && response['success'] == true) {
      return Ticket.fromJson(response['data']);
    }
    return null;
  }

  Future<Ticket?> resolveTicket(String id, String remarks) async {
    final response = await _apiService.patch('/tickets/$id/resolve', body: {
      'status': 2, // Resolved
      'remarks': remarks,
    });
    if (response != null && response['success'] == true) {
      return Ticket.fromJson(response['data']);
    }
    return null;
  }

  Future<EscalationChain?> getEscalationChain(String ticketId) async {
    try {
      final response = await _apiService.get('/tickets/$ticketId/escalation-chain');
      if (response != null && response['success'] == true) {
        return EscalationChain.fromJson(response['data'] as Map<String, dynamic>);
      }
    } catch (e) {
      debugPrint('GET escalation-chain ERROR: $e');
    }
    return null;
  }
}

// ── Escalation chain models ────────────────────────────────────────────────────

class EscalationChainStep {
  final int level;
  final String label;
  final String assigneeName;
  final String assigneeRole;
  final bool isActive;
  final bool isCompleted;
  final DateTime? assignedAt;
  final DateTime? escalatesAt;
  final DateTime? estimatedEscalationAt;
  final int? slaHours;

  const EscalationChainStep({
    required this.level,
    required this.label,
    required this.assigneeName,
    required this.assigneeRole,
    required this.isActive,
    required this.isCompleted,
    this.assignedAt,
    this.escalatesAt,
    this.estimatedEscalationAt,
    this.slaHours,
  });

  factory EscalationChainStep.fromJson(Map<String, dynamic> json) {
    return EscalationChainStep(
      level: json['level'] as int,
      label: json['label']?.toString() ?? '',
      assigneeName: json['assigneeName']?.toString() ?? 'Unassigned',
      assigneeRole: json['assigneeRole']?.toString() ?? '',
      isActive: json['isActive'] as bool? ?? false,
      isCompleted: json['isCompleted'] as bool? ?? false,
      assignedAt: json['assignedAt'] != null ? DateTime.parse(json['assignedAt']).toLocal() : null,
      escalatesAt: json['escalatesAt'] != null ? DateTime.parse(json['escalatesAt']).toLocal() : null,
      estimatedEscalationAt: json['estimatedEscalationAt'] != null
          ? DateTime.parse(json['estimatedEscalationAt']).toLocal()
          : null,
      slaHours: json['slaHours'] as int?,
    );
  }
}

class EscalationChain {
  final int currentLevel;
  final int status;
  final List<EscalationChainStep> chain;

  const EscalationChain({
    required this.currentLevel,
    required this.status,
    required this.chain,
  });

  factory EscalationChain.fromJson(Map<String, dynamic> json) {
    return EscalationChain(
      currentLevel: json['currentLevel'] as int? ?? 1,
      status: json['status'] as int? ?? 0,
      chain: (json['chain'] as List<dynamic>? ?? [])
          .map((e) => EscalationChainStep.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
