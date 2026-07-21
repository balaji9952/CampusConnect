const fs = require('fs');
const path = require('path');

let file = path.join(__dirname, 'lib', 'screens', 'staff', 'staff_tickets.dart');
let lines = fs.readFileSync(file, 'utf8').split('\n');

// 1. Delete lines 1175 to 1238 (indices 1174 to 1237)
lines.splice(1174, 1238 - 1174 + 1);

// 2. Re-insert the missing state class declaration before `@override\n  void dispose() {`
let content = lines.join('\n');
content = content.replace(
  /\n  @override\n  void dispose\(\) \{/,
  '\nclass _StaffRemarksSheetState extends State<_StaffRemarksSheet> {\n  final TextEditingController _remarkController = TextEditingController();\n  int? _editingIndex;\n\n  @override\n  void dispose() {'
);

// 3. Fix the TicketUpdate creation manually
content = content.replace(
  /    if \(_editingIndex != null\) \{\n      remarks\[_editingIndex!\] = \{\n        'author': widget\.staffName,\n        'role': widget\.staffPosition,\n        'text': text,\n        'timestamp': now\.toIso8601String\(\),\n        'edited': true,\n      \};\n      _editingIndex = null;\n    \} else \{\n      remarks\.add\(\{\n        'author': widget\.staffName,\n        'role': widget\.staffPosition,\n        'text': text,\n        'timestamp': now\.toIso8601String\(\),\n        'edited': false,\n      \}\);\n    \}/g,
`    if (_editingIndex != null) {
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
    }`
);

fs.writeFileSync(file, content);
console.log('Fixed syntax error in _StaffRemarksSheetState');
