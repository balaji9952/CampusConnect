const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let content = fs.readFileSync(file, 'utf8');

// More fixes for Ticket access instead of Map
content = content.replace(/complaint\.assignedToId/g, 'complaint.assignedTo');
content = content.replace(/_getStudentComplaintAssignee\(complaint\.location as String\? \?\? ''\)/g, "_getStudentComplaintAssignee(complaint.location)");

// Fix timeline update types
content = content.replace(/List<Map<String, dynamic>> escalationHistory/g, 'List<TicketUpdate> escalationHistory');
content = content.replace(/final events = <Map<String, dynamic>>\[/g, 'final events = <dynamic>[');
content = content.replace(/e\['from'\]/g, "''");
content = content.replace(/e\['to'\]/g, "e.updatedBy");
content = content.replace(/e\['reason'\] as String/g, "e.message");
content = content.replace(/DateTime\.parse\(e\['timestamp'\] as String\)/g, "e.timestamp");

content = content.replace(/Map<String, dynamic> remark;/g, 'TicketUpdate remark;');
content = content.replace(/List<Map<String, dynamic>> remarks = widget\.complaint\.updates;/g, 'List<TicketUpdate> remarks = widget.complaint.updates;');
content = content.replace(/List<Map<String, dynamic>> escalationHistory = \[]/g, 'List<TicketUpdate> escalationHistory = []');

content = content.replace(/remark = \{\n[^\}]+timestamp:[^\}]+message:[^\}]+\};/g, "remark = TicketUpdate(message: _remarkController.text, timestamp: DateTime.now(), updatedBy: widget.staffName);");
content = content.replace(/widget\.onRemarkAdded\(remark\);/g, "widget.onRemarkAdded(remark);");
content = content.replace(/remark\['timestamp'\] as DateTime/g, "remark.timestamp");
content = content.replace(/remark\['message'\] as String/g, "remark.message");
content = content.replace(/remark\['author'\] as String/g, "remark.updatedBy");

content = content.replace(/complaint\['id'\]/g, "complaint.id");
content = content.replace(/complaint\['title'\]/g, "complaint.title");
content = content.replace(/complaint\['location'\]/g, "complaint.location");
content = content.replace(/complaint\['status'\]/g, "complaint.statusLabel");
content = content.replace(/complaint\['description'\]/g, "complaint.description");
content = content.replace(/complaint\['priority'\]/g, "complaint.priorityLabel");
content = content.replace(/complaint\['category'\]/g, "complaint.category");
content = content.replace(/complaint\['hasPhoto'\] \?\? false/g, "complaint.hasPhoto");
content = content.replace(/complaint\['hasPhoto'\] as bool\? \?\? false/g, "complaint.hasPhoto");
content = content.replace(/complaint\['photoUrl'\]/g, "complaint.photoUrl");

content = content.replace(/ticket\['id'\]/g, "ticket.id");
content = content.replace(/ticket\['title'\]/g, "ticket.title");
content = content.replace(/ticket\['location'\]/g, "ticket.location");
content = content.replace(/ticket\['status'\]/g, "ticket.statusLabel");
content = content.replace(/ticket\['description'\]/g, "ticket.description");
content = content.replace(/ticket\['priority'\]/g, "ticket.priorityLabel");
content = content.replace(/ticket\['category'\]/g, "ticket.category");
content = content.replace(/ticket\['hasPhoto'\] \?\? false/g, "ticket.hasPhoto");
content = content.replace(/ticket\['photoUrl'\]/g, "ticket.photoUrl");

content = content.replace(/Map<String, dynamic> _complaint;/g, 'Ticket _complaint;');
content = content.replace(/_complaint\['status'\]/g, '_complaint.statusLabel');
content = content.replace(/_complaint\['remarks'\] as List<Map<String, dynamic>>/g, '_complaint.updates');

fs.writeFileSync(file, content);
console.log('Migration step 2 complete');
