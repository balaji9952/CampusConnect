import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/models/user.dart';
import 'package:campus_connect/routes/role_router.dart';
import 'package:campus_connect/screens/auth/login_screen.dart';

// ─── Constants ───────────────────────────────────────────────────────────────

/// Departments available per UG branch.
const _branchDepartments = <String, List<String>>{
  'B.E': [
    'Civil Engineering',
    'Computer Science and Engineering',
    'Mechanical Engineering',
    'Electronics and Communication Engineering',
    'Electrical and Electronics Engineering',
  ],
  'B.Tech': [
    'Information Technology',
    'Artificial Intelligence and Data Science',
  ],
  // PG
  'M.BA': [
    'Master of Business Administration',
  ],
};

/// All departments (used for Staff registration).
const _allDepartments = [
  'Civil Engineering',
  'Computer Science and Engineering',
  'Mechanical Engineering',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Information Technology',
  'Artificial Intelligence and Data Science',
  'Master of Business Administration',
  'Others',
];

const _studyYears = ['I-Year', 'II-Year', 'III-Year', 'IV-Year'];

const _ugBranches = ['B.E', 'B.Tech'];
const _pgBranches = ['M.BA'];

const _staffPositions = [
  'Assistant Professor',
  'Office Manager',
  'Hostel Warden Boys',
  'Hostel Warden Girls',
  'Mess Warden Boys',
  'Mess Warden Girls',
  'Canteen Head',
  'HOD',
  'Principal',
  'Transport Head',
  'Sanitizing Head',
  'Library Head',
];

// ─── Screen ──────────────────────────────────────────────────────────────────

class RegisterScreen extends StatefulWidget {
  final AuthService authService;
  final TicketService ticketService;
  final UserRole role;

  const RegisterScreen({
    super.key,
    required this.authService,
    required this.ticketService,
    required this.role,
  });

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();

  // Common
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  // Student-specific
  String? _selectedBranchType; // 'UG' or 'PG'
  String? _selectedBranch;
  String? _selectedDepartment;
  String? _selectedStudyYear;
  final _registerNumberController = TextEditingController();

  // Staff-specific
  final _staffIdController = TextEditingController();
  String? _selectedStaffDepartment;
  String? _selectedPosition;

  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _registerNumberController.dispose();
    _staffIdController.dispose();
    super.dispose();
  }

  List<String> get _availableBranches {
    if (_selectedBranchType == 'UG') return _ugBranches;
    if (_selectedBranchType == 'PG') return _pgBranches;
    return [];
  }

  /// Returns departments for the currently selected branch, or empty list.
  List<String> get _availableDepartments {
    if (_selectedBranch == null) return [];
    return _branchDepartments[_selectedBranch!] ?? [];
  }

  /// M.BA is a 2-year PG programme; all UG branches are 4 years.
  List<String> get _availableStudyYears {
    if (_selectedBranch == 'M.BA') return const ['I-Year', 'II-Year'];
    return _studyYears; // I–IV Year for UG
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    // Role-specific validation
    if (widget.role == UserRole.student) {
      if (_selectedBranchType == null ||
          _selectedBranch == null ||
          _selectedDepartment == null ||
          _selectedStudyYear == null) {
        _showError('Please fill all required fields');
        return;
      }
    }
    if (widget.role == UserRole.staff) {
      if (_selectedStaffDepartment == null || _selectedPosition == null) {
        _showError('Please fill all required fields');
        return;
      }
    }

    setState(() => _isLoading = true);

    // Password confirmation check
    if (_passwordController.text.trim() != _confirmPasswordController.text.trim()) {
      _showError('Passwords do not match');
      setState(() => _isLoading = false);
      return;
    }

    final registerData = {
      'name': _nameController.text.trim(),
      'email': _emailController.text.trim(),
      'password': _passwordController.text.trim(),
      'role': widget.role.index,
      'department': widget.role == UserRole.student
          ? _selectedDepartment
          : _selectedStaffDepartment,
      'rollNo': widget.role == UserRole.student
          ? _registerNumberController.text.trim()
          : _staffIdController.text.trim(),
      'programType': widget.role == UserRole.student ? _selectedBranchType : null,
      'branch': widget.role == UserRole.student ? _selectedBranch : null,
      'studyYear': widget.role == UserRole.student ? _selectedStudyYear : null,
      'designation': widget.role == UserRole.staff ? _selectedPosition : null,
    };

    try {
      await widget.authService.register(registerData);

      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registration successful! Please login.'),
            backgroundColor: Colors.green,
          ),
        );
        // Navigate back to login screen
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showError(e.toString().replaceAll('ApiException: ', ''));
      }
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.accent),
    );
  }

  // ─── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final hPad = AppSpacing.horizontalPad(context);
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: AppColors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: hPad, vertical: 24),
            child: AppSpacing.constrained(
              context: context,
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Header ────────────────────────────────────────────
                    Text(
                      'Create Account',
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                                color: AppColors.textPrimary,
                                fontSize: AppSpacing.isCompact(context) ? 24.0 : null,
                              ),
                    ).animate().fadeIn().slideY(begin: 0.2),

                    SizedBox(height: AppSpacing.xs(context)),

                    Row(
                      children: [
                        Container(
                          padding: EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm(context), vertical: 6),
                          decoration: BoxDecoration(
                            gradient: AppColors.primaryGradient,
                            borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                          ),
                          child: Text(
                            _roleBadgeLabel(),
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: AppSpacing.fontCardTitle(context) - 2,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                        SizedBox(width: AppSpacing.xs(context)),
                        Text(
                          'Registration',
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontSize: AppSpacing.fontCardTitle(context),
                                  ),
                        ),
                      ],
                    ).animate(delay: 100.ms).fadeIn().slideY(begin: 0.2),

                    SizedBox(height: AppSpacing.xl(context)),

                    // ── Form Card ─────────────────────────────────────────
                    Container(
                      padding: AppSpacing.cardPadding(context),
                      decoration: BoxDecoration(
                        color: AppColors.bgCard,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: AppColors.border),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Role-specific fields
                          if (widget.role == UserRole.student)
                            _buildStudentFields()
                          else if (widget.role == UserRole.staff)
                            _buildStaffFields(),

                          SizedBox(height: AppSpacing.md(context)),
                          _buildPasswordField(),
                          SizedBox(height: AppSpacing.md(context)),
                          // Confirm Password field
                          TextFormField(
                            controller: _confirmPasswordController,
                            obscureText: _obscurePassword,
                            style: TextStyle(
                                color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
                            validator: (v) {
                              if (v == null || v.isEmpty)
                                return 'Confirm password required';
                              if (v != _passwordController.text)
                                return 'Passwords do not match';
                              return null;
                            },
                            decoration: InputDecoration(
                              labelText: 'Confirm Password',
                              labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
                              prefixIcon: Icon(
                                  Icons.lock_outline_rounded, size: AppSpacing.iconSm(context)),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: AppSpacing.iconSm(context),
                                ),
                                onPressed: () => setState(() =>
                                    _obscurePassword = !_obscurePassword),
                              ),
                            ),
                          ),
                          SizedBox(height: AppSpacing.xl(context)),
                          _buildSubmitButton(),
                        ],
                      ),
                    ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.2),

                    SizedBox(height: AppSpacing.lg(context)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ─── Student Fields ───────────────────────────────────────────────────────

  Widget _buildStudentFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Personal Information'),
        SizedBox(height: AppSpacing.sm(context)),
        _buildTextField(
          controller: _nameController,
          label: 'Full Name',
          icon: Icons.person_outline_rounded,
          validator: _requiredValidator('Name'),
        ),
        SizedBox(height: AppSpacing.md(context)),
        _buildTextField(
          controller: _emailController,
          label: 'Email Address',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          validator: _emailValidator,
        ),


        SizedBox(height: AppSpacing.lg(context)),
        _sectionLabel('Academic Information'),
        SizedBox(height: AppSpacing.sm(context)),

        // Branch Type (UG / PG)
        _buildDropdown<String>(
          label: 'Program Type',
          icon: Icons.school_outlined,
          value: _selectedBranchType,
          items: const ['UG', 'PG'],
          itemLabel: (v) => v == 'UG' ? 'UG (Under Graduate)' : 'PG (Post Graduate)',
          onChanged: (v) => setState(() {
            _selectedBranchType = v;
            _selectedBranch = null;      // reset branch
            _selectedDepartment = null;  // reset department
            _selectedStudyYear = null;   // reset study year
          }),
        ),
        SizedBox(height: AppSpacing.md(context)),

        // Branch (B.E / B.Tech / M.BA — filtered by program type)
        _buildDropdown<String>(
          label: 'Branch / Degree',
          icon: Icons.menu_book_outlined,
          value: _selectedBranch,
          items: _availableBranches,
          enabled: _availableBranches.isNotEmpty,
          hintText: _selectedBranchType == null
              ? 'Select program type first'
              : 'Select branch',
          onChanged: (v) => setState(() {
            _selectedBranch = v;
            _selectedDepartment = null; // reset department on branch change
            _selectedStudyYear = null;  // reset study year (M.BA = 2 yrs, UG = 4 yrs)
          }),
        ),
        SizedBox(height: AppSpacing.md(context)),

        // Department — filtered by selected branch
        _buildDropdown<String>(
          label: 'Department',
          icon: Icons.apartment_outlined,
          value: _selectedDepartment,
          items: _availableDepartments,
          enabled: _availableDepartments.isNotEmpty,
          hintText: _selectedBranch == null
              ? 'Select branch first'
              : 'Select department',
          onChanged: (v) => setState(() => _selectedDepartment = v),
        ),
        SizedBox(height: AppSpacing.md(context)),

        // Study Year — 2 years for M.BA (PG), 4 years for UG branches
        _buildDropdown<String>(
          label: 'Study Year',
          icon: Icons.calendar_today_outlined,
          value: _selectedStudyYear,
          items: _availableStudyYears,
          enabled: _selectedBranch != null,
          hintText: _selectedBranch == null
              ? 'Select branch first'
              : 'Select year',
          onChanged: (v) => setState(() => _selectedStudyYear = v),
        ),
        SizedBox(height: AppSpacing.md(context)),

        // Register Number
        _buildTextField(
          controller: _registerNumberController,
          label: 'Register Number',
          icon: Icons.badge_outlined,
          validator: _requiredValidator('Register number'),
        ),
      ],
    );
  }

  // ─── Staff Fields ─────────────────────────────────────────────────────────

  Widget _buildStaffFields() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('Personal Information'),
        SizedBox(height: AppSpacing.sm(context)),
        _buildTextField(
          controller: _nameController,
          label: 'Full Name',
          icon: Icons.person_outline_rounded,
          validator: _requiredValidator('Name'),
        ),
        SizedBox(height: AppSpacing.md(context)),
        _buildTextField(
          controller: _staffIdController,
          label: 'Staff ID',
          icon: Icons.badge_outlined,
          validator: _requiredValidator('Staff ID'),
        ),
        SizedBox(height: AppSpacing.md(context)),
        _buildTextField(
          controller: _emailController,
          label: 'Email Address',
          icon: Icons.email_outlined,
          keyboardType: TextInputType.emailAddress,
          validator: _emailValidator,
        ),


        SizedBox(height: AppSpacing.lg(context)),
        _sectionLabel('Professional Information'),
        SizedBox(height: AppSpacing.sm(context)),

        _buildDropdown<String>(
          label: 'Department',
          icon: Icons.apartment_outlined,
          value: _selectedStaffDepartment,
          items: _allDepartments,
          onChanged: (v) => setState(() => _selectedStaffDepartment = v),
        ),
        SizedBox(height: AppSpacing.md(context)),

        _buildDropdown<String>(
          label: 'Position',
          icon: Icons.work_outline_rounded,
          value: _selectedPosition,
          items: _staffPositions,
          onChanged: (v) => setState(() => _selectedPosition = v),
        ),
      ],
    );
  }

  // ─── Shared Widgets ───────────────────────────────────────────────────────

  Widget _buildPasswordField() {
    return TextFormField(
      controller: _passwordController,
      style: TextStyle(color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
      obscureText: _obscurePassword,
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Password is required';
        if (v.trim().length < 6) return 'Minimum 6 characters';
        return null;
      },
      decoration: InputDecoration(
        labelText: 'Password',
        labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
        prefixIcon: Icon(Icons.lock_outline_rounded, size: AppSpacing.iconSm(context)),
        suffixIcon: IconButton(
          icon: Icon(
            _obscurePassword
                ? Icons.visibility_off_outlined
                : Icons.visibility_outlined,
            size: AppSpacing.iconSm(context),
          ),
          onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return Builder(
      builder: (context) => SizedBox(
        height: AppSpacing.buttonHeight(context),
        child: ElevatedButton(
          onPressed: _isLoading ? null : _handleRegister,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            disabledBackgroundColor: AppColors.primaryLight.withValues(alpha: 0.5),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2),
                )
              : Text(
                  'REGISTER',
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) + 2,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters,
    int? maxLength,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      style: TextStyle(color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      maxLength: maxLength,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
        prefixIcon: Icon(icon, size: AppSpacing.iconSm(context)),
        counterText: '',
      ),
    );
  }

  Widget _buildDropdown<T>({
    required String label,
    required IconData icon,
    required T? value,
    required List<T> items,
    required void Function(T?) onChanged,
    String Function(T)? itemLabel,
    bool enabled = true,
    String? hintText,
  }) {
    return DropdownButtonFormField<T>(
      value: value,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(fontSize: AppSpacing.fontCardTitle(context)),
        prefixIcon: Icon(icon, size: AppSpacing.iconSm(context)),
      ),
      hint: Text(
        hintText ?? 'Select $label',
        style: TextStyle(color: AppColors.textHint, fontSize: AppSpacing.fontCardTitle(context)),
      ),
      items: enabled
          ? items
              .map((item) => DropdownMenuItem<T>(
                    value: item,
                    child: Text(
                      itemLabel != null ? itemLabel(item) : item.toString(),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
                    ),
                  ))
              .toList()
          : null,
      onChanged: enabled ? onChanged : null,
      validator: (v) => v == null ? 'Please select $label' : null,
      dropdownColor: AppColors.bgCard,
      icon: Icon(Icons.keyboard_arrow_down_rounded,
          color: AppColors.textSecondary, size: AppSpacing.iconSm(context)),
    );
  }

  Widget _sectionLabel(String text) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        SizedBox(width: AppSpacing.xs(context)),
        Text(
          text,
          style: TextStyle(
            color: AppColors.textSecondary,
            fontWeight: FontWeight.w700,
            fontSize: AppSpacing.fontCardTitle(context) - 2,
            letterSpacing: 0.8,
          ),
        ),
      ],
    );
  }

  // ─── Validators ───────────────────────────────────────────────────────────

  String? Function(String?) _requiredValidator(String fieldName) {
    return (v) {
      if (v == null || v.trim().isEmpty) return '$fieldName is required';
      return null;
    };
  }

  String? _emailValidator(String? v) {
    if (v == null || v.trim().isEmpty) return 'Email is required';
    // Supports multi-part domains like name@mountzion.ac.in
    final emailReg = RegExp(
        r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$');
    if (!emailReg.hasMatch(v.trim())) return 'Enter a valid email address';
    return null;
  }

  String? _mobileValidator(String? v) {
    if (v == null || v.trim().isEmpty) return 'Mobile number is required';
    if (v.trim().length != 10) return 'Enter a valid 10-digit mobile number';
    return null;
  }

  String _roleBadgeLabel() {
    switch (widget.role) {
      case UserRole.student:
        return 'STUDENT';
      case UserRole.staff:
        return 'STAFF';
      default:
        return widget.role.name.toUpperCase();
    }
  }
}
