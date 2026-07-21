import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/models/verified_location.dart';
import 'package:campus_connect/screens/common/ticket_success_screen.dart';

class SubCategoryFilter {
  final String name;
  final String baseCategoryName;

  const SubCategoryFilter(this.name, this.baseCategoryName);
}

final Map<String, List<SubCategoryFilter>> _locationCategories = {
  'academic': const [
    SubCategoryFilter('Electrical', 'Electrical'),
    SubCategoryFilter('Furniture & Classroom', 'Infrastructure'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Internet & Smart Board', 'Infrastructure'),
    SubCategoryFilter('Water Supply', 'Plumbing'),
    SubCategoryFilter('Safety', 'Safety'),
  ],
  'canteen': const [
    SubCategoryFilter('Food Quality', 'Food Quality'),
    SubCategoryFilter('Hygiene & Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Service Delay', 'Food Quality'),
    SubCategoryFilter('Pricing', 'Food Quality'),
    SubCategoryFilter('Seating Arrangement', 'Infrastructure'),
    SubCategoryFilter('Staff Behaviour', 'Food Quality'),
  ],
  'library': const [
    SubCategoryFilter('Book Availability', 'Books'),
    SubCategoryFilter('Computer & Internet', 'Infrastructure'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Seating & Furniture', 'Infrastructure'),
    SubCategoryFilter('Noise Disturbance', 'Safety'),
    SubCategoryFilter('Lighting & AC', 'Electrical'),
  ],
  'hostel': const [
    SubCategoryFilter('Room Maintenance', 'Maintenance'),
    SubCategoryFilter('Water Supply', 'Plumbing'),
    SubCategoryFilter('Electrical', 'Electrical'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Security & Safety', 'Safety'),
    SubCategoryFilter('Wi-Fi & Internet', 'Maintenance'),
  ],
  'sports': const [
    SubCategoryFilter('Ground Maintenance', 'Maintenance'),
    SubCategoryFilter('Sports Equipment', 'Maintenance'),
    SubCategoryFilter('Lighting', 'Electrical'),
    SubCategoryFilter('Drinking Water', 'Plumbing'),
    SubCategoryFilter('Changing Room', 'Infrastructure'),
    SubCategoryFilter('Safety', 'Safety'),
  ],
  'toilet': const [
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Water Supply', 'Plumbing'),
    SubCategoryFilter('Plumbing', 'Plumbing'),
    SubCategoryFilter('Electrical & Lighting', 'Electrical'),
    SubCategoryFilter('Sanitary Facilities', 'Plumbing'),
    SubCategoryFilter('Bad Odour', 'Cleanliness'),
  ],
  'transport': const [
    SubCategoryFilter('Bus Delay', 'Maintenance'),
    SubCategoryFilter('Driver Behaviour', 'Safety'),
    SubCategoryFilter('Vehicle Maintenance', 'Maintenance'),
    SubCategoryFilter('Route Issue', 'Safety'),
    SubCategoryFilter('Safety', 'Safety'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
  ],
  'mess': const [
    SubCategoryFilter('Food Quality', 'Food Quality'),
    SubCategoryFilter('Hygiene', 'Cleanliness'),
    SubCategoryFilter('Drinking Water', 'Plumbing'),
    SubCategoryFilter('Seating Arrangement', 'Infrastructure'),
    SubCategoryFilter('Staff Behaviour', 'Food Quality'),
    SubCategoryFilter('Service Delay', 'Food Quality'),
  ],
  'general': const [
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Electrical & Lighting', 'Electrical'),
    SubCategoryFilter('Furniture & Infrastructure', 'Infrastructure'),
    SubCategoryFilter('Water Supply & Plumbing', 'Plumbing'),
    SubCategoryFilter('Safety & Security', 'Safety'),
    SubCategoryFilter('General Maintenance', 'Maintenance'),
  ],
  'labs': const [
    SubCategoryFilter('Equipment Malfunction', 'Maintenance'),
    SubCategoryFilter('Computer & Internet', 'Infrastructure'),
    SubCategoryFilter('Electrical & Lighting', 'Electrical'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Safety & Hazards', 'Safety'),
    SubCategoryFilter('Furniture & Seating', 'Infrastructure'),
  ],
  'main_gate': const [
    SubCategoryFilter('Security & Safety', 'Safety'),
    SubCategoryFilter('Lighting & Electrical', 'Electrical'),
    SubCategoryFilter('Cleanliness', 'Cleanliness'),
    SubCategoryFilter('Gate Maintenance', 'Maintenance'),
    SubCategoryFilter('Visitor Parking & Traffic', 'Infrastructure'),
    SubCategoryFilter('CCTV & Surveillance', 'Safety'),
  ],
};

class ComplaintFormScreen extends StatefulWidget {
  final TicketService ticketService;
  final VerifiedLocation verifiedLocation;  // QR-verified location — location locked server-side

  const ComplaintFormScreen({
    super.key,
    required this.ticketService,
    required this.verifiedLocation,
  });

  @override
  State<ComplaintFormScreen> createState() => _ComplaintFormScreenState();
}

class _ComplaintFormScreenState extends State<ComplaintFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descController = TextEditingController();

  int? _selectedBusNumber; // Selected bus number for transport category (1 to 16)
  SubCategoryFilter? _selectedSubCategory;
  List<SubCategoryFilter> _displayCategories = [];

  String _determineLocationKey(VerifiedLocation loc) {
    final label = loc.locationLabel.toLowerCase();
    final cat = loc.category.toLowerCase();

    if (label.contains('mess')) return 'mess';
    if (label.contains('canteen') || cat == 'canteen') return 'canteen';
    if (label.contains('toilet') || label.contains('washroom') || cat == 'toilet') return 'toilet';
    if (label.contains('academic') || cat == 'academic') return 'academic';
    if (label.contains('library') || cat == 'library') return 'library';
    if (label.contains('hostel') || cat == 'hostel') return 'hostel';
    if (label.contains('sports') || cat == 'sports') return 'sports';
    if (label.contains('transport') || cat == 'transport') return 'transport';
    if (label.contains('lab') || cat == 'labs') return 'labs';
    if (label.contains('gate') || cat == 'main gate') return 'main_gate';
    if (cat == 'general') return 'general';

    return 'general';
  }

  void _setupDisplayCategories() {
    _displayCategories = _locationCategories[_determineLocationKey(widget.verifiedLocation)] ?? [];
  }

  // FIX 1: Categories fetched from API — no hardcoded list, IDs come from DB
  List<ComplaintCategory> _categories = [];
  bool _categoriesLoading = true;
  ComplaintCategory? _selectedCategory;

  XFile? _selectedImage;
  final ImagePicker _picker = ImagePicker();
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _setupDisplayCategories();
  }

  /// FIX 1: Load categories from API so IDs always match the DB
  Future<void> _loadCategories() async {
    final cats = await widget.ticketService.fetchCategories();
    if (mounted) {
      setState(() {
        _categories = cats;
        _categoriesLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _descController.dispose();
    super.dispose();
  }

  void _submit() async {
    final isTransport = widget.verifiedLocation.category.toLowerCase() == 'transport';
    if (!_formKey.currentState!.validate() || _selectedSubCategory == null || (isTransport && _selectedBusNumber == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isTransport && _selectedBusNumber == null
                ? 'Please select a bus number'
                : _selectedSubCategory == null
                    ? 'Please select a category'
                    : 'Please fill all required fields',
          ),
          backgroundColor: AppColors.accent,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    await Future.delayed(const Duration(milliseconds: 800));

    try {
      // Find the matching base category in the fetched database categories
      final baseCatName = _selectedSubCategory!.baseCategoryName;
      final baseCategory = _categories.firstWhere(
        (cat) => cat.name.toLowerCase() == baseCatName.toLowerCase(),
        orElse: () => _categories.firstWhere(
          (cat) => cat.name.toLowerCase() == 'other',
          orElse: () => _categories.isNotEmpty ? _categories.first : const ComplaintCategory(id: 1, name: 'General'),
        ),
      );

      // ── PHOTO SUBMIT DIAGNOSTICS ───────────────────────────────────────
      debugPrint('═══════════ FORM SUBMIT ═══════════');
      debugPrint('_selectedImage: $_selectedImage');
      debugPrint('_selectedImage?.path: ${_selectedImage?.path}');
      debugPrint('_selectedImage?.name: ${_selectedImage?.name}');
      debugPrint('Sub-category selected: ${_selectedSubCategory?.name}');
      debugPrint('Base category resolved: ${baseCategory.name} (id=${baseCategory.id})');
      if (isTransport) {
        debugPrint('Bus number selected: $_selectedBusNumber');
      }
      debugPrint('═══════════════════════════════════');

      final formattedBus = _selectedBusNumber != null
          ? 'Bus ${_selectedBusNumber.toString().padLeft(2, '0')}'
          : null;

      final prefixParts = <String>[];
      if (formattedBus != null) {
        prefixParts.add('Bus Number: $formattedBus');
      }
      if (_selectedSubCategory != null) {
        prefixParts.add('Sub-Category: ${_selectedSubCategory!.name}');
      }

      final descriptionPrefix = prefixParts.isNotEmpty
          ? '[${prefixParts.join(' | ')}]\n'
          : '';

      // FIX 1: categoryId from API object — not hardcoded indexOf()
      // FIX 3: pass XFile directly — XFile.readAsBytes() handles content:// URIs on Android
      final ticket = await widget.ticketService.createTicket(
        locationId: widget.verifiedLocation.locationId,
        categoryId: baseCategory.id,
        title: _descController.text.trim().split('\n').first,
        description: '$descriptionPrefix${_descController.text.trim()}',
        photo: _selectedImage,
        qrVerificationToken: widget.verifiedLocation.verificationToken,
      );

      if (mounted) {
        if (ticket != null) {
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => TicketSuccessScreen(ticket: ticket, ticketService: widget.ticketService)));
        } else {
          setState(() => _isSubmitting = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to create ticket. Please try again.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  void _showImageSourceDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.all(AppSpacing.xl(context)),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.radiusLg(context))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Select Image Source', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary, fontSize: AppSpacing.fontSectionHeader(context))),
            SizedBox(height: AppSpacing.lg(context)),
            Row(
              children: [
                Expanded(child: _imageSourceOption(context, icon: Icons.camera_alt_rounded, label: 'Camera', onTap: () { Navigator.pop(context); _pickImage(ImageSource.camera); })),
                SizedBox(width: AppSpacing.md(context)),
                Expanded(child: _imageSourceOption(context, icon: Icons.photo_library_rounded, label: 'Gallery', onTap: () { Navigator.pop(context); _pickImage(ImageSource.gallery); })),
              ],
            ),
            SizedBox(height: AppSpacing.md(context)),
          ],
        ),
      ),
    );
  }

  Widget _imageSourceOption(BuildContext context, {required IconData icon, required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.xl(context)),
        decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)), border: Border.all(color: AppColors.border)),
        child: Column(children: [
          Icon(icon, size: AppSpacing.iconLg(context), color: AppColors.primary),
          SizedBox(height: AppSpacing.sm(context)),
          Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context))),
        ]),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source, imageQuality: 80);
      if (image != null) setState(() => _selectedImage = image);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error picking image: $e'), backgroundColor: AppColors.accent, behavior: SnackBarBehavior.floating),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
            // App bar
            Padding(
              padding: EdgeInsets.all(AppSpacing.md(context)),
              child: Row(children: [
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(padding: EdgeInsets.all(AppSpacing.sm(context)), decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context)), border: Border.all(color: AppColors.border)), child: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: AppSpacing.iconSm(context) - 2)),
                ),
                SizedBox(width: AppSpacing.md(context)),
                Text('Submit Feedback', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary, fontSize: AppSpacing.fontSectionHeader(context))),
              ]),
            ),

            _stepIndicator(context, 3, 'Submit Feedback'),

            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
                child: Form(
                  key: _formKey,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // ── QR Verified Location Badge (locked) ─────────────────
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.sm(context)),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context)),
                        border: Border.all(color: Colors.green.shade300),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.location_on_rounded, color: Colors.green, size: AppSpacing.iconSm(context) - 2),
                          SizedBox(width: AppSpacing.xs(context)),
                          Expanded(
                            child: Text(
                              widget.verifiedLocation.locationLabel,
                              style: TextStyle(
                                color: Colors.green,
                                fontWeight: FontWeight.w600,
                                fontSize: AppSpacing.fontCardTitle(context),
                              ),
                            ),
                          ),
                          SizedBox(width: AppSpacing.xs(context)),
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: AppSpacing.sm(context), vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.green,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.verified, color: Colors.white, size: AppSpacing.iconSm(context) - 8),
                                SizedBox(width: 3),
                                Text('QR Verified',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: AppSpacing.fontCardTitle(context) - 4,
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(duration: 300.ms),

                    // ── Embedded Bus Selection Grid (calendar style) ──────────────────
                    if (widget.verifiedLocation.category.toLowerCase() == 'transport') ...[
                      SizedBox(height: AppSpacing.lg(context)),
                      _sectionLabel('Select Bus Number *'),
                      SizedBox(height: AppSpacing.sm(context)),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 8,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          childAspectRatio: 1.0,
                        ),
                        itemCount: 16,
                        itemBuilder: (context, index) {
                          final busNum = index + 1;
                          final isSelected = _selectedBusNumber == busNum;
                          return GestureDetector(
                            onTap: () => setState(() => _selectedBusNumber = busNum),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected ? AppColors.primary : AppColors.bgCardLight,
                                border: Border.all(
                                  color: isSelected ? AppColors.primaryDark : AppColors.border,
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  '$busNum',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: isSelected ? Colors.white : AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ).animate().fadeIn(duration: 350.ms),
                    ],

                    SizedBox(height: AppSpacing.lg(context)),

                    // FIX 1: Dynamic category chips from DB — IDs guaranteed to match
                    _sectionLabel('Category *'),
                    SizedBox(height: AppSpacing.sm(context)),
                    _categoriesLoading
                        ? Center(child: Padding(padding: EdgeInsets.all(AppSpacing.md(context)), child: const CircularProgressIndicator()))
                        : _displayCategories.isEmpty
                            ? GestureDetector(
                                onTap: _loadCategories,
                                child: Text('Could not load categories. Tap to retry.', style: TextStyle(color: Colors.red, fontSize: AppSpacing.fontCardTitle(context))),
                              )
                            : Wrap(
                                spacing: AppSpacing.sm(context), runSpacing: AppSpacing.sm(context),
                                children: _displayCategories.map((cat) {
                                  final sel = _selectedSubCategory?.name == cat.name;
                                  return GestureDetector(
                                    onTap: () => setState(() => _selectedSubCategory = cat),
                                    child: AnimatedContainer(
                                      duration: const Duration(milliseconds: 200),
                                      padding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.sm(context)),
                                      decoration: BoxDecoration(
                                        color: sel ? AppColors.primary.withValues(alpha: 0.08) : AppColors.bgCard,
                                        borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context)),
                                        border: Border.all(color: sel ? AppColors.primary : AppColors.border),
                                      ),
                                      child: Text(cat.name, style: TextStyle(color: sel ? AppColors.primary : AppColors.textSecondary, fontWeight: sel ? FontWeight.w600 : FontWeight.w500, fontSize: AppSpacing.fontCardTitle(context) - 1)),
                                    ),
                                  );
                                }).toList(),
                              ).animate(delay: 200.ms).fadeIn(duration: 400.ms),

                    SizedBox(height: AppSpacing.lg(context)),

                    // Description
                    _sectionLabel('Description *'),
                    SizedBox(height: AppSpacing.sm(context)),
                    TextFormField(
                      controller: _descController,
                      maxLines: 4,
                      style: TextStyle(color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context)),
                      decoration: InputDecoration(hintText: 'Describe the issue in detail...', hintStyle: TextStyle(color: AppColors.textHint, fontSize: AppSpacing.fontCardTitle(context))),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Description is required';
                        if (v.trim().length < 5) return 'Description must be at least 5 characters';
                        return null;
                      },
                    ).animate(delay: 300.ms).fadeIn(duration: 400.ms),

                    SizedBox(height: AppSpacing.lg(context)),

                    // Photo upload — FIX 3: shows preview thumbnail
                    _sectionLabel('Attach Photo'),
                    SizedBox(height: AppSpacing.sm(context)),
                    GestureDetector(
                      onTap: _showImageSourceDialog,
                      child: Container(
                        width: double.infinity, padding: EdgeInsets.all(AppSpacing.lg(context)),
                        decoration: BoxDecoration(
                          color: _selectedImage != null ? AppColors.statusResolved.withValues(alpha: 0.05) : AppColors.bgCard,
                          borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                          border: Border.all(color: _selectedImage != null ? AppColors.statusResolved : AppColors.border),
                        ),
                        child: Column(children: [
                          if (_selectedImage != null) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context)),
                              child: kIsWeb 
                                  ? Image.network(_selectedImage!.path, height: 120, width: double.infinity, fit: BoxFit.cover)
                                  : Image.file(File(_selectedImage!.path), height: 120, width: double.infinity, fit: BoxFit.cover),
                            ),
                            SizedBox(height: AppSpacing.sm(context)),
                            Text(_selectedImage!.name, textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: AppColors.statusResolved, fontSize: AppSpacing.fontCardTitle(context))),
                            SizedBox(height: AppSpacing.xs(context)),
                            Text('Tap to change photo', style: TextStyle(color: AppColors.statusResolved, fontSize: AppSpacing.fontCardTitle(context) - 2, fontWeight: FontWeight.w500)),
                          ] else ...[
                            Icon(Icons.camera_alt_rounded, color: AppColors.textHint, size: AppSpacing.iconLg(context)),
                            SizedBox(height: AppSpacing.sm(context)),
                            Text('Tap to attach a photo', style: TextStyle(color: AppColors.textHint, fontSize: AppSpacing.fontCardTitle(context))),
                          ]
                        ]),
                      ),
                    ).animate(delay: 400.ms).fadeIn(duration: 400.ms),

                    SizedBox(height: AppSpacing.xl(context)),

                    // Submit button
                    SizedBox(
                      width: double.infinity, height: AppSpacing.buttonHeight(context),
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: _isSubmitting
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Icon(Icons.send_rounded, color: Colors.white),
                                SizedBox(width: 10),
                                Text('SUBMIT', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: 1, color: Colors.white)),
                              ]),
                      ),
                    ).animate(delay: 600.ms).fadeIn(duration: 400.ms).slideY(begin: 0.2, end: 0),

                    const SizedBox(height: 20),
                  ]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: AppColors.textSecondary));
  }

  Widget _stepIndicator(BuildContext context, int step, String label) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: AppSpacing.lg(context)),
      padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg(context), vertical: AppSpacing.sm(context)),
      decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)), border: Border.all(color: AppColors.border)),
      child: Row(children: [
        Container(width: AppSpacing.isCompact(context) ? 28 : 32, height: AppSpacing.isCompact(context) ? 28 : 32, decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context))), child: Center(child: Text('$step', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: AppSpacing.fontCardTitle(context))))),
        SizedBox(width: AppSpacing.sm(context)),
        Text(label, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: AppColors.textPrimary, fontSize: AppSpacing.fontCardTitle(context))),
        const Spacer(),
        Text('Step $step of 4', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textHint, fontSize: AppSpacing.fontCardTitle(context) - 2)),
      ]),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.2, end: 0);
  }
}
