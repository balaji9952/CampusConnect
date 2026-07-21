const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/complaint\['submittedBy'\]/g, 'complaint.creatorName');
content = content.replace(/complaint\['submittedByRole'\]/g, 'complaint.creatorRole');
content = content.replace(/ticket\['submittedBy'\]/g, 'ticket.creatorName');
content = content.replace(/ticket\['submittedByRole'\]/g, 'ticket.creatorRole');

// Fix 1068
// The argument type 'List<dynamic>' can't be assigned to the parameter type 'List<TicketUpdate>'.
//       ...escalationHistory.map((e) => {
// We replaced it with a Map<String, dynamic> earlier!
// But wait! _buildTimeline takes (Ticket complaint, List<TicketUpdate> escalationHistory)
// And we map it to `final events = <Map<String, dynamic>>[...]`
// That part is probably correct, but wait, maybe the parameter `escalationHistory` isn't used properly.
content = content.replace(/Widget _buildTimeline\(Ticket complaint,\s*List<TicketUpdate> escalationHistory\)/g, 'Widget _buildTimeline(Ticket complaint, List<dynamic> escalationHistory)');

// Fix 1220 and 1229
// A value of type 'Map<String, Object>' can't be assigned to a variable of type 'TicketUpdate'
content = content.replace(/ticketUpdate = \{\n[^\}]+timestamp:[^\}]+message:[^\}]+\};/g, 'ticketUpdate = TicketUpdate(message: _remarkController.text, timestamp: DateTime.now(), updatedBy: widget.staffName);');

// Fix 1341
// The operator '[]' isn't defined for the type 'TicketUpdate'
content = content.replace(/final updatedBy = r\['author'\]/g, 'final updatedBy = r.updatedBy');
content = content.replace(/final updatedBy = r\['updatedBy'\]/g, 'final updatedBy = r.updatedBy');
content = content.replace(/r\['message'\]/g, 'r.message');
content = content.replace(/r\['timestamp'\]/g, 'r.timestamp');
content = content.replace(/update\['message'\]/g, 'update.message');
content = content.replace(/update\['timestamp'\]/g, 'update.timestamp');
content = content.replace(/update\['author'\]/g, 'update.updatedBy');
content = content.replace(/update\['updatedBy'\]/g, 'update.updatedBy');
content = content.replace(/_complaint\['title'\]/g, '_complaint.title');
content = content.replace(/_complaint\['assignedTo'\]/g, '_complaint.assignedTo');
content = content.replace(/_complaint\['location'\]/g, '_complaint.location');
content = content.replace(/_complaint\['category'\]/g, '_complaint.category');
content = content.replace(/_complaint\['description'\]/g, '_complaint.description');

fs.writeFileSync(file, content);
console.log('Migration step 4 complete');
