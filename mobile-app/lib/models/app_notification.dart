class AppNotification {
  final String id;
  final String? userId;
  final String title;
  final String body;
  final String type;
  final String? ticketId;
  final bool isRead;
  final bool privilegedOnly;
  final DateTime createdAt;

  AppNotification({
    required this.id,
    this.userId,
    required this.title,
    required this.body,
    required this.type,
    this.ticketId,
    required this.isRead,
    required this.privilegedOnly,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      userId: json['user_id'] as String?,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String,
      ticketId: json['ticket_id'] as String?,
      isRead: json['is_read'] as bool? ?? false,
      privilegedOnly: json['privileged_only'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}
