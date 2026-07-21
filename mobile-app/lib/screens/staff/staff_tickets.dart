import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/config/api_config.dart';
import 'package:campus_connect/utils/url_helper.dart';
import 'package:http/http.dart' as http;
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/screens/common/qr_scanner_screen.dart';
// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

/// Roles that may submit complaints.
/// Dean, Principal, Admin are explicitly EXCLUDED.
const List<String> _complaintEligibleRoles = [
  'Assistant Professor',
  'Associate Professor',
  'Lecturer',
  'Senior Lecturer',
  'Lab Assistant',
  'Lab Technician',
  'Placement Officer',
  'Department Coordinator',
  'Exam Cell Coordinator',
  'Hostel Warden Boys',
  'Hostel Warden Girls',
  'Mess Warden Boys',
  'Mess Warden Girls',
  'Canteen Head',
  'HOD',
  'Head of Department (HOD)',
];

const List<String> _level1Roles = ['HOD', 'Hostel Warden Boys', 'Hostel Warden Girls', 'Mess Warden Boys', 'Mess Warden Girls', 'Canteen Head'];
const List<String> _level2Roles = ['Admin', 'Dean'];
const List<String> _level3Roles = ['Principal'];

const List<String> _privilegedRoles = [
  'HOD', 'Hostel Warden Boys', 'Hostel Warden Girls', 'Mess Warden Boys', 'Mess Warden Girls', 'Canteen Head',
  'Admin', 'Dean', 'Principal'
];

bool _isPrivileged(String position) => _privilegedRoles.contains(position);

TicketStatus _mapStringToStatus(String statusStr) {
  switch (statusStr) {
    case 'Open': return TicketStatus.open;
    case 'In Progress': return TicketStatus.inProgress;
    case 'Escalated': return TicketStatus.inProgress; // It shouldn't map to a status enum directly, treated as inProgress
    case 'Resolved': return TicketStatus.resolved;
    case 'Closed': return TicketStatus.closed;
    default: return TicketStatus.open;
  }
}

// ---------------------------------------------------------------------------
// Form constants
// ---------------------------------------------------------------------------

const List<String> _categories = [
  'Infrastructure',
  'Cleanliness',
  'Food Quality',
  'Safety',
  'Maintenance',
  'Electrical',
  'Plumbing',
  'IT / Network',
  'Staff Behavior',
  'Other',
];

const List<String> _locations = [
  'Academic Block',
  'Hostel',
  'Canteen',
  'Library',
  'Toilet / Washroom',
  'Transport',
  'Other',
];

// ---------------------------------------------------------------------------
// Legacy escalation helpers (for old demo tickets)
// ---------------------------------------------------------------------------

/// Level 1 = < 24h (HOD/Warden/Canteen Head)
/// Level 2 = 24h - 48h (Admin/Dean)
/// Level 3 = >= 48h (Principal)
int _legacyEscalationLevel(DateTime createdAt) {
  final hours = DateTime.now().difference(createdAt).inHours;
  if (hours >= 48) return 3;
  if (hours >= 24) return 2;
  return 1;
}

bool _canEditLegacyRemarks(int level, String position) {
  if (_level3Roles.contains(position)) return level == 3;
  if (_level2Roles.contains(position)) return level == 2;
  if (_level1Roles.contains(position)) return level == 1;
  return false;
}

String _getStudentComplaintAssignee(String location) {
  final lower = location.toLowerCase();
  if (lower.contains('boys hostel')) return 'Hostel Warden Boys';
  if (lower.contains('girls hostel')) return 'Hostel Warden Girls';
  if (lower.contains('hostel')) return 'Hostel Warden Boys'; // fallback
  if (lower.contains('boys mess')) return 'Mess Warden Boys';
  if (lower.contains('girls mess')) return 'Mess Warden Girls';
  if (lower.contains('mess') || lower.contains('canteen')) return 'Canteen Head'; // fallback or Canteen
  return 'HOD';
}

String _formatAssignedTo(String assignedTo) {
  if (_level1Roles.contains(assignedTo) || assignedTo == 'Level 1') {
    return 'Level 1 — HOD, Canteen Head, Hostel/Mess Warden';
  } else if (assignedTo == 'Level 2') {
    return 'Level 2 — Admin, Dean';
  } else if (assignedTo == 'Level 3') {
    return 'Level 3 - Principal';
  }
  return assignedTo;
}

// ===========================================================================
// TicketsScreen — main list screen
// ===========================================================================

class TicketsScreen extends StatefulWidget {
  final String staffPosition;
  final String staffName;
  final List<Ticket> complaints;
  final List<Map<String, dynamic>> notifications;
  final VoidCallback onComplaintsChanged;
  final TicketService ticketService;

  const TicketsScreen({
    Key? key,
    this.staffPosition = 'Assistant Professor',
    this.staffName = 'Staff Member',
    required this.complaints,
    required this.notifications,
    required this.onComplaintsChanged,
    required this.ticketService,
  }) : super(key: key);

  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> {
  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'Open', 'In Progress', 'Resolved'];


  @override
  void initState() {
    super.initState();
    // Run escalation check after first frame (never during build).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _runEscalationCheck();
    });
  }

  void _runEscalationCheck() {
    bool changed = false;
    for (final complaint in widget.complaints) {
      final submittedAt = complaint.createdAt;
      final status = complaint.statusLabel;
      final assignedTo = complaint.assignedTo;
      final submittedByRole = complaint.creatorRole;
      final escalationHistory =
          complaint.updates.where((u) => u.updateType == 'transfer' || u.updateType == 'ESCALATED').toList();

      if (status == 'Resolved' || status == 'Closed') continue;

      final hoursPassed = DateTime.now().difference(submittedAt).inHours;
      final isStudent = submittedByRole == 'Student';

      if (_level1Roles.contains(assignedTo)) {
        if (hoursPassed >= 24) {
          final oldAssignee = assignedTo;
          complaint.assignedTo = 'Level 2';
          final escalationTime = DateTime.now();
          escalationHistory.add(TicketUpdate(message: 'Unresolved after 24 hours — auto-escalated to Level 2', timestamp: escalationTime, updatedBy: 'System'));
          widget.notifications.insert(0, {
            'title': 'Student Feedback Escalated',
            'subtitle': complaint.title,
            'body': 'Escalated from $oldAssignee to Level 2. Unresolved for over 24 hours.',
            'type': 'escalation_l2',
            'timestamp': escalationTime.toIso8601String(),
            'read': false,
            'privilegedOnly': true,
          });
          changed = true;
        }
      } else if (assignedTo == 'Level 2') {
        final escalationThreshold = isStudent ? 48 : 24;
        if (hoursPassed >= escalationThreshold) {
          complaint.assignedTo = 'Level 3';
          final escalationTime = DateTime.now();
          escalationHistory.add(TicketUpdate(message: 'Unresolved after $escalationThreshold hours — auto-escalated to Principal', timestamp: escalationTime, updatedBy: 'System'));
          widget.notifications.insert(0, {
            'title': 'Feedback Escalated to Principal',
            'subtitle': complaint.title,
            'body': 'Escalated to Level 3. Pending beyond SLA.',
            'type': 'escalation_l3',
            'timestamp': escalationTime.toIso8601String(),
            'read': false,
            'privilegedOnly': true,
          });
          changed = true;
        }
      }
    }
    if (changed) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) widget.onComplaintsChanged();
      });
    }
  }

  /// Combined list from API (backend already handles role-based visibility)
  List<Ticket> get _allTickets {
    return widget.complaints;
  }

  List<Ticket> get _filteredTickets {
    final all = _allTickets;
    if (_selectedFilter == 'All') return all;
    return all.where((t) => t.statusLabel == _selectedFilter).toList();
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = _complaintEligibleRoles.contains(widget.staffPosition);
    final isPrivileged = _isPrivileged(widget.staffPosition);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ─────────────────────────────────────────────────────
            Padding(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.horizontalPad(context),
                AppSpacing.lg(context),
                AppSpacing.horizontalPad(context),
                AppSpacing.md(context),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Feedback',
                    style: TextStyle(
                      fontSize: AppSpacing.isCompact(context) ? 22.0 : 26.0,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF111827),
                      letterSpacing: -0.5,
                    ),
                  ),
                  if (!isPrivileged) ...[
                    SizedBox(height: AppSpacing.xs(context)),
                    Text(
                      'Showing your submitted feedback',
                      style: TextStyle(
                        fontSize: AppSpacing.fontCardTitle(context) + 1,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ] else ...[
                    SizedBox(height: AppSpacing.xs(context)),
                    Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm(context), vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${widget.staffPosition} View — Full Access',
                        style: TextStyle(
                          fontSize: AppSpacing.fontCardTitle(context),
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF2563EB),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // ── Filter chips ───────────────────────────────────────────────
            SizedBox(
              height: AppSpacing.isCompact(context) ? 36.0 : 40.0,
              child: ListView.separated(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.horizontalPad(context)),
                scrollDirection: Axis.horizontal,
                itemCount: _filters.length,
                separatorBuilder: (_, __) => SizedBox(width: AppSpacing.sm(context)),
                itemBuilder: (context, index) {
                  final filter = _filters[index];
                  final isSelected = filter == _selectedFilter;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedFilter = filter),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: EdgeInsets.symmetric(
                          horizontal: AppSpacing.isCompact(context) ? 14.0 : 20.0,
                          vertical: AppSpacing.isCompact(context) ? 6.0 : 8.0),
                      decoration: BoxDecoration(
                        gradient: isSelected
                            ? const LinearGradient(
                                colors: [
                                  Color(0xFF2563EB),
                                  Color(0xFF60A5FA)
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        color: isSelected ? null : Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: isSelected
                            ? [
                                BoxShadow(
                                  color: const Color(0xFF2563EB)
                                      .withValues(alpha: 0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            : null,
                        border: isSelected
                            ? null
                            : Border.all(color: Colors.transparent),
                      ),
                      child: Center(
                        child: Text(
                          filter,
                          style: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : const Color(0xFF6B7280),
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            fontSize: AppSpacing.fontCardTitle(context) + 2,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),

            SizedBox(height: AppSpacing.md(context)),

            // ── Ticket list ────────────────────────────────────────────────
            Expanded(
              child: _filteredTickets.isEmpty
                  ? _buildEmptyState()
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.horizontalPad(context), 0,
                        AppSpacing.horizontalPad(context), 100,
                      ),
                      physics: const BouncingScrollPhysics(),
                      itemCount: _filteredTickets.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 16),
                      itemBuilder: (context, index) {
                        final ticket = _filteredTickets[index];
                        final isDemoTicket =
                            false;

                        return _StaffComplaintCard(
                            complaint: ticket,
                            staffPosition: widget.staffPosition,
                            staffName: widget.staffName,
                            isPrivileged: isPrivileged,
                            ticketService: widget.ticketService,
                            onComplaintUpdated: () {
                              widget.onComplaintsChanged();
                            },
                          );
                        },
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: canSubmit
          ? FloatingActionButton.extended(
              heroTag: 'staff_tickets_fab',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => QrScannerScreen(
                      ticketService: widget.ticketService,
                    ),
                  ),
                ).then((_) {
                  widget.onComplaintsChanged();
                  setState(() {});
                });
              },
              backgroundColor: const Color(0xFF2563EB),
              elevation: 6,
              icon: const Icon(Icons.add_circle_outline_rounded,
                  color: Colors.white),
              label: const Text(
                'Submit Feedback',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildEmptyState() {
    final isPrivileged = _isPrivileged(widget.staffPosition);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Icon(
              Icons.inbox_rounded,
              size: 40,
              color: Color(0xFF2563EB),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'No feedback found',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isPrivileged
                ? 'No feedback matching this filter.'
                : 'You haven\'t submitted any feedback yet.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.grey.shade500,
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Staff Complaint Card — role-adaptive
// ===========================================================================

class _StaffComplaintCard extends StatelessWidget {
  final Ticket complaint;
  final String staffPosition;
  final String staffName;
  final bool isPrivileged;
  final TicketService ticketService;
  final VoidCallback onComplaintUpdated;

  const _StaffComplaintCard({
    Key? key,
    required this.complaint,
    required this.staffPosition,
    required this.staffName,
    required this.isPrivileged,
    required this.ticketService,
    required this.onComplaintUpdated,
  }) : super(key: key);

  Color _statusColor(String status) {
    switch (status) {
      case 'Open':
        return const Color(0xFF2563EB);
      case 'In Progress':
        return const Color(0xFFEA580C);
      case 'Resolved':
        return const Color(0xFF16A34A);
      default:
        return const Color(0xFF6B7280);
    }
  }

  Color _statusBg(String status) {
    switch (status) {
      case 'Open':
        return const Color(0xFFEFF6FF);
      case 'In Progress':
        return const Color(0xFFFFF7ED);
      case 'Resolved':
        return const Color(0xFFDCFCE7);
      default:
        return const Color(0xFFF3F4F6);
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = complaint.statusLabel;
    final escalationHistory =
        complaint.updates.where((u) => u.updateType == 'transfer' || u.updateType == 'ESCALATED').toList();
    final isEscalated = isPrivileged && escalationHistory.isNotEmpty;
    
    bool canEdit = false;
    bool canViewRemarks = false;
    String assignedTo = complaint.assignedTo;

    if (isPrivileged) {
      canViewRemarks = true;
    }
    
    canEdit = (assignedTo == staffName) || (assignedTo == staffPosition) || (complaint.assignedRole == staffPosition);
    if (canEdit) canViewRemarks = true;
    
    final submittedAt = complaint.createdAt;
    final formattedDate =
        DateFormat('dd MMM yyyy, hh:mm a').format(submittedAt);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isEscalated ? const Color(0xFFFED7AA) : Colors.grey.shade100,
          width: isEscalated ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Row 1: ID + status ─────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  complaint.ticketNumber ?? complaint.id,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2563EB),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Row(
                children: [
                  // Escalation badge — privileged only
                  if (isEscalated)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.arrow_upward_rounded,
                              size: 11, color: Color(0xFFEA580C)),
                          SizedBox(width: 3),
                          Text(
                            'Escalated',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFEA580C),
                            ),
                          ),
                        ],
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _statusBg(status),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(
                        color: _statusColor(status),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),

          const SizedBox(height: 10),

          // ── Title ────────────────────────────────────────────────────────
          Text(
            complaint.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF111827),
            ),
          ),

          const SizedBox(height: 6),

          // Assigned to — privileged only
          if (isPrivileged)
            Row(
              children: [
                Icon(Icons.person_pin_circle_rounded,
                    size: 14,
                    color: isEscalated
                        ? const Color(0xFFEA580C)
                        : Colors.grey.shade400),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    'Assigned Level: ${_formatAssignedTo(assignedTo)}',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isEscalated
                          ? const Color(0xFFEA580C)
                          : Colors.grey.shade500,
                    ),
                  ),
                ),
              ],
            ),

          const SizedBox(height: 12),
          Divider(color: Colors.grey.shade200, height: 1),
          const SizedBox(height: 12),

          // ── Date · Location ────────────────────────────────────────────
          Row(
            children: [
              Icon(Icons.schedule_rounded,
                  size: 14, color: Colors.grey.shade400),
              const SizedBox(width: 5),
              Text(
                formattedDate,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.location_on_rounded,
                  size: 14, color: Colors.grey.shade400),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  complaint.location,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),
          Divider(color: Colors.grey.shade200, height: 1),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: 'View Details',
                  icon: Icons.info_outline_rounded,
                  color: const Color(0xFF2563EB),
                  bgColor: const Color(0xFFEFF6FF),
                  onTap: () => _showComplaintDetails(context),
                ),
              ),
              if (canViewRemarks) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    label: canEdit ? 'Remarks' : 'View Remarks',
                    icon: canEdit ? Icons.comment_rounded : Icons.comment_outlined,
                    color: canEdit ? const Color(0xFF16A34A) : const Color(0xFF6B7280),
                    bgColor: canEdit ? const Color(0xFFDCFCE7) : const Color(0xFFF3F4F6),
                    onTap: () => _showRemarksSheet(context, canEdit),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  void _showComplaintDetails(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StaffComplaintDetailsSheet(
        complaint: complaint,
        staffPosition: staffPosition,
        staffName: staffName,
        ticketService: ticketService,
        onStatusChanged: (newStatus) {
          complaint.status = _mapStringToStatus(newStatus);
          // Add inprogress/resolved notification
          onComplaintUpdated();
        },
      ),
    );
  }

  void _showRemarksSheet(BuildContext context, bool canEdit) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _StaffRemarksSheet(
        complaint: complaint,
        staffPosition: staffPosition,
        staffName: staffName,
        canEdit: canEdit,
        onRemarkAdded: onComplaintUpdated,
      ),
    );
  }
}

// ===========================================================================
// Staff Complaint Details Sheet (Privileged only)
// ===========================================================================

class StaffComplaintDetailsSheet extends StatefulWidget {
  final Ticket complaint;
  final String staffPosition;
  final String staffName;
  final TicketService ticketService;
  final ValueChanged<String> onStatusChanged;

  const StaffComplaintDetailsSheet({
    Key? key,
    required this.complaint,
    required this.staffPosition,
    required this.staffName,
    required this.ticketService,
    required this.onStatusChanged,
  }) : super(key: key);

  @override
  State<StaffComplaintDetailsSheet> createState() =>
      _StaffComplaintDetailsSheetState();
}

class _StaffComplaintDetailsSheetState
    extends State<StaffComplaintDetailsSheet> {
  late String _currentStatus;
  EscalationChain? _escalationChain;
  bool _loadingChain = false;

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.complaint.statusLabel;
    _loadEscalationChain();
  }

  Future<void> _loadEscalationChain() async {
    if (!mounted) return;
    setState(() => _loadingChain = true);
    try {
      final chain = await widget.ticketService.getEscalationChain(widget.complaint.id);
      if (mounted) setState(() => _escalationChain = chain);
    } catch (_) {} finally {
      if (mounted) setState(() => _loadingChain = false);
    }
  }

  String _formatAssignedTo(String raw) {
    if (raw == 'Level 1') return 'Staff (Level 1)';
    if (raw == 'Level 2') return 'HOD (Level 2)';
    if (raw == 'Level 3') return 'Principal (Level 3)';
    return raw;
  }



  @override
  Widget build(BuildContext context) {
    final complaint = widget.complaint;
    final imagePath = complaint.photoUrl;
    final submittedAt = complaint.createdAt;
    final escalationHistory =
        complaint.updates.where((u) => u.updateType == 'transfer' || u.updateType == 'ESCALATED').toList();
    final remarks = complaint.updates.where((u) => u.updateType != 'transfer' && u.updateType != 'ESCALATED').toList();
    
    final isEscalated = escalationHistory.isNotEmpty;
    bool canEditStatus = false;
    final isDemo = false;
    String assignedTo;
    if (isDemo) {
      final createdAt = complaint.createdAt;
      final level = _legacyEscalationLevel(createdAt);
      if (level == 1) {
        assignedTo = _getStudentComplaintAssignee(complaint.location ?? '');
      } else {
        assignedTo = 'Level $level';
      }
    } else {
      assignedTo = complaint.assignedTo;
    }

    canEditStatus = (assignedTo == widget.staffName) || (assignedTo == widget.staffPosition) || (complaint.assignedRole == widget.staffPosition);
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Feedback Details',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ),
                  // Escalation level badge
                  if (escalationHistory.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: const Text(
                        '⬆ Escalated',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFEA580C),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Divider(color: Colors.grey.shade200, height: 1),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DetailRow(
                        icon: Icons.confirmation_number_rounded,
                        label: 'Feedback ID',
                        value: complaint.ticketNumber ?? complaint.id),
                    _DetailRow(
                        icon: Icons.title_rounded,
                        label: 'Title',
                        value: complaint.title),
                    _DetailRow(
                        icon: Icons.category_rounded,
                        label: 'Category',
                        value: complaint.category),
                    _DetailRow(
                        icon: Icons.location_on_rounded,
                        label: 'Location',
                        value: complaint.location),
                    _DetailRow(
                        icon: Icons.person_rounded,
                        label: 'Submitted By',
                        value:
                            '${complaint.creatorName} (${complaint.creatorRole})'),
                    _DetailRow(
                        icon: Icons.schedule_rounded,
                        label: 'Submitted At',
                        value: DateFormat('dd MMM yyyy, hh:mm a')
                            .format(submittedAt)),
                    _DetailRow(
                        icon: Icons.trending_up_rounded,
                        label: 'Escalation Level',
                        value: 'Level ${complaint.escalationLevel}'),
                    _DetailRow(
                        icon: Icons.person_pin_circle_rounded,
                        label: 'Current Assignee',
                        value: '${complaint.assignedTo} (${complaint.assignedRole})'),                    // ── Status dropdown (privileged can change) ────────────
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.tune_rounded,
                              size: 18, color: Color(0xFF2563EB)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Status',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Colors.grey.shade500)),
                              const SizedBox(height: 3),
                              DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _currentStatus,
                                  isDense: true,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF111827),
                                  ),
                                  items: ['Open', 'In Progress', 'Resolved', if (!['Open', 'In Progress', 'Resolved'].contains(_currentStatus)) _currentStatus]
                                      .map((s) => DropdownMenuItem(
                                          value: s, child: Text(s)))
                                      .toList(),
                                  onChanged: null,
                                  icon: const SizedBox.shrink(),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // ── Description ────────────────────────────────────────
                    const Text('Description',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280))),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Text(
                        complaint.description,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF374151),
                          height: 1.6,
                        ),
                      ),
                    ),

                    // ── Photo ──────────────────────────────────────────────
                    if (imagePath != null && imagePath.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const Text('Uploaded Photo',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280))),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.network(
                          UrlHelper.resolveImageUrl(imagePath),
                          width: double.infinity,
                          height: 200,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            height: 200,
                            color: Colors.grey.shade100,
                            child: const Icon(Icons.broken_image_rounded,
                                size: 48, color: Colors.grey),
                          ),
                        ),
                      ),
                    ],

                    // ── Escalation Tracking Timeline ──
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Icon(Icons.timeline_rounded, color: Color(0xFF2563EB), size: 16),
                        const SizedBox(width: 6),
                        const Text('Escalation Tracking',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF6B7280))),
                        const Spacer(),
                        if (_loadingChain)
                          const SizedBox(
                            width: 13, height: 13,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    if (complaint.status == TicketStatus.resolved || complaint.status == TicketStatus.closed)
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF86EFAC)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 18),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Complaint resolved — no further escalation needed.',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF15803D)),
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (_escalationChain != null)
                      ..._escalationChain!.chain.asMap().entries.map((entry) {
                        final idx = entry.key;
                        final step = entry.value;
                        final isLast = idx == _escalationChain!.chain.length - 1;

                        final Color nodeColor = step.isCompleted
                            ? const Color(0xFF16A34A)
                            : step.isActive
                                ? const Color(0xFF2563EB)
                                : const Color(0xFFD1D5DB);
                        final Color cardBg = step.isCompleted
                            ? const Color(0xFFF0FDF4)
                            : step.isActive
                                ? const Color(0xFFEFF6FF)
                                : const Color(0xFFF9FAFB);
                        final Color cardBorder = step.isCompleted
                            ? const Color(0xFF86EFAC)
                            : step.isActive
                                ? const Color(0xFF93C5FD)
                                : const Color(0xFFE5E7EB);

                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              children: [
                                Container(
                                  width: 28, height: 28,
                                  decoration: BoxDecoration(
                                    color: nodeColor.withValues(alpha: 0.15),
                                    shape: BoxShape.circle,
                                    border: Border.all(color: nodeColor, width: 2),
                                  ),
                                  child: Icon(
                                    step.isCompleted
                                        ? Icons.check_rounded
                                        : step.isActive
                                            ? Icons.radio_button_checked_rounded
                                            : Icons.radio_button_unchecked_rounded,
                                    color: nodeColor, size: 14,
                                  ),
                                ),
                                if (!isLast)
                                  Container(
                                    width: 2, height: 70,
                                    margin: const EdgeInsets.symmetric(vertical: 2),
                                    color: nodeColor.withValues(alpha: 0.3),
                                  ),
                              ],
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Container(
                                margin: EdgeInsets.only(bottom: isLast ? 0 : 6),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: cardBorder, width: step.isActive ? 1.5 : 1),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: nodeColor.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(5),
                                          ),
                                          child: Text('L${step.level}',
                                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: nodeColor, letterSpacing: 0.4)),
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(step.label,
                                              style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                                              overflow: TextOverflow.ellipsis),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: nodeColor.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(7),
                                          ),
                                          child: Text(
                                            step.isCompleted ? 'Done' : step.isActive ? 'Active' : 'Pending',
                                            style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: nodeColor),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(step.assigneeName,
                                        style: TextStyle(
                                          fontSize: 13, fontWeight: FontWeight.w700,
                                          color: step.isActive ? const Color(0xFF2563EB) : const Color(0xFF111827),
                                        )),
                                    if (step.assigneeRole.isNotEmpty)
                                      Text(step.assigneeRole,
                                          style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                                    if (step.assignedAt != null) ...[
                                      const SizedBox(height: 4),
                                      Text('Assigned: ${DateFormat('dd MMM, hh:mm a').format(step.assignedAt!)}',
                                          style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280))),
                                    ],
                                    if (step.isActive && step.escalatesAt != null) ...[
                                      const SizedBox(height: 6),
                                      _buildEscalationCountdown(step.escalatesAt!),
                                    ],
                                    if (!step.isActive && !step.isCompleted && step.estimatedEscalationAt != null) ...[
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          const Icon(Icons.schedule_rounded, size: 11, color: Color(0xFF9CA3AF)),
                                          const SizedBox(width: 3),
                                          Flexible(
                                            child: Text(
                                              step.slaHours != null
                                                  ? 'Escalates after ${step.slaHours}h — est. ${DateFormat('dd MMM, hh:mm a').format(step.estimatedEscalationAt!)}'
                                                  : 'Est: ${DateFormat('dd MMM, hh:mm a').format(step.estimatedEscalationAt!)}',
                                              style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF), fontStyle: FontStyle.italic),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      })
                    else if (!_loadingChain)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF9FAFB),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFF9CA3AF)),
                            SizedBox(width: 6),
                            Text('Escalation tracking unavailable', style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                          ],
                        ),
                      ),

                    // ── Escalation history (privileged only) ───────────────
                    if (escalationHistory.isNotEmpty) ...[
                      const SizedBox(height: 20),
                      const Text('Escalation History',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280))),
                      const SizedBox(height: 10),
                      ...escalationHistory.map((e) {
                        final ts =
                            DateTime.parse(e.timestamp.toIso8601String());
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: const Color(0xFFFED7AA)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Icon(
                                      Icons.arrow_upward_rounded,
                                      size: 14,
                                      color: Color(0xFFEA580C)),
                                  const SizedBox(width: 6),
                                  Text(
                                    e.message ?? 'Escalated',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFFEA580C),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    DateFormat('dd MMM, hh:mm a')
                                        .format(ts),
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade500),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                e.message as String,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF92400E),
                                    height: 1.4),
                              ),
                            ],
                          ),
                        );
                      }),

                      // Timeline section
                      const SizedBox(height: 20),
                      const Text('Feedback Timeline',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280))),
                      const SizedBox(height: 10),
                      _buildTimeline(complaint, escalationHistory),
                    ],

                    // ── Remarks preview ────────────────────────────────────
                    if (remarks.isNotEmpty && (widget.staffPosition != 'Principal' || isEscalated)) ...[
                      const SizedBox(height: 20),
                      const Text('Remarks History',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280))),
                      const SizedBox(height: 10),
                      ...remarks.map((r) => _RemarkBubble(remark: r, ticket: complaint)),
                    ],

                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEscalationCountdown(DateTime deadline) {
    final now = DateTime.now();
    final diff = deadline.difference(now);
    final isPast = diff.isNegative;

    Color color;
    String label;
    IconData icon;

    if (isPast) {
      color = const Color(0xFFDC2626);
      label = 'SLA breached — escalation overdue';
      icon = Icons.warning_amber_rounded;
    } else if (diff.inHours < 4) {
      color = const Color(0xFFEA580C);
      final mins = diff.inMinutes % 60;
      label = 'Escalates in ${diff.inHours}h ${mins}m';
      icon = Icons.timer_rounded;
    } else if (diff.inHours < 24) {
      color = const Color(0xFFD97706);
      label = 'Escalates in ~${diff.inHours}h  (${DateFormat('hh:mm a').format(deadline)})';
      icon = Icons.timer_outlined;
    } else {
      color = const Color(0xFF6B7280);
      label = 'Escalates on ${DateFormat('dd MMM, hh:mm a').format(deadline)}';
      icon = Icons.event_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: 4),
          Flexible(child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color))),
        ],
      ),
    );
  }

  Widget _buildTimeline(Ticket complaint, List<TicketUpdate> escalationHistory) {
    final submittedAt = complaint.createdAt;
    final events = <Map<String, dynamic>>[
      {
        'label': 'Feedback Submitted',
        'sub': 'Assigned to Admin',
        'ts': submittedAt,
        'icon': Icons.add_circle_rounded,
        'color': const Color(0xFF2563EB),
      },
      ...escalationHistory.map((e) => {
            'label': 'Escalated: ${''} → ${''}',
            'sub': e.message as String,
            'ts': DateTime.parse(e.timestamp.toIso8601String()),
            'icon': Icons.arrow_upward_rounded,
            'color': const Color(0xFFEA580C),
          }),
    ];

    return Column(
      children: events.asMap().entries.map((entry) {
        final idx = entry.key;
        final ev = entry.value;
        final isLast = idx == events.length - 1;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color:
                        (ev['color'] as Color).withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(ev['icon'] as IconData,
                      size: 16, color: ev['color'] as Color),
                ),
                if (!isLast)
                  Container(
                    width: 2,
                    height: 40,
                    color: Colors.grey.shade200,
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(ev['label'] as String,
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF111827))),
                    const SizedBox(height: 2),
                    Text(ev['sub'] as String,
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade500)),
                    const SizedBox(height: 2),
                    Text(
                      DateFormat('dd MMM yyyy, hh:mm a')
                          .format(ev['ts'] as DateTime),
                      style: TextStyle(
                          fontSize: 11, color: Colors.grey.shade400),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      }).toList(),
    );
  }
}

// ===========================================================================
// Staff Remarks Sheet (Privileged only: Admin, Dean, Principal)
// ===========================================================================

class _StaffRemarksSheet extends StatefulWidget {
  final Ticket complaint;
  final String staffPosition;
  final String staffName;
  final bool canEdit;
  final VoidCallback onRemarkAdded;

  const _StaffRemarksSheet({
    Key? key,
    required this.complaint,
    required this.staffPosition,
    required this.staffName,
    this.canEdit = true,
    required this.onRemarkAdded,
  }) : super(key: key);

  @override
  State<_StaffRemarksSheet> createState() => _StaffRemarksSheetState();
}

class _StaffRemarksSheetState extends State<_StaffRemarksSheet> {
  final TextEditingController _remarkController = TextEditingController();
  int? _editingIndex;
  late String _currentStatus;
  bool _isUpdating = false;

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.complaint.statusLabel;
  }

  @override
  void dispose() {
    _remarkController.dispose();
    super.dispose();
  }

  Future<void> _saveRemarkAndStatus() async {
    setState(() => _isUpdating = true);
    try {
      final text = _remarkController.text.trim();
      final newStatusEnum = _mapStringToStatus(_currentStatus);
      final newStatusInt = newStatusEnum.index;

      await TicketService().updateTicketStatus(
        widget.complaint.id,
        newStatusEnum.index,
        text.isNotEmpty ? text : null,
      );

      // Local state update
      widget.complaint.status = newStatusEnum;
      if (text.isNotEmpty) {
        final remarks = widget.complaint.updates;
        final now = DateTime.now();
        if (_editingIndex != null) {
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
        }
        _remarkController.clear();
      }

      widget.onRemarkAdded();
      
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Updated successfully.'),
            backgroundColor: const Color(0xFF16A34A),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final remarks =
        widget.complaint.updates;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Remarks',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF111827),
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    widget.staffPosition,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              widget.complaint.ticketNumber ?? widget.complaint.id,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Colors.grey.shade400),
            ),
            const SizedBox(height: 16),

            // Remarks audit trail
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 240),
              child: remarks.isEmpty
                  ? Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Center(
                        child: Text('No remarks yet. Add one below.',
                            style: TextStyle(color: Color(0xFF9CA3AF))),
                      ),
                    )
                  : ListView.separated(
                      shrinkWrap: true,
                      itemCount: remarks.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) => _RemarkBubble(
                        remark: remarks[i],
                        ticket: widget.complaint,
                        canEdit: false,
                        onEdit: () {
                          setState(() {
                            _editingIndex = i;
                            _remarkController.text =
                                remarks[i].message ?? '';
                          });
                        },
                      ),
                    ),
            ),

            const SizedBox(height: 16),
            if (_editingIndex != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.edit_rounded,
                        size: 14, color: Color(0xFFEA580C)),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text('Editing existing remark',
                          style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFFEA580C),
                              fontWeight: FontWeight.w600)),
                    ),
                    GestureDetector(
                      onTap: () => setState(() {
                        _editingIndex = null;
                        _remarkController.clear();
                      }),
                      child: const Icon(Icons.close_rounded,
                          size: 16, color: Color(0xFFEA580C)),
                    ),
                  ],
                ),
              ),
            if (!widget.canEdit || widget.complaint.statusLabel == 'Resolved') ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.lock_outline_rounded,
                        size: 18, color: Color(0xFFEA580C)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        widget.complaint.statusLabel == 'Resolved'
                            ? 'This feedback has been resolved and is now closed.'
                            : 'You do not have permission to add remarks to this feedback.',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF92400E),
                            height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
            ] else ...[
              const SizedBox(height: 10),
              // Status Dropdown
              const Text('Status', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _currentStatus,
                    isExpanded: true,
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF111827)),
                    items: ['Open', 'In Progress', 'Resolved', if (!['Open', 'In Progress', 'Resolved'].contains(_currentStatus)) _currentStatus]
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _currentStatus = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Remark', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
              const SizedBox(height: 6),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: TextField(
                  controller: _remarkController,
                  maxLines: 3,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF374151),
                    height: 1.6,
                  ),
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.all(16),
                    border: InputBorder.none,
                    hintText: 'Enter your remark…',
                    hintStyle: TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 14,
                        fontWeight: FontWeight.w400),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      child: const Text('Cancel',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF6B7280))),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isUpdating ? null : _saveRemarkAndStatus,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      child: Text(
                          _editingIndex != null ? 'Update Remark' : 'Post Remark',
                          style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    ),
  );
  }
}

// ===========================================================================
// Remark Bubble
// ===========================================================================

class _RemarkBubble extends StatelessWidget {
  final TicketUpdate remark;
  final Ticket ticket;
  final bool canEdit;
  final VoidCallback? onEdit;

  const _RemarkBubble({
    Key? key,
    required this.remark,
    required this.ticket,
    this.canEdit = false,
    this.onEdit,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final ts = remark.timestamp;
    
    String role = 'Staff';
    if (remark.updatedBy == ticket.creatorName) {
      role = ticket.creatorRole;
    } else if (remark.updatedBy == 'System') {
      role = 'System';
    }
    
    final isPrincipal = role == 'Principal';
    final isDean = role == 'Dean';
    final isStudent = role == 'Student';
    final isEdited = false as bool? ?? false;

    Color badgeBg;
    Color badgeFg;
    if (isPrincipal) {
      badgeBg = const Color(0xFFF3E8FF);
      badgeFg = const Color(0xFF7C3AED);
    } else if (isDean) {
      badgeBg = const Color(0xFFFFF7ED);
      badgeFg = const Color(0xFFEA580C);
    } else if (isStudent) {
      badgeBg = const Color(0xFFE0F2FE);
      badgeFg = const Color(0xFF0284C7);
    } else if (role == 'System') {
      badgeBg = const Color(0xFFF1F5F9);
      badgeFg = const Color(0xFF475569);
    } else {
      badgeBg = const Color(0xFFEFF6FF);
      badgeFg = const Color(0xFF2563EB);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(role,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: badgeFg)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(remark.updatedBy ?? 'System',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF374151))),
              ),
              if (isEdited)
                Text('edited',
                    style: TextStyle(
                        fontSize: 10,
                        color: Colors.grey.shade400,
                        fontStyle: FontStyle.italic)),
              if (canEdit && onEdit != null) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: onEdit,
                  child: const Icon(Icons.edit_rounded,
                      size: 14, color: Color(0xFF6B7280)),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Text(remark.message ?? '',
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF374151),
                  height: 1.5)),
          const SizedBox(height: 6),
          Text(DateFormat('dd MMM yyyy, hh:mm a').format(ts),
              style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade400,
                  fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

// ===========================================================================
// Legacy Demo Ticket Card (Privileged only)
// ===========================================================================

class _DemoTicketCard extends StatelessWidget {
  final Ticket ticket;
  final String staffPosition;
  final ValueChanged<String> onRemarksUpdated;

  const _DemoTicketCard({
    Key? key,
    required this.ticket,
    required this.staffPosition,
    required this.onRemarksUpdated,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final status = ticket.statusLabel;
    final createdAt = ticket.createdAt;
    final level = _legacyEscalationLevel(createdAt);
    final canEdit = _canEditLegacyRemarks(level, staffPosition);
    final canViewRemarks = !(staffPosition == 'Principal' && level == 1);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(ticket.ticketNumber ?? ticket.id,
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF2563EB),
                        letterSpacing: 0.5),
                    overflow: TextOverflow.ellipsis),
              ),
              const SizedBox(width: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [

                  const SizedBox(width: 6),
                  _StatusBadge(status: status),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(ticket.title,
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF111827))),
          const SizedBox(height: 16),
          Divider(color: Colors.grey.shade200, height: 1),
          const SizedBox(height: 16),
          Row(
            children: [
              Icon(Icons.calendar_today_rounded,
                  size: 16, color: Colors.grey.shade400),
              const SizedBox(width: 6),
              Text(DateFormat('dd MMM yyyy').format(ticket.createdAt),
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade500)),
              const SizedBox(width: 16),
              Icon(Icons.location_on_rounded,
                  size: 16, color: Colors.grey.shade400),
              const SizedBox(width: 6),
              Expanded(
                child: Text(ticket.location,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Divider(color: Colors.grey.shade200, height: 1),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: 'View Details',
                  icon: Icons.info_outline_rounded,
                  color: const Color(0xFF2563EB),
                  bgColor: const Color(0xFFEFF6FF),
                  onTap: () => _showDetailsSheet(context, ticket, level),
                ),
              ),
              if (canViewRemarks) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: _ActionButton(
                    label: canEdit ? 'Remarks' : 'View Remarks',
                    icon: canEdit
                        ? Icons.edit_note_rounded
                        : Icons.comment_outlined,
                    color: canEdit
                        ? const Color(0xFF16A34A)
                        : const Color(0xFF6B7280),
                    bgColor: canEdit
                        ? const Color(0xFFDCFCE7)
                        : const Color(0xFFF3F4F6),
                    onTap: () =>
                        _showRemarksSheet(context, ticket, level, canEdit),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  void _showDetailsSheet(
      BuildContext context, Ticket ticket, int level) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LegacyDetailsSheet(ticket: ticket, level: level, staffPosition: staffPosition),
    );
  }

  void _showRemarksSheet(
      BuildContext context,
      Ticket ticket,
      int level,
      bool canEdit) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LegacyRemarksSheet(
        ticket: ticket,
        level: level,
        canEdit: canEdit,
        staffPosition: staffPosition,
        onSave: onRemarksUpdated,
      ),
    );
  }
}

// ===========================================================================
// Shared small widgets
// ===========================================================================

class _LevelBadge extends StatelessWidget {
  final int level;
  const _LevelBadge({Key? key, required this.level}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Level 1 = Admin Officer/Dean (green), Level 2 = Principal (red)
    final Color bg = level == 1
        ? const Color(0xFFDCFCE7)
        : const Color(0xFFFFE4E6);
    final Color fg = level == 1
        ? const Color(0xFF16A34A)
        : const Color(0xFFDC2626);
    final IconData icon = level == 1
        ? Icons.looks_one_rounded
        : Icons.looks_two_rounded;
    final String label = level == 1
        ? 'Lv.1 — Admin/Dean'
        : 'Lv.2 — Principal';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
          color: bg, borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Text(label,
              style: TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({Key? key, required this.status}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(status,
          style: const TextStyle(
              color: Color(0xFF2563EB),
              fontSize: 12,
              fontWeight: FontWeight.w700)),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _ActionButton({
    Key? key,
    required this.label,
    required this.icon,
    required this.color,
    required this.bgColor,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
            color: bgColor, borderRadius: BorderRadius.circular(12)),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: color)),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _DetailRow(
      {Key? key,
      required this.icon,
      required this.label,
      required this.value})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF2563EB)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.grey.shade500)),
                const SizedBox(height: 3),
                Text(value,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Legacy Detail Sheet
// ===========================================================================

class _LegacyDetailsSheet extends StatelessWidget {
  final Ticket ticket;
  final int level;
  final String staffPosition;

  const _LegacyDetailsSheet(
      {Key? key, required this.ticket, required this.level, required this.staffPosition})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (_, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Feedback Details',
                        style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF111827))),
                  ),

                ],
              ),
            ),
            const SizedBox(height: 20),
            Divider(color: Colors.grey.shade200, height: 1),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _DetailRow(
                        icon: Icons.confirmation_number_rounded,
                        label: 'Ticket ID',
                        value: ticket.ticketNumber ?? ticket.id),
                    _DetailRow(
                        icon: Icons.flag_rounded,
                        label: 'Status',
                        value: ticket.statusLabel),
                    _DetailRow(
                        icon: Icons.calendar_today_rounded,
                        label: 'Date Submitted',
                        value: DateFormat('dd MMM yyyy').format(ticket.createdAt)),
                    _DetailRow(
                        icon: Icons.location_on_rounded,
                        label: 'Location',
                        value: ticket.location),
                    _DetailRow(
                        icon: Icons.trending_up_rounded,
                        label: 'Escalation Level',
                        value: 'Level ${ticket.escalationLevel}'),
                    _DetailRow(
                        icon: Icons.person_pin_circle_rounded,
                        label: 'Current Assignee',
                        value: '${ticket.assignedTo} (${ticket.assignedRole})'),
                    const SizedBox(height: 8),
                    const Text('Description',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280))),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Text(ticket.description,
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF374151),
                              height: 1.6)),
                    ),
                    const SizedBox(height: 16),
                    if ((ticket.updates as List).isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const Text('Current Remarks',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280))),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: const Color(0xFFFED7AA)),
                        ),
                        child: Text(ticket.updates.isNotEmpty ? (ticket.updates.last.message ?? '') : '',
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Color(0xFF92400E),
                                height: 1.6)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegacyEscalationCard extends StatelessWidget {
  final int level;
  const _LegacyEscalationCard({Key? key, required this.level})
      : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color border;
    Color fg;
    IconData icon;
    String title;
    String desc;

    if (level == 1) {
      bg = const Color(0xFFDCFCE7);
      border = const Color(0xFFBBF7D0);
      fg = const Color(0xFF166534);
      icon = Icons.looks_one_rounded;
      title = 'Level 1 — HOD / Warden / Canteen Head';
      desc = 'Being handled by Level 1 authorities. Escalates to Level 2 (Admin / Dean) if unresolved within 24 hours.';
    } else if (level == 2) {
      bg = const Color(0xFFFEF9C3);
      border = const Color(0xFFFEF08A);
      fg = const Color(0xFF854D0E);
      icon = Icons.looks_two_rounded;
      title = 'Level 2 — Admin / Dean';
      desc = 'Being handled by Admin or Dean. Escalates to Principal if unresolved.';
    } else {
      bg = const Color(0xFFFFE4E6);
      border = const Color(0xFFFECACA);
      fg = const Color(0xFF991B1B);
      icon = Icons.looks_3_rounded;
      title = 'Level 3 — Escalated to Principal';
      desc = 'Unresolved for over time limit. Escalated to Principal for final action.';
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: fg)),
                const SizedBox(height: 4),
                Text(desc,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: fg,
                        height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ===========================================================================
// Legacy Remarks Sheet
// ===========================================================================

class _LegacyRemarksSheet extends StatefulWidget {
  final Ticket ticket;
  final int level;
  final bool canEdit;
  final String staffPosition;
  final ValueChanged<String> onSave;

  const _LegacyRemarksSheet({
    Key? key,
    required this.ticket,
    required this.level,
    required this.canEdit,
    required this.staffPosition,
    required this.onSave,
  }) : super(key: key);

  @override
  State<_LegacyRemarksSheet> createState() => _LegacyRemarksSheetState();
}

class _LegacyRemarksSheetState extends State<_LegacyRemarksSheet> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller =
        TextEditingController(text: widget.ticket.updates as String);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _save() {
    widget.onSave(_controller.text.trim());
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Remarks saved successfully.'),
        backgroundColor: const Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.canEdit ? 'Add / Update Remarks' : 'View Remarks',
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF111827)),
                  ),
                ),

              ],
            ),
            const SizedBox(height: 6),
            Text('Ticket: ${widget.ticket.ticketNumber ?? widget.ticket.id}',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500)),
            const SizedBox(height: 16),
            if (!widget.canEdit) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFED7AA)),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.lock_outline_rounded,
                        size: 18, color: Color(0xFFEA580C)),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Only Admin, Dean and Principal can update remarks.',
                        style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF92400E),
                            height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            Container(
              decoration: BoxDecoration(
                color: widget.canEdit
                    ? const Color(0xFFF8FAFC)
                    : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: TextField(
                controller: _controller,
                readOnly: !widget.canEdit,
                maxLines: 5,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF374151),
                    height: 1.6),
                decoration: InputDecoration(
                  contentPadding: const EdgeInsets.all(16),
                  border: InputBorder.none,
                  hintText: widget.canEdit
                      ? 'Enter your remarks here…'
                      : 'No remarks added yet.',
                  hintStyle: TextStyle(
                      color: Colors.grey.shade400,
                      fontSize: 14,
                      fontWeight: FontWeight.w400),
                ),
              ),
            ),
            const SizedBox(height: 20),
            if (widget.canEdit)
              Row(
                children: [
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: BorderSide(color: Colors.grey.shade300),
                        ),
                      ),
                      child: const Text('Cancel',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF6B7280))),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: const Text('Save Remarks',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6B7280),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: const Text('Close',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ===========================================================================
// Complaint Form Screen
// ===========================================================================

class StaffComplaintFormScreen extends StatefulWidget {
  final String submittedBy;
  final String submittedByRole;
  final void Function(Ticket complaint) onComplaintSubmitted;

  const StaffComplaintFormScreen({
    Key? key,
    required this.submittedBy,
    required this.submittedByRole,
    required this.onComplaintSubmitted,
  }) : super(key: key);

  @override
  State<StaffComplaintFormScreen> createState() =>
      _StaffComplaintFormScreenState();
}

class _StaffComplaintFormScreenState extends State<StaffComplaintFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _uuid = const Uuid();

  String? _selectedLocation;
  String? _selectedCategory;
  XFile? _pickedImage;
  bool _isSubmitting = false;

  final ImagePicker _picker = ImagePicker();

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );
      if (image != null) setState(() => _pickedImage = image);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Could not pick image: $e'),
          backgroundColor: const Color(0xFFDC2626),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ));
      }
    }
  }

  void _showImagePickerDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Add Photo',
                style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF111827))),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _ImageSourceTile(
                    icon: Icons.camera_alt_rounded,
                    label: 'Camera',
                    color: const Color(0xFF2563EB),
                    bgColor: const Color(0xFFEFF6FF),
                    onTap: () {
                      Navigator.pop(context);
                      _pickImage(ImageSource.camera);
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _ImageSourceTile(
                    icon: Icons.photo_library_rounded,
                    label: 'Gallery',
                    color: const Color(0xFF7C3AED),
                    bgColor: const Color(0xFFF3E8FF),
                    onTap: () {
                      Navigator.pop(context);
                      _pickImage(ImageSource.gallery);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  void _submitComplaint() async {
    if (!_formKey.currentState!.validate()) return;
    if (_descriptionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text('Description is required.'),
        backgroundColor: const Color(0xFFDC2626),
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ));
      return;
    }

    setState(() => _isSubmitting = true);
    await Future.delayed(const Duration(milliseconds: 600));

    final now = DateTime.now();
    final id =
        'STF-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${_uuid.v4().substring(0, 4).toUpperCase()}';

    final complaint = Ticket(
      id: id,
      title: _titleController.text.trim().isEmpty ? 'Untitled Feedback' : _titleController.text.trim(),
      description: _descriptionController.text.trim(),
      location: _selectedLocation ?? 'Not specified',
      category: _selectedCategory ?? 'Other',
      priority: TicketPriority.medium,
      status: TicketStatus.open,
      createdAt: now,
      updatedAt: now,
      creatorId: widget.submittedBy,
      creatorName: widget.submittedBy,
      creatorRole: widget.submittedByRole,
      updates: [],
    );

    widget.onComplaintSubmitted(complaint);

    if (mounted) {
      setState(() => _isSubmitting = false);
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: const Text(
            'Feedback submitted successfully! Assigned to Admin.'),
        backgroundColor: const Color(0xFF16A34A),
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: GestureDetector(
          onTap: () => Navigator.of(context).pop(),
          child: Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 10,
                    offset: const Offset(0, 2))
              ],
            ),
            child: const Icon(Icons.arrow_back_rounded,
                color: Color(0xFF111827), size: 20),
          ),
        ),
        title: const Text('Submit Feedback',
            style: TextStyle(
                color: Color(0xFF111827),
                fontSize: 18,
                fontWeight: FontWeight.w800)),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.report_problem_rounded,
                              color: Colors.white, size: 20),
                        ),
                        const SizedBox(width: 12),
                        const Text('New Feedback',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Submitted by ${widget.submittedBy} · ${widget.submittedByRole}',
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                          fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 4),
                    const Text('Will be assigned to Admin on submission',
                        style: TextStyle(
                            color: Colors.white60, fontSize: 12)),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              // Complaint Title
              _buildSectionLabel('Feedback Title', Icons.title_rounded),
              const SizedBox(height: 10),
              _buildTextField(
                  controller: _titleController,
                  hint: 'e.g., Water leakage in corridor',
                  icon: Icons.title_rounded),

              const SizedBox(height: 20),

              // Description (required)
              Row(
                children: [
                  _buildSectionLabel(
                      'Description', Icons.description_rounded),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFE4E6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('Required',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFDC2626))),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _buildTextField(
                controller: _descriptionController,
                hint: 'Describe the feedback in detail…',
                icon: Icons.description_rounded,
                maxLines: 4,
                validator: (v) =>
                    (v == null || v.trim().isEmpty)
                        ? 'Description is required'
                        : null,
              ),

              const SizedBox(height: 20),

              // Location
              _buildSectionLabel('Location', Icons.location_on_rounded),
              const SizedBox(height: 10),
              _buildDropdown(
                value: _selectedLocation,
                hint: 'Select location',
                items: _locations,
                onChanged: (v) => setState(() => _selectedLocation = v),
              ),

              const SizedBox(height: 20),

              // Category
              _buildSectionLabel('Category', Icons.category_rounded),
              const SizedBox(height: 10),
              _buildDropdown(
                value: _selectedCategory,
                hint: 'Select category',
                items: _categories,
                onChanged: (v) => setState(() => _selectedCategory = v),
              ),

              const SizedBox(height: 20),

              const SizedBox(height: 24),

              // Photo upload
              _buildSectionLabel(
                  'Photo (Optional)', Icons.photo_camera_rounded),
              const SizedBox(height: 10),
              if (_pickedImage == null)
                GestureDetector(
                  onTap: _showImagePickerDialog,
                  child: Container(
                    width: double.infinity,
                    height: 120,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.grey.shade200),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 10,
                            offset: const Offset(0, 4))
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                              Icons.add_photo_alternate_rounded,
                              size: 28,
                              color: Color(0xFF2563EB)),
                        ),
                        const SizedBox(height: 10),
                        const Text('Tap to add photo',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF374151))),
                        const SizedBox(height: 4),
                        Text('Camera or Gallery',
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                )
              else
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: kIsWeb 
                          ? Image.network(
                              _pickedImage!.path,
                              width: double.infinity,
                              height: 200,
                              fit: BoxFit.cover,
                            )
                          : Image.file(
                              File(_pickedImage!.path),
                              width: double.infinity,
                              height: 200,
                              fit: BoxFit.cover,
                            ),
                    ),
                    Positioned(
                      top: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: () => setState(() => _pickedImage = null),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                              color: const Color(0xFFDC2626),
                              borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.close_rounded,
                              color: Colors.white, size: 16),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 8,
                      right: 8,
                      child: GestureDetector(
                        onTap: _showImagePickerDialog,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.edit_rounded,
                                  color: Colors.white, size: 13),
                              SizedBox(width: 4),
                              Text('Change',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

              const SizedBox(height: 32),

              // Submit button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submitComplaint,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    disabledBackgroundColor:
                        const Color(0xFF2563EB).withValues(alpha: 0.6),
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18)),
                    elevation: 4,
                    shadowColor:
                        const Color(0xFF2563EB).withValues(alpha: 0.4),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.5, color: Colors.white),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.send_rounded,
                                color: Colors.white, size: 20),
                            SizedBox(width: 10),
                            Text('Submit Feedback',
                                style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                    letterSpacing: 0.3)),
                          ],
                        ),
                ),
              ),

              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String label, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF2563EB)),
        const SizedBox(width: 8),
        Text(label,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF374151))),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        validator: validator,
        style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: Color(0xFF374151)),
        decoration: InputDecoration(
          prefixIcon: maxLines == 1
              ? Icon(icon, color: Colors.grey.shade400, size: 20)
              : null,
          contentPadding: EdgeInsets.symmetric(
            horizontal: maxLines == 1 ? 0 : 16,
            vertical: 14,
          ),
          border: InputBorder.none,
          hintText: hint,
          hintStyle: TextStyle(
              color: Colors.grey.shade400,
              fontSize: 14,
              fontWeight: FontWeight.w400),
        ),
      ),
    );
  }

  Widget _buildDropdown({
    required String? value,
    required String hint,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4))
        ],
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(hint,
              style: TextStyle(
                  color: Colors.grey.shade400,
                  fontSize: 14,
                  fontWeight: FontWeight.w400)),
          isExpanded: true,
          icon: Icon(Icons.keyboard_arrow_down_rounded,
              color: Colors.grey.shade400),
          style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Color(0xFF374151)),
          items: items
              .map((item) =>
                  DropdownMenuItem(value: item, child: Text(item)))
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ===========================================================================
// Image source tile
// ===========================================================================

class _ImageSourceTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _ImageSourceTile({
    Key? key,
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          children: [
            Icon(icon, size: 36, color: color),
            const SizedBox(height: 10),
            Text(label,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: color)),
          ],
        ),
      ),
    );
  }
}
