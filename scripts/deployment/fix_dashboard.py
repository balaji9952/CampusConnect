import re
import os

file_path = r"lib/screens/staff/staff_dashboard.dart"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# _staffComplaints should be List<Ticket>
content = content.replace("List<Map<String, dynamic>> _staffComplaints = [];", "List<Ticket> _staffComplaints = [];")

# map access
content = re.sub(r"complaint\['title'\]\s*as\s*String", r"complaint.title", content)
content = re.sub(r"complaint\['title'\]", r"complaint.title", content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("staff_dashboard fixed")
