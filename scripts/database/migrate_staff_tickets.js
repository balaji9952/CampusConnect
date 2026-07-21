const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let content = fs.readFileSync(file, 'utf8');

// Replace Map<String, dynamic> complaint with Ticket complaint
content = content.replace(/Map<String, dynamic>\s*complaint/g, 'Ticket complaint');
content = content.replace(/Map<String, dynamic>\s*ticket/g, 'Ticket ticket');

// Replace complaint['id'] -> complaint.id
content = content.replace(/complaint\['id'\] as String/g, 'complaint.id');
content = content.replace(/complaint\['title'\] as String/g, 'complaint.title');
content = content.replace(/complaint\['location'\] as String/g, 'complaint.location');
content = content.replace(/complaint\['category'\] as String/g, 'complaint.category');
content = content.replace(/complaint\['description'\] as String/g, 'complaint.description');
content = content.replace(/complaint\['priority'\]/g, 'complaint.priorityLabel');
content = content.replace(/complaint\['status'\] as String/g, 'complaint.statusLabel');
content = content.replace(/complaint\['status'\]/g, 'complaint.statusLabel');
content = content.replace(/complaint\['submittedBy'\] as String/g, 'complaint.creatorName');
content = content.replace(/complaint\['submittedAt'\] as DateTime/g, 'complaint.createdAt');
content = content.replace(/complaint\['createdAt'\] as DateTime/g, 'complaint.createdAt');
content = content.replace(/complaint\['imagePath'\] as String\?/g, 'complaint.photoUrl');
content = content.replace(/complaint\['escalationHistory'\] as List<Map<String, dynamic>>/g, '[]');
content = content.replace(/complaint\['remarks'\] as List<Map<String, dynamic>>/g, 'complaint.updates');
content = content.replace(/complaint\['isDemoTicket'\] as bool\? \?\? false/g, 'false');
content = content.replace(/complaint\['assignedTo'\] as String/g, 'complaint.assignedTo');
content = content.replace(/complaint\['assignedToId'\]/g, 'complaint.assignedTo');
content = content.replace(/complaint\.locationName/g, 'complaint.location');

content = content.replace(/widget\.complaint\['status'\] as String/g, 'widget.complaint.statusLabel');
content = content.replace(/widget\.complaint\['remarks'\] as List<Map<String, dynamic>>/g, 'widget.complaint.updates');

fs.writeFileSync(file, content);
console.log('Migration complete');
