const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_dashboard.dart');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/final List<Map<String, dynamic>> _staffComplaints = \[\];/g, 'final List<Ticket> _staffComplaints = [];');
content = content.replace(/complaint\['title'\] as String/g, 'complaint.title');
content = content.replace(/complaint\['title'\]/g, 'complaint.title');

fs.writeFileSync(file, content);

let ticketsFile = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let tContent = fs.readFileSync(ticketsFile, 'utf8');

// Fix 2525
tContent = tContent.replace(/final Map<String, dynamic> ticket;/g, 'final Ticket ticket;');

// fix 2036
tContent = tContent.replace(/final void Function\(Map<String, dynamic> complaint\) onComplaintSubmitted;/g, 'final void Function(Ticket complaint) onComplaintSubmitted;');

// fix the array types
tContent = tContent.replace(/List<Map<String, dynamic>> _demoTickets =/g, 'List<Ticket> _demoTickets =');

fs.writeFileSync(ticketsFile, tContent);
console.log('Migration step 6 complete');
