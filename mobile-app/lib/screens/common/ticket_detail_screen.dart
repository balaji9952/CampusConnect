import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'package:campus_connect/services/realtime_service.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/services/auth_service.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/models/user.dart';

class TicketDetailScreen extends StatefulWidget {
  final Ticket? ticket;
  final String? ticketId;
  final TicketService ticketService;
  final AuthService? authService;

  const TicketDetailScreen({
    super.key, 
    this.ticket, 
    this.ticketId,
    required this.ticketService, 
    this.authService
  }) : assert(ticket != null || ticketId != null);

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  Ticket? _ticket;
  bool _isLoading = false;
  String? _error;
  EscalationChain? _escalationChain;
  bool _loadingChain = false;

  StreamSubscription? _socketSubscription;

  @override
  void initState() {
    super.initState();
    final String tId = widget.ticket?.id ?? widget.ticketId!;
    
    if (widget.ticket != null) {
      _ticket = widget.ticket;
      _loadEscalationChain(tId);
    } else {
      _loadTicket();
    }

    RealtimeService().joinTicketRoom(tId);
    _socketSubscription = RealtimeService().ticketUpdatesStream.listen((update) {
      if (update['data']['id'] == tId) {
        setState(() {
          _ticket = Ticket.fromJson(update['data']);
        });
        _loadEscalationChain(tId);
      }
    });
  }

  @override
  void dispose() {
    final String tId = widget.ticket?.id ?? widget.ticketId!;
    RealtimeService().leaveTicketRoom(tId);
    _socketSubscription?.cancel();
    super.dispose();
  }

  Future<void> _loadTicket() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final t = await widget.ticketService.getTicketById(widget.ticketId!);
      if (t != null) {
        setState(() => _ticket = t);
        _loadEscalationChain(t.id);
      } else {
        setState(() => _error = "Ticket not found");
      }
    } catch(e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadEscalationChain(String ticketId) async {
    setState(() => _loadingChain = true);
    try {
      final chain = await widget.ticketService.getEscalationChain(ticketId);
      if (mounted) setState(() => _escalationChain = chain);
    } catch (_) {} finally {
      if (mounted) setState(() => _loadingChain = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppColors.bgLight,
        appBar: AppBar(backgroundColor: AppColors.bgLight, elevation: 0, iconTheme: const IconThemeData(color: AppColors.textPrimary)),
        body: const Center(child: CircularProgressIndicator(color: AppColors.primary)),
      );
    }

    if (_error != null || _ticket == null) {
      return Scaffold(
        backgroundColor: AppColors.bgLight,
        appBar: AppBar(backgroundColor: AppColors.bgLight, elevation: 0, iconTheme: const IconThemeData(color: AppColors.textPrimary)),
        body: Center(child: Text(_error ?? 'Ticket not found', style: const TextStyle(color: AppColors.textPrimary))),
      );
    }

    final t = _ticket!;
    final statusColor = AppColors.getStatusColor(t.statusLabel);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      body: SafeArea(
        child: Column(
          children: [
              // App bar
              Padding(
                padding: EdgeInsets.all(AppSpacing.sm(context) + 4),
                child: Row(children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: EdgeInsets.all(AppSpacing.sm(context)),
                      decoration: BoxDecoration(
                        color: AppColors.bgCard,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary, size: AppSpacing.iconXS(context) + 4),
                    ),
                  ),
                  SizedBox(width: AppSpacing.md(context)),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t.ticketNumber ?? t.id, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                    Text(DateFormat('dd MMM yyyy, hh:mm a').format(t.createdAt), style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
                  ])),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm(context) + 2,
                      vertical: AppSpacing.xs(context),
                    ),
                    decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context))),
                    child: Text(t.statusLabel, style: TextStyle(color: statusColor, fontWeight: FontWeight.w700, fontSize: AppSpacing.fontCardTitle(context))),
                  ),
                ]),
              ),

              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Info card
                    Container(
                      width: double.infinity,
                      padding: AppSpacing.cardPadding(context),
                      decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)), border: Border.all(color: AppColors.border), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2))]),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Complaint Details', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
                        const SizedBox(height: 16),
                        _detail(context, 'Location', t.location, Icons.location_on_rounded),
                        _detail(context, 'Category', t.category, Icons.category_rounded),
                        _detail(context, 'Escalation Level', 'Level ${t.escalationLevel}', Icons.trending_up_rounded),
                        _detail(context, 'Assigned To', '${t.assignedTo} (${t.assignedRole})', Icons.person_rounded),
                        const SizedBox(height: 12),
                        Text('Description', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textHint, fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(t.description, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)),
                      ]),
                    ).animate().fadeIn(duration: 400.ms),

                    const SizedBox(height: 20),

                    // ── Escalation Tracking Timeline ────────────────────────────
                    _buildEscalationTrackingSection(context, t),

                    const SizedBox(height: 20),

                    // Activity Timeline
                    Text('Activity Timeline', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: AppColors.textPrimary))
                        .animate(delay: 300.ms).fadeIn(duration: 400.ms),
                    SizedBox(height: AppSpacing.md(context)),

                    ...t.updates.asMap().entries.map((entry) {
                      final i = entry.key;
                      final update = entry.value;
                      final isLast = i == t.updates.length - 1;
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Column(children: [
                            Container(
                              width: 12, height: 12,
                              decoration: BoxDecoration(color: i == 0 ? AppColors.primary : AppColors.border, shape: BoxShape.circle, border: Border.all(color: AppColors.primary, width: 2)),
                            ),
                            if (!isLast) Container(width: 2, height: 50, color: AppColors.primary.withValues(alpha: 0.2)),
                          ]),
                          SizedBox(width: AppSpacing.md(context)),
                          Expanded(
                            child: Container(
                              margin: EdgeInsets.only(bottom: AppSpacing.md(context)),
                              padding: EdgeInsets.all(AppSpacing.md(context) - 2),
                              decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                  Text(update.updatedBy, style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.w600, fontSize: AppSpacing.fontCardTitle(context))),
                                  Text(DateFormat('dd MMM, hh:mm a').format(update.timestamp), style: TextStyle(color: AppColors.textHint, fontSize: AppSpacing.fontCardTitle(context) - 2)),
                                ]),
                                SizedBox(height: AppSpacing.xs(context)),
                                Text(update.message, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
                              ]),
                            ),
                          ),
                        ],
                      ).animate(delay: Duration(milliseconds: 400 + i * 100)).fadeIn(duration: 400.ms).slideX(begin: 0.1, end: 0);
                    }),

                    const SizedBox(height: 20),
                    Builder(
                      builder: (context) {
                        bool canUpdate = false;
                        final user = widget.authService?.currentUser;
                        if (user != null && user.role == UserRole.staff) {
                          final designation = user.designation?.toLowerCase() ?? '';
                          if (t.escalationLevel <= 1) {
                            canUpdate = true; // any staff can update L1
                          } else if (t.escalationLevel == 2) {
                            canUpdate = designation.contains('hod') ||
                                designation.contains('dean') ||
                                designation.contains('warden') ||
                                designation.contains('canteen');
                          } else if (t.escalationLevel >= 3) {
                            canUpdate = designation.contains('principal') ||
                                designation.contains('dean');
                          }
                        }

                        if (!canUpdate) return const SizedBox.shrink();

                        return Column(
                          children: [
                            if (t.status != TicketStatus.closed && t.status != TicketStatus.resolved)
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    _showUpdateDialog(context, t);
                                  },
                                  icon: const Icon(Icons.edit_note_rounded, size: 18),
                                  label: const Text('Update Status & Add Remark'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    padding: EdgeInsets.symmetric(vertical: AppSpacing.sm(context) + 4),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context))),
                                  ),
                                ),
                              ).animate(delay: 500.ms).fadeIn(duration: 400.ms),
                          ],
                        );
                      },
                    ),

                    const SizedBox(height: 20),
                  ]),
                ),
              ),
            ],
          ),
        ),
      );
  }

  // ── Escalation Tracking Timeline Widget ─────────────────────────────────────
  Widget _buildEscalationTrackingSection(BuildContext context, Ticket t) {
    final isResolved = t.status == TicketStatus.resolved || t.status == TicketStatus.closed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.timeline_rounded, color: AppColors.primary, size: 18),
            const SizedBox(width: 8),
            Text(
              'Escalation Tracking',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const Spacer(),
            if (_loadingChain)
              const SizedBox(
                width: 14, height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
              ),
          ],
        ).animate(delay: 150.ms).fadeIn(duration: 400.ms),

        const SizedBox(height: 12),

        if (isResolved)
          _buildResolvedBanner(context)
        else if (_escalationChain != null)
          ..._buildChainSteps(context, t)
        else if (!_loadingChain)
          _buildChainUnavailable(context),
      ],
    );
  }

  Widget _buildResolvedBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.statusResolved.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.statusResolved.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.statusResolved.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_rounded, color: AppColors.statusResolved, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Complaint Resolved',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AppColors.statusResolved,
                  ),
                ),
                Text(
                  'This complaint has been successfully resolved. No further escalation needed.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate(delay: 200.ms).fadeIn(duration: 400.ms).scale(begin: const Offset(0.97, 0.97), end: const Offset(1, 1));
  }

  List<Widget> _buildChainSteps(BuildContext context, Ticket t) {
    final chain = _escalationChain!.chain;
    return chain.asMap().entries.map((entry) {
      final i = entry.key;
      final step = entry.value;
      final isLast = i == chain.length - 1;
      return _buildEscalationStep(context, step, isLast, i);
    }).toList();
  }

  Widget _buildEscalationStep(BuildContext context, EscalationChainStep step, bool isLast, int index) {
    final Color nodeColor;
    final Color nodeBorder;
    final Color cardBorder;
    final Color cardBg;
    final IconData nodeIcon;

    if (step.isCompleted) {
      nodeColor = AppColors.statusResolved;
      nodeBorder = AppColors.statusResolved;
      cardBorder = AppColors.statusResolved.withValues(alpha: 0.25);
      cardBg = AppColors.statusResolved.withValues(alpha: 0.04);
      nodeIcon = Icons.check_rounded;
    } else if (step.isActive) {
      nodeColor = AppColors.primary;
      nodeBorder = AppColors.primary;
      cardBorder = AppColors.primary.withValues(alpha: 0.35);
      cardBg = AppColors.primary.withValues(alpha: 0.05);
      nodeIcon = Icons.radio_button_checked_rounded;
    } else {
      nodeColor = AppColors.border;
      nodeBorder = AppColors.border;
      cardBorder = AppColors.border;
      cardBg = AppColors.bgLight;
      nodeIcon = Icons.radio_button_unchecked_rounded;
    }

    final Color connectorColor = step.isCompleted
        ? AppColors.statusResolved.withValues(alpha: 0.5)
        : step.isActive
            ? AppColors.primary.withValues(alpha: 0.3)
            : AppColors.border.withValues(alpha: 0.5);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: step.isCompleted || step.isActive ? nodeColor.withValues(alpha: 0.12) : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(color: nodeBorder, width: 2),
              ),
              child: Icon(nodeIcon, color: nodeColor, size: 16),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 80,
                margin: const EdgeInsets.symmetric(vertical: 2),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [connectorColor, connectorColor.withValues(alpha: 0.2)],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
          ],
        ),

        const SizedBox(width: 12),

        Expanded(
          child: Container(
            margin: EdgeInsets.only(bottom: isLast ? 0 : 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: cardBorder, width: step.isActive ? 1.5 : 1),
              boxShadow: step.isActive ? [
                BoxShadow(color: AppColors.primary.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2)),
              ] : [],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: step.isCompleted
                                      ? AppColors.statusResolved.withValues(alpha: 0.12)
                                      : step.isActive
                                          ? AppColors.primary.withValues(alpha: 0.12)
                                          : AppColors.border.withValues(alpha: 0.5),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  'L${step.level}',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: step.isCompleted
                                        ? AppColors.statusResolved
                                        : step.isActive
                                            ? AppColors.primary
                                            : AppColors.textHint,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  step.label,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.textSecondary,
                                    fontSize: 11,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            step.assigneeName,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: step.isActive ? AppColors.primary : AppColors.textPrimary,
                            ),
                          ),
                          if (step.assigneeRole.isNotEmpty)
                            Text(
                              step.assigneeRole,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppColors.textHint,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (step.isCompleted)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.statusResolved.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('Done', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.statusResolved)),
                      )
                    else if (step.isActive)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('Active', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.border.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('Pending', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textHint)),
                      ),
                  ],
                ),

                if (step.assignedAt != null) ...[
                  const SizedBox(height: 8),
                  const Divider(height: 1, color: Color(0xFFE8EDF2)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.person_pin_circle_rounded, size: 12, color: AppColors.statusResolved),
                      const SizedBox(width: 4),
                      Text(
                        'Assigned: ${DateFormat('dd MMM, hh:mm a').format(step.assignedAt!)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ],

                if (step.isActive && step.escalatesAt != null) ...[
                  const SizedBox(height: 6),
                  _buildCountdownRow(context, step.escalatesAt!),
                ],

                if (!step.isActive && !step.isCompleted && step.estimatedEscalationAt != null) ...[
                  const SizedBox(height: 8),
                  const Divider(height: 1, color: Color(0xFFE8EDF2)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.schedule_rounded, size: 12, color: AppColors.textHint),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          step.slaHours != null
                              ? 'Escalates if unresolved after ${step.slaHours}h — est. ${DateFormat('dd MMM, hh:mm a').format(step.estimatedEscalationAt!)}'
                              : 'Est. escalation: ${DateFormat('dd MMM yyyy, hh:mm a').format(step.estimatedEscalationAt!)}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textHint,
                            fontSize: 10,
                            fontStyle: FontStyle.italic,
                          ),
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
    ).animate(delay: Duration(milliseconds: 200 + index * 120)).fadeIn(duration: 400.ms).slideX(begin: -0.05, end: 0);
  }

  Widget _buildCountdownRow(BuildContext context, DateTime deadline) {
    final now = DateTime.now();
    final diff = deadline.difference(now);
    final isPast = diff.isNegative;

    Color color;
    String label;
    IconData icon;

    if (isPast) {
      color = AppColors.accent;
      label = 'SLA breached — escalation overdue';
      icon = Icons.warning_amber_rounded;
    } else if (diff.inHours < 4) {
      color = AppColors.statusEscalatedL3;
      final mins = diff.inMinutes % 60;
      label = 'Escalates in ${diff.inHours}h ${mins}m';
      icon = Icons.timer_rounded;
    } else if (diff.inHours < 24) {
      color = AppColors.statusEscalatedL2;
      label = 'Escalates in ~${diff.inHours}h  (${DateFormat('hh:mm a').format(deadline)})';
      icon = Icons.timer_outlined;
    } else {
      color = AppColors.textSecondary;
      label = 'Escalates on ${DateFormat('dd MMM, hh:mm a').format(deadline)}';
      icon = Icons.event_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          ),
        ],
      ),
    );
  }

  Widget _buildChainUnavailable(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.bgCardLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.textHint, size: 16),
          const SizedBox(width: 8),
          Text('Escalation tracking not available', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textHint)),
        ],
      ),
    );
  }
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _detail(BuildContext context, String label, String value, IconData icon, {Color? color}) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.sm(context)),
      child: Row(children: [
        Icon(icon, color: color ?? AppColors.primary, size: AppSpacing.iconSm(context)),
        SizedBox(width: AppSpacing.sm(context)),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary, fontSize: AppSpacing.fontCardTitle(context) - 2)),
          Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary, fontWeight: FontWeight.w600)),
        ]),
      ]),
    );
  }

  void _showUpdateDialog(BuildContext context, Ticket ticket) {
    TicketStatus selectedStatus = ticket.status;
    if (selectedStatus != TicketStatus.inProgress && selectedStatus != TicketStatus.resolved) {
      selectedStatus = TicketStatus.inProgress;
    }

    String remark = '';

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Update Ticket'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<TicketStatus>(
                    value: selectedStatus,
                    items: TicketStatus.values.where((s) {
                      return s == TicketStatus.inProgress || s == TicketStatus.resolved;
                    }).map((status) {
                      String label = status.toString().split('.').last;
                      return DropdownMenuItem(
                        value: status,
                        child: Text(label.toUpperCase()),
                      );
                    }).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => selectedStatus = val);
                      }
                    },
                    decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text('Remark', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  TextFormField(
                    onChanged: (val) => remark = val,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Enter your remark/comment here...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.all(12),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  onPressed: () {
                    if (remark.trim().isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a remark')));
                      return;
                    }
                    widget.ticketService.updateTicketStatus(ticket.id, selectedStatus.index, remark.trim());
                    Navigator.pop(context);
                    setState(() {});
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Update'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
