const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_dashboard.dart');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Map<String, dynamic> ticket;/g, 'Ticket ticket;');
content = content.replace(/ticket\['id'\]/g, 'ticket.id');
content = content.replace(/ticket\['title'\]/g, 'ticket.title');
content = content.replace(/ticket\['location'\]/g, 'ticket.location');
content = content.replace(/ticket\['status'\]/g, 'ticket.statusLabel');
content = content.replace(/ticket\['description'\]/g, 'ticket.description');
content = content.replace(/ticket\['priority'\]/g, 'ticket.priorityLabel');
content = content.replace(/ticket\['category'\]/g, 'ticket.category');

fs.writeFileSync(file, content);

file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
content = fs.readFileSync(file, 'utf8');

// Fix 762: 'isDemo' is no longer in Ticket. 'complaint.isDemo' is invalid.
// Let's replace:
// bool canEditStatus = false;
// final isDemo = false;
// String assignedTo;
content = content.replace(/final isDemo = false;/g, '');
content = content.replace(/if \(isDemo\) \{[\s\S]*?\} else \{/g, '{');

content = content.replace(/final events = <dynamic>\[/g, 'final events = <TicketUpdate>[');
// Fix 1079
//  ...escalationHistory.map((e) => {
//        'label': 'Escalated: ${''} \u2192 ${e.updatedBy}',
//        'sub': e.message,
//        'ts': e.timestamp,
//        'icon': Icons.arrow_upward_rounded,
//        'color': const Color(0xFFEA580C),
//      }),
// We can just avoid spreading dynamic maps!

content = content.replace(/final events = <TicketUpdate>\[[\s\S]*?\];/g, `
    final events = <Map<String, dynamic>>[
      {
        'label': 'Complaint Submitted',
        'sub': 'Assigned to Admin',
        'ts': submittedAt,
        'icon': Icons.add_circle_rounded,
        'color': const Color(0xFF2563EB),
      },
      ...escalationHistory.map((e) => {
            'label': 'Update by \${e.updatedBy}',
            'sub': e.message,
            'ts': e.timestamp,
            'icon': Icons.info_outline_rounded,
            'color': const Color(0xFFEA580C),
          }),
    ];
`);

// fix remaining map accesses
content = content.replace(/ev\['color'\]/g, "(ev['color'] as Color)");
content = content.replace(/ev\['icon'\]/g, "(ev['icon'] as IconData)");
content = content.replace(/ev\['label'\]/g, "(ev['label'] as String)");
content = content.replace(/ev\['sub'\]/g, "(ev['sub'] as String)");
content = content.replace(/ev\['ts'\]/g, "(ev['ts'] as DateTime)");
content = content.replace(/\(ev\['color'\] as Color\) as Color/g, "(ev['color'] as Color)");
content = content.replace(/\(ev\['icon'\] as IconData\) as IconData/g, "(ev['icon'] as IconData)");
content = content.replace(/\(ev\['label'\] as String\) as String/g, "(ev['label'] as String)");
content = content.replace(/\(ev\['sub'\] as String\) as String/g, "(ev['sub'] as String)");
content = content.replace(/\(ev\['ts'\] as DateTime\) as DateTime/g, "(ev['ts'] as DateTime)");

// Fix 1229 and 1238
content = content.replace(/ticketUpdate = \{\n[^\}]+\};/g, 'ticketUpdate = TicketUpdate(message: _remarkController.text, timestamp: DateTime.now(), updatedBy: widget.staffName);');

content = content.replace(/List<Map<String, dynamic>> updates = widget\.ticket\.updates;/g, 'List<TicketUpdate> updates = widget.ticket.updates;');

// Fix remaining widget.complaint...
content = content.replace(/widget\.complaint\['id'\]/g, 'widget.complaint.id');
content = content.replace(/widget\.complaint\['title'\]/g, 'widget.complaint.title');
content = content.replace(/widget\.complaint\['location'\]/g, 'widget.complaint.location');
content = content.replace(/widget\.complaint\['description'\]/g, 'widget.complaint.description');
content = content.replace(/widget\.complaint\['priority'\]/g, 'widget.complaint.priorityLabel');
content = content.replace(/widget\.complaint\['status'\]/g, 'widget.complaint.statusLabel');

content = content.replace(/widget\.ticket\['id'\]/g, 'widget.ticket.id');
content = content.replace(/widget\.ticket\['title'\]/g, 'widget.ticket.title');
content = content.replace(/widget\.ticket\['location'\]/g, 'widget.ticket.location');
content = content.replace(/widget\.ticket\['description'\]/g, 'widget.ticket.description');
content = content.replace(/widget\.ticket\['priority'\]/g, 'widget.ticket.priorityLabel');
content = content.replace(/widget\.ticket\['status'\]/g, 'widget.ticket.statusLabel');

content = content.replace(/final Map<String, dynamic> _complaint;/g, 'final Ticket _complaint;');
content = content.replace(/Map<String, dynamic> _complaint;/g, 'Ticket _complaint;');
content = content.replace(/Map<String, dynamic> ticket;/g, 'Ticket ticket;');
content = content.replace(/final Map<String, dynamic> ticket;/g, 'final Ticket ticket;');

// the event fixing above is solid
fs.writeFileSync(file, content);
console.log('Migration step 3 complete');
