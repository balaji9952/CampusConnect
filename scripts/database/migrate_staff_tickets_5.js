const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let content = fs.readFileSync(file, 'utf8');

// Fix 1614 etc
content = content.replace(/ticket\['createdAt'\] as DateTime/g, 'ticket.createdAt');
content = content.replace(/ticket\['createdAt'\]/g, 'ticket.createdAt');

content = content.replace(/ticket\['isDemoTicket'\] as bool\? \?\? false/g, 'false');
content = content.replace(/ticket\['isDemoTicket'\]/g, 'false');
content = content.replace(/ticket\['escalationHistory'\] as List<TicketUpdate>/g, '[]');
content = content.replace(/ticket\['escalationHistory'\] as List<Map<String, dynamic>>/g, '[]');
content = content.replace(/ticket\['escalationHistory'\]/g, '[]');
content = content.replace(/ticket\['remarks'\] as List<TicketUpdate>/g, 'ticket.updates');
content = content.replace(/ticket\['remarks'\] as List<Map<String, dynamic>>/g, 'ticket.updates');
content = content.replace(/ticket\['remarks'\]/g, 'ticket.updates');

content = content.replace(/ticket\['submittedAt'\] as DateTime/g, 'ticket.createdAt');
content = content.replace(/ticket\['submittedAt'\]/g, 'ticket.createdAt');
content = content.replace(/ticket\['imagePath'\] as String\?/g, 'ticket.photoUrl');
content = content.replace(/ticket\['imagePath'\]/g, 'ticket.photoUrl');
content = content.replace(/ticket\['assignedTo'\] as String/g, 'ticket.assignedTo');
content = content.replace(/ticket\['assignedTo'\]/g, 'ticket.assignedTo');

content = content.replace(/final status = ticket\.statusLabel as String;/g, 'final status = ticket.statusLabel;');

// Fix argument type 'Map<String, dynamic>' can't be assigned to the parameter type 'Ticket'
content = content.replace(/Map<String, dynamic>\s+ticket/g, 'Ticket ticket');
content = content.replace(/Map<String, dynamic>\s+complaint/g, 'Ticket complaint');
content = content.replace(/Map<String, dynamic>\s+_complaint/g, 'Ticket _complaint');

// 2525: Argument Map<String, dynamic> cannot be assigned to Ticket
// We need to fix usages like `ticket: {}`? Wait.
content = content.replace(/final Map<String, dynamic> ticket;/g, 'final Ticket ticket;');
content = content.replace(/Ticket\? ticket;/g, 'Ticket? ticket;');
content = content.replace(/List<Map<String, dynamic>> _demoTickets/g, 'List<Ticket> _demoTickets');

// In staff_dashboard.dart
let dashFile = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_dashboard.dart');
let dashContent = fs.readFileSync(dashFile, 'utf8');
dashContent = dashContent.replace(/Map<String, dynamic>\s+ticket/g, 'Ticket ticket');
dashContent = dashContent.replace(/ticket\['submittedAt'\] as DateTime/g, 'ticket.createdAt');
dashContent = dashContent.replace(/ticket\['submittedAt'\]/g, 'ticket.createdAt');
fs.writeFileSync(dashFile, dashContent);

fs.writeFileSync(file, content);
console.log('Migration step 5 complete');
