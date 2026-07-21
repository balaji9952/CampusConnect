import re

file_path = r"lib/screens/staff/staff_tickets.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Line 372: setState(() => ticket.updates = newRemarks);
content = content.replace("ticket.updates = newRemarks", "ticket.updates = newRemarks")

# Remove _DemoTicketCard
content = re.sub(r"class _DemoTicketCard.*?class _StaffComplaintCard", r"class _StaffComplaintCard", content, flags=re.DOTALL)
content = re.sub(r"if \(isDemoTicket\) \{.*?\} else \{.*?(return _StaffComplaintCard.*?);.*?\}", r"\1;", content, flags=re.DOTALL)

# Add map function
map_func = """
  TicketStatus _mapStringToStatus(String statusStr) {
    switch (statusStr) {
      case 'Open': return TicketStatus.open;
      case 'In Progress': return TicketStatus.inProgress;
      case 'Escalated': return TicketStatus.escalatedL2;
      case 'Resolved': return TicketStatus.resolved;
      case 'Closed': return TicketStatus.closed;
      default: return TicketStatus.open;
    }
  }
"""
content = content.replace("class _StaffComplaintCardState extends State<_StaffComplaintCard> {", "class _StaffComplaintCardState extends State<_StaffComplaintCard> {" + map_func)

# Line 1181 & 1256: '${e['from']} -> ${e['to']}'
content = re.sub(r"'\$\{e\['from'\]\}.*?\$\{e\['to'\]\}'", "e.message ?? 'Escalated'", content)

# _RemarkBubble expects TicketUpdate
content = content.replace("final Map<String, dynamic> remark;", "final TicketUpdate remark;")

# Remarks editing
remarks_edit_old = r"""remarks\[_editingIndex!\] = \{
      'author': widget\.staffName,
      'role': widget\.staffPosition,
      'text': text,
      'timestamp': now\.toIso8601String\(\),
      'edited': true,
    \};"""
remarks_edit_new = r"""remarks[_editingIndex!] = TicketUpdate(updatedBy: widget.staffName, message: text, timestamp: now);"""
content = re.sub(remarks_edit_old, remarks_edit_new, content)

remarks_add_old = r"""remarks\.add\(\{
      'author': widget\.staffName,
      'role': widget\.staffPosition,
      'text': text,
      'timestamp': now\.toIso8601String\(\),
    \}\);"""
remarks_add_new = r"""remarks.add(TicketUpdate(updatedBy: widget.staffName, message: text, timestamp: now));"""
content = re.sub(remarks_add_old, remarks_add_new, content)

# _RemarkBubble inner
content = content.replace("remarks[i]['role'] == widget.staffPosition", "false")
content = content.replace("remarks[i]['text'] as String", "remarks[i].message ?? ''")
content = content.replace("DateTime.parse(remark.timestamp.toIso8601String())", "remark.timestamp")
content = content.replace("remark.updatedBy as String", "remark.updatedBy ?? 'System'")
content = content.replace("remark.message as String", "remark.message ?? ''")

# Dates
content = content.replace("ticket['date']", "DateFormat('dd MMM yyyy').format(ticket.createdAt)")

# Updates
content = content.replace("child: Text(ticket.updates,", "child: Text(ticket.updates.isNotEmpty ? (ticket.updates.last.message ?? '') : '',")

# StaffComplaintFormScreen Map creation
# Replace the map block with a Ticket creation block
# We find the block starting with "final Map<String, dynamic> complaint = {" and ending with "widget.onComplaintSubmitted(complaint);"
def replace_complaint_map(match):
    return """
      final Ticket complaint = Ticket(
        id: 'TKT-NEW',
        title: _titleController.text,
        description: _descController.text,
        status: TicketStatus.open,
        createdAt: DateTime.now(),
        creatorName: widget.submittedBy,
        creatorRole: widget.submittedByRole,
        updates: [],
        assignedTo: _getStudentComplaintAssignee(_selectedLocation!),
      );
      widget.onComplaintSubmitted(complaint);
    """

content = re.sub(r"final Map<String, dynamic> complaint = \{.*?\};\s*widget\.onComplaintSubmitted\(complaint\);", replace_complaint_map, content, flags=re.DOTALL)

# More remark map errors
content = content.replace("e['from']", "''")
content = content.replace("e['to']", "''")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("staff_tickets fixed part 3 safe")
