import re
import os

file_path = r"lib/screens/staff/staff_tickets.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove _demoTickets initialization
content = re.sub(
    r"void _initDemoTickets\(\) \{.*?\}\n\n  void _runEscalationCheck",
    "void _initDemoTickets() {}\n\n  void _runEscalationCheck",
    content,
    flags=re.DOTALL
)

# 2. Fix escalationHistory.add (Level 2)
content = re.sub(
    r"escalationHistory\.add\(\{\s*'from': oldAssignee,\s*'to': 'Level 2',\s*'timestamp': escalationTime\.toIso8601String\(\),\s*'reason': 'Unresolved after 24 hours — auto-escalated to Level 2',\s*\}\);",
    r"escalationHistory.add(TicketUpdate(message: 'Unresolved after 24 hours — auto-escalated to Level 2', timestamp: escalationTime, updatedBy: 'System'));",
    content,
    flags=re.DOTALL
)

# Fix escalationHistory.add (Level 3)
content = re.sub(
    r"escalationHistory\.add\(\{\s*'from': 'Level 2',\s*'to': 'Level 3',\s*'timestamp': escalationTime\.toIso8601String\(\),\s*'reason': 'Unresolved after \$escalationThreshold hours — auto-escalated to Principal',\s*\}\);",
    r"escalationHistory.add(TicketUpdate(message: 'Unresolved after $escalationThreshold hours — auto-escalated to Principal', timestamp: escalationTime, updatedBy: 'System'));",
    content,
    flags=re.DOTALL
)

# 3. Fix status assignments
# Because my previous script did complaint.statusLabel = 'Closed', etc.
content = content.replace("complaint.statusLabel = 'Closed'", "complaint.status = TicketStatus.closed")
content = content.replace("complaint.statusLabel = 'Resolved'", "complaint.status = TicketStatus.resolved")
content = content.replace("complaint.statusLabel = 'In Progress'", "complaint.status = TicketStatus.inProgress")
content = content.replace("complaint.statusLabel = 'Escalated'", "complaint.status = TicketStatus.escalatedL2")

# 4. Fix TicketUpdate map access
# E.g. update['edited']
content = re.sub(r"(\w+)\[\'edited\'\]\s*\?\?\s*false", r"false", content)
content = re.sub(r"(\w+)\[\'edited\'\]", r"false", content)
content = re.sub(r"(\w+)\[\'timestamp\'\]\s*as\s*String", r"\1.timestamp.toIso8601String()", content)
content = re.sub(r"(\w+)\[\'timestamp\'\]", r"\1.timestamp.toIso8601String()", content)
content = re.sub(r"(\w+)\[\'author\'\]", r"\1.updatedBy", content)
content = re.sub(r"(\w+)\[\'role\'\]", r"'Staff'", content)
content = re.sub(r"(\w+)\[\'text\'\]", r"\1.message", content)
content = re.sub(r"(\w+)\[\'reason\'\]", r"\1.message", content)

# 5. Fix newRemarks
content = content.replace(
    "void Function(List<Map<String, dynamic>> newRemarks) onRemarksUpdated;",
    "void Function(List<TicketUpdate> newRemarks) onRemarksUpdated;"
)
content = content.replace(
    "final void Function(List<Map<String, dynamic>> newRemarks)? onRemarksUpdated;",
    "final void Function(List<TicketUpdate> newRemarks)? onRemarksUpdated;"
)

# 6. Some more assignments
content = re.sub(r"complaint\.statusLabel\s*=\s*newStatus", r"complaint.status = _mapStringToStatus(newStatus)", content)
content = re.sub(r"widget\.ticket\.updates\s*=\s*remarks", r"widget.ticket.updates = remarks", content)

# Fix some ticket map accesses like ticket['id'] if they slipped through
content = re.sub(r"ticket\[\'id\'\]", r"ticket.id", content)
content = re.sub(r"ticket\[\'status\'\]", r"ticket.statusLabel", content)

# Remove the map conversion error in _DemoTicketCard onRemarksUpdated
content = content.replace(
    "void Function(List<dynamic> newRemarks) onRemarksUpdated;",
    "void Function(List<TicketUpdate> newRemarks) onRemarksUpdated;"
)
content = content.replace(
    "void Function(List<Map<String, dynamic>>) onRemarksUpdated;",
    "void Function(List<TicketUpdate>) onRemarksUpdated;"
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("staff_tickets fixed part 2")
