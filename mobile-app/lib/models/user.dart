enum UserRole { student, staff }

class AppUser {
  final String id;
  final String name;
  final String email;
  final String? password;

  final UserRole role;
  final String? department;
  final String? rollNo;       // student
  final String? wardName;     // parent
  final String? wardRollNo;   // parent
  final String? designation;  // staff
  final String? programType; // student
  final String? branch; // student
  final String? year; // student
  final String avatarUrl;
  final DateTime createdAt;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.password,

    required this.role,
    this.department,
    this.rollNo,
    this.wardName,
    this.wardRollNo,
    this.designation,
    this.programType,
    this.branch,
    this.year,
    this.avatarUrl = '',
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  String get roleLabel {
    switch (role) {
      case UserRole.student:
        return 'Student';
      case UserRole.staff:
        return 'Staff';
    }
  }

  String get initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'password': password,

        'role': role.index,
        'department': department,
        'rollNo': rollNo,
        'wardName': wardName,
        'wardRollNo': wardRollNo,
        'designation': designation,
        'programType': programType,
        'branch': branch,
        'year': year,
        'avatarUrl': avatarUrl,
        'createdAt': createdAt.toIso8601String(),
      };

  factory AppUser.fromJson(Map<String, dynamic> json) {
    print('[AppUser.fromJson] Parsing: $json');
    return AppUser(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      password: json['password']?.toString(),
      role: json['role'] != null
          ? (json['role'] is int
              ? (json['role'] >= 0 && json['role'] < UserRole.values.length
                  ? UserRole.values[json['role']]
                  : UserRole.student)
              : (json['role'].toString().toLowerCase().contains('staff') ? UserRole.staff : UserRole.student))
          : UserRole.student,
      department: (json['departmentName'] ?? json['department'])?.toString(),
      rollNo: json['rollNo']?.toString(),
      wardName: json['wardName']?.toString(),
      wardRollNo: json['wardRollNo']?.toString(),
      designation: json['designation']?.toString(),
      programType: json['programType']?.toString(),
      branch: json['branch']?.toString(),
      year: (json['studyYear'] ?? json['year'])?.toString(),
      avatarUrl: json['avatarUrl']?.toString() ?? '',
      createdAt: json['createdAt'] != null
          ? (DateTime.tryParse(json['createdAt'].toString())?.toLocal() ?? DateTime.now())
          : (json['created_at'] != null
              ? (DateTime.tryParse(json['created_at'].toString())?.toLocal() ?? DateTime.now())
              : DateTime.now()),
    );
  }
}
