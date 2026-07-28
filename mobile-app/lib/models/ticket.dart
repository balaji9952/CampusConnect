import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
enum TicketStatus { open, inProgress, resolved, ignored, closed }

enum TicketPriority { low, medium, high, critical }

class Ticket {
  final String id;
  final String? ticketNumber;   // Human-readable: TK-DDMMYY-CATEGORYID-ROLLNO
  final String title;
  final String location;
  final String category;
  final String description;
  final String ticketType; // 'COMPLAINT' or 'PARENT_FEEDBACK'
  final TicketPriority priority;
  final DateTime createdAt;
  DateTime updatedAt;
  TicketStatus status;
  String assignedTo;
  String assignedRole;
  int escalationLevel;
  List<TicketUpdate> updates;
  bool hasPhoto;
  String? photoUrl;
  
  // Creator fields
  final String creatorId;
  final String creatorName;
  final String creatorRole;
  // Location Category fields
  final int? locationCategoryId;
  final String? locationCategoryName;

  Ticket({
    required this.id,
    this.ticketNumber,
    required this.title,
    required this.location,
    required this.category,
    required this.description,
    this.ticketType = 'COMPLAINT',
    required this.priority,
    required this.createdAt,
    required this.updatedAt,
    this.status = TicketStatus.open,
    this.assignedTo = '',
    this.assignedRole = '',
    this.escalationLevel = 1,
    List<TicketUpdate>? updates,
    this.hasPhoto = false,
    this.photoUrl,
    required this.creatorId,
    required this.creatorName,
    required this.creatorRole,
    this.locationCategoryId,
    this.locationCategoryName,
  }) : updates = updates ?? [];

  Map<String, dynamic> toJson() => {
        'id': id,
        'ticket_number': ticketNumber,
        'title': title,
        'location': location,
        'category': category,
        'description': description,
        'ticketType': ticketType,
        'priority': priority.index,
        'createdAt': createdAt.toIso8601String(),
        'updatedAt': updatedAt.toIso8601String(),
        'status': status.index,
        'assignedTo': assignedTo,
        'assignedRole': assignedRole,
        'escalationLevel': escalationLevel,
        'updates': updates.map((u) => u.toJson()).toList(),
        'hasPhoto': hasPhoto,
        'photoUrl': photoUrl,
        'creatorId': creatorId,
        'creatorName': creatorName,
        'creatorRole': creatorRole,
        'locationCategoryId': locationCategoryId,
        'locationCategoryName': locationCategoryName,
      };

  factory Ticket.fromJson(Map<String, dynamic> json) {
    try {
      return Ticket(
        id: json['ticket_id']?.toString() ?? json['id']?.toString() ?? 'TKT-UNKNOWN',
        ticketNumber: json['ticket_number']?.toString(),
        title: json['title']?.toString() ?? 'No title',
        location: json['location_name']?.toString() ?? json['location']?.toString() ?? 'Unknown Location',
        category: json['category_name']?.toString() ?? json['category']?.toString() ?? 'Unknown Category',
        description: json['description']?.toString() ?? '',
        ticketType: json['ticket_type']?.toString() ?? json['ticketType']?.toString() ?? 'COMPLAINT',
        priority: json['priority'] != null 
            ? TicketPriority.values[json['priority'] as int] 
            : TicketPriority.medium,
        createdAt: DateTime.parse(json['created_at']?.toString() ?? json['createdAt']?.toString() ?? DateTime.now().toIso8601String()).toLocal(),
        updatedAt: DateTime.parse(json['updated_at']?.toString() ?? json['updatedAt']?.toString() ?? DateTime.now().toIso8601String()).toLocal(),
        status: json['status'] != null 
            ? TicketStatus.values[json['status'] as int] 
            : TicketStatus.open,
        assignedTo: json['assigned_to_name']?.toString() ?? json['assignedTo']?.toString() ?? 'Unassigned',
        assignedRole: json['assigned_role']?.toString() ?? json['assignedRole']?.toString() ?? '',
        escalationLevel: json['escalation_level'] as int? ?? json['escalationLevel'] as int? ?? 1,
        updates: (json['ticket_updates'] as List<dynamic>? ?? json['updates'] as List<dynamic>?)
                ?.map((u) => TicketUpdate.fromJson(u as Map<String, dynamic>))
                .toList() ??
            [],
        hasPhoto: json['has_photo'] as bool? ?? json['hasPhoto'] as bool? ?? false,
        photoUrl: json['photo_url']?.toString() ?? json['photoUrl']?.toString(),
        creatorId: json['creator_id']?.toString() ?? json['creatorId']?.toString() ?? 'Unknown',
        creatorName: json['creator_name']?.toString() ?? json['creatorName']?.toString() ?? 'Unknown',
        creatorRole: json['creator_role']?.toString() ?? json['creatorRole']?.toString() ?? 'Unknown',
        locationCategoryId: json['locationCategoryId'] as int?,
        locationCategoryName: json['locationCategoryName']?.toString(),
      );
    } catch (e, stackTrace) {
      debugPrint('TICKET PARSE ERROR for json: $json');
      debugPrint('Error: $e');
      debugPrint(stackTrace.toString());
      rethrow;
    }
  }

  String get statusLabel {
    if (escalationLevel > 1 && status != TicketStatus.resolved && status != TicketStatus.closed) {
      return 'Escalated';
    }
    switch (status) {
      case TicketStatus.open:
        return 'Open';
      case TicketStatus.inProgress:
        return 'In Progress';
      case TicketStatus.resolved:
        return 'Resolved';
      case TicketStatus.closed:
        return 'Closed';
      case TicketStatus.ignored:
        return 'Unknown';
    }
  }

  Color get statusColor {
    if (escalationLevel > 1 && status != TicketStatus.resolved && status != TicketStatus.closed) {
      return Colors.deepOrange;
    }
    switch (status) {
      case TicketStatus.open:
        return Colors.blue;
      case TicketStatus.inProgress:
        return Colors.orange;
      case TicketStatus.resolved:
        return Colors.green;
      case TicketStatus.closed:
        return Colors.grey;
      case TicketStatus.ignored:
        return Colors.grey;
    }
  }

  String get priorityLabel {
    switch (priority) {
      case TicketPriority.low:
        return 'Low';
      case TicketPriority.medium:
        return 'Medium';
      case TicketPriority.high:
        return 'High';
      case TicketPriority.critical:
        return 'Critical';
    }
  }
}

class TicketUpdate {
  final String message;
  final DateTime timestamp;
  final String updatedBy;
  final String updateType;

  TicketUpdate({
    required this.message,
    required this.timestamp,
    required this.updatedBy,
    this.updateType = 'update',
  });

  Map<String, dynamic> toJson() => {
        'message': message,
        'timestamp': timestamp.toIso8601String(),
        'updatedBy': updatedBy,
        'updateType': updateType,
      };

  factory TicketUpdate.fromJson(Map<String, dynamic> json) => TicketUpdate(
        message: json['message']?.toString() ?? '',
        timestamp: DateTime.parse(json['created_at']?.toString() ?? json['timestamp']?.toString() ?? DateTime.now().toIso8601String()).toLocal(),
        updatedBy: json['updated_by']?.toString() ?? json['updatedBy']?.toString() ?? 'System',
        updateType: json['update_type']?.toString() ?? json['updateType']?.toString() ?? 'update',
      );
}
