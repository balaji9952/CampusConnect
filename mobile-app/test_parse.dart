import 'dart:convert';
import 'lib/models/ticket.dart';

void main() {
  final jsonString = '''
  {
      "id": "538766a3-5627-4718-b914-13832f",
      "title": "Test complaint",
      "description": "Test complaint",
      "location_id": 1,
      "location_name": "Academic Block",
      "category_id": 1,
      "category_name": "Infrastructure",
      "priority": 1,
      "status": 0,
      "escalation_level": 1,
      "assigned_to_name": null,
      "assigned_role": null,
      "has_photo": false,
      "photo_url": null,
      "creator_id": "0d3e2e03-9640-4fc3-935a-cbaf44540fd1",
      "creator_name": "Balaji",
      "creator_role": "Student",
      "resolved_at": null,
      "closed_at": null,
      "created_at": "2026-06-06T12:21:43.404Z",
      "updated_at": "2026-06-06T12:21:43.404Z",
      "is_deleted": false,
      "deleted_at": null,
      "locations": {
        "id": 1,
        "name": "Academic Block",
        "block": "Main Block",
        "floor": null,
        "department_id": null,
        "is_active": true,
        "created_at": "2026-06-05T16:51:25.539Z"
      },
      "complaint_categories": {
        "id": 1,
        "name": "Infrastructure",
        "description": "Building, walls, doors, windows, roof issues",
        "icon": "business",
        "sort_order": 1,
        "is_active": true,
        "created_at": "2026-06-05T16:51:25.630Z"
      }
    }
  ''';

  final jsonMap = jsonDecode(jsonString);
  try {
    final ticket = Ticket.fromJson(jsonMap);
    print('SUCCESS! Ticket parsed: \${ticket.id} \${ticket.title}');
  } catch (e, st) {
    print('ERROR PARSING TICKET: \$e');
    print(st);
  }
}
