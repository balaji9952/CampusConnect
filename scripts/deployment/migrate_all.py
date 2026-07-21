import re
import os

file_path = r"lib/screens/staff/staff_tickets.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Type Declarations
content = content.replace("List<Map<String, dynamic>> complaints;", "List<Ticket> complaints;")
content = content.replace("List<Map<String, dynamic>> _demoTickets;", "List<Ticket> _demoTickets;")
content = content.replace("List<Map<String, dynamic>> get _allTickets", "List<Ticket> get _allTickets")
content = content.replace("List<Map<String, dynamic>> get _filteredTickets", "List<Ticket> get _filteredTickets")

content = content.replace("Map<String, dynamic> complaint;", "Ticket complaint;")
content = content.replace("Map<String, dynamic> ticket;", "Ticket ticket;")
content = content.replace("Map<String, dynamic> _complaint", "Ticket _complaint")

# Fix method signatures
content = re.sub(r'Widget _buildTimeline\(Map<String, dynamic> complaint,\s*List<Map<String, dynamic>> escalationHistory\)', 'Widget _buildTimeline(Ticket complaint, List<TicketUpdate> escalationHistory)', content)
content = re.sub(r'Widget _buildTimeline\(Map<String, dynamic> complaint,\s*List<dynamic> escalationHistory\)', 'Widget _buildTimeline(Ticket complaint, List<TicketUpdate> escalationHistory)', content)
content = re.sub(r'final void Function\(Map<String, dynamic> complaint\) onComplaintSubmitted;', 'final void Function(Ticket complaint) onComplaintSubmitted;', content)
content = content.replace("final void Function(Map<String, dynamic> complaint) onComplaintSubmitted;", "final void Function(Ticket complaint) onComplaintSubmitted;")

# In constructor / methods
content = re.sub(r'\bMap<String, dynamic>\s+complaint\b', 'Ticket complaint', content)
content = re.sub(r'\bMap<String, dynamic>\s+ticket\b', 'Ticket ticket', content)

# 2. Map Key Accesses
# Since we have different variable names (ticket, complaint, _complaint), we match \w+
keys = {
    'title': 'title',
    'description': 'description',
    'location': 'location',
    'category': 'category',
    'status': 'statusLabel',
    'submittedBy': 'creatorName',
    'submittedByRole': 'creatorRole',
    'submittedAt': 'createdAt',
    'createdAt': 'createdAt',
    'assignedTo': 'assignedTo',
    'imagePath': 'photoUrl',
    'id': 'id'
}

for map_key, obj_prop in keys.items():
    content = re.sub(rf"(\w+)\['{map_key}'\]\s*as\s*String\?", rf"\1.{obj_prop}", content)
    content = re.sub(rf"(\w+)\['{map_key}'\]\s*as\s*String", rf"\1.{obj_prop}", content)
    content = re.sub(rf"(\w+)\['{map_key}'\]\s*as\s*DateTime", rf"\1.{obj_prop}", content)
    content = re.sub(rf"(\w+)\['{map_key}'\]", rf"\1.{obj_prop}", content)

# Special cases: remarks and escalationHistory
content = re.sub(r"(\w+)\['remarks'\]\s*as\s*List<Map<String, dynamic>>", r"\1.updates", content)
content = re.sub(r"(\w+)\['remarks'\]\s*as\s*List<dynamic>", r"\1.updates", content)
content = re.sub(r"(\w+)\['remarks'\]", r"\1.updates", content)

content = re.sub(r"(\w+)\['escalationHistory'\]\s*as\s*List<Map<String, dynamic>>", r"\1.updates", content)
content = re.sub(r"(\w+)\['escalationHistory'\]\s*as\s*List<dynamic>", r"\1.updates", content)
content = re.sub(r"(\w+)\['escalationHistory'\]", r"\1.updates", content)

content = re.sub(r"(\w+)\['isDemoTicket'\]\s*as\s*bool\?\s*\?\?\s*false", r"false", content)
content = re.sub(r"(\w+)\['isDemoTicket'\]", r"false", content)


# 3. TicketUpdate map conversions
content = re.sub(r"final updatedBy = r\['author'\](?:\s*as\s*String)?;", r"final updatedBy = r.updatedBy;", content)
content = re.sub(r"final role = r\['role'\](?:\s*as\s*String)?;", r"final role = 'Staff';", content)
content = re.sub(r"final text = r\['text'\](?:\s*as\s*String)?;", r"final text = r.message;", content)
content = re.sub(r"final timestampStr = r\['timestamp'\](?:\s*as\s*String)?;", r"final timestampStr = r.timestamp.toIso8601String();", content)
content = re.sub(r"final isEdited = \(r\['edited'\]\s*as\s*bool\?\)\s*\?\?\s*false;", r"final isEdited = false;", content)
content = re.sub(r"final isEdited = r\['edited'\]\s*\?\?\s*false;", r"final isEdited = false;", content)

# update map in events list
content = re.sub(r"update\['author'\](?:\s*as\s*String)?", r"update.updatedBy", content)
content = re.sub(r"update\['role'\](?:\s*as\s*String)?", r"'Staff'", content)
content = re.sub(r"update\['text'\](?:\s*as\s*String)?", r"update.message", content)
content = re.sub(r"update\['message'\](?:\s*as\s*String)?", r"update.message", content)
content = re.sub(r"update\['timestamp'\](?:\s*as\s*String)?", r"update.timestamp.toIso8601String()", content)

# 4. Remarks modification code replacement
remarks_edit_old = r"""    if \(_editingIndex != null\) \{
      remarks\[_editingIndex!\] = \{
        'author': widget.staffName,
        'role': widget.staffPosition,
        'text': text,
        'timestamp': now.toIso8601String\(\),
        'edited': true,
      \};
      _editingIndex = null;
    \} else \{
      remarks.add\(\{
        'author': widget.staffName,
        'role': widget.staffPosition,
        'text': text,
        'timestamp': now.toIso8601String\(\),
      \}\);
    \}"""

remarks_edit_new = """    if (_editingIndex != null) {
      remarks[_editingIndex!] = TicketUpdate(
        updatedBy: widget.staffName,
        message: text,
        timestamp: now,
      );
      _editingIndex = null;
    } else {
      remarks.add(TicketUpdate(
        updatedBy: widget.staffName,
        message: text,
        timestamp: now,
      ));
    }"""
content = re.sub(remarks_edit_old, remarks_edit_new, content)

# Demo ticket list -> Needs to be empty list of Tickets because we no longer support demo tickets
content = re.sub(r'List<Map<String, dynamic>> _demoTickets = \[.*?\];', r'List<Ticket> _demoTickets = [];', content, flags=re.DOTALL)
# Actually, the demo tickets list is huge.
content = re.sub(r'late List<Ticket> _demoTickets;.*?\n  void _generateDemoData\(\) \{.*?\n  \}', r'late List<Ticket> _demoTickets = [];\n  void _generateDemoData() {}', content, flags=re.DOTALL)

with open(file_path.replace(".dart", "_migrated.dart"), "w", encoding="utf-8") as f:
    f.write(content)

print("Migration script completed")
