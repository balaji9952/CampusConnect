const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/final updatedBy = r\['author'\] as String;/g, 'final updatedBy = r.updatedBy;');
content = content.replace(/final role = r\['role'\] as String;/g, 'final role = "Staff";'); // role is removed
content = content.replace(/final text = r\['text'\] as String;/g, 'final text = r.message;');
content = content.replace(/final timestampStr = r\['timestamp'\] as String;/g, 'final timestampStr = r.timestamp.toIso8601String();');
content = content.replace(/final isEdited = \(r\['edited'\] as bool\?\) \?\? false;/g, 'final isEdited = false;');

content = content.replace(/final updatedBy = r\['author'\]/g, 'final updatedBy = r.updatedBy');
content = content.replace(/final role = r\['role'\]/g, 'final role = "Staff"');
content = content.replace(/final text = r\['text'\]/g, 'final text = r.message');
content = content.replace(/final timestampStr = r\['timestamp'\]/g, 'final timestampStr = r.timestamp.toIso8601String()');

content = content.replace(/update\['author'\]/g, 'update.updatedBy');
content = content.replace(/update\['role'\]/g, '"Staff"');
content = content.replace(/update\['text'\]/g, 'update.message');
content = content.replace(/update\['message'\]/g, 'update.message');
content = content.replace(/update\['timestamp'\]/g, 'update.timestamp.toIso8601String()');
content = content.replace(/update\['edited'\]/g, 'false');

content = content.replace(/final update = widget\.escalationHistory\[index\];/g, 'final update = widget.escalationHistory[index];');

content = content.replace(/ticket\['category'\]/g, 'ticket.category');
content = content.replace(/ticket\['id'\]/g, 'ticket.id');
content = content.replace(/ticket\['status'\]/g, 'ticket.statusLabel');
content = content.replace(/ticket\['title'\]/g, 'ticket.title');
content = content.replace(/ticket\['location'\]/g, 'ticket.location');
content = content.replace(/ticket\['description'\]/g, 'ticket.description');

content = content.replace(/final status = ticket\['status'\] as String;/g, 'final status = ticket.statusLabel;');
content = content.replace(/final category = ticket\['category'\] as String;/g, 'final category = ticket.category;');
content = content.replace(/final title = ticket\['title'\] as String;/g, 'final title = ticket.title;');

fs.writeFileSync(file, content);
console.log('Migration step 7 complete');
