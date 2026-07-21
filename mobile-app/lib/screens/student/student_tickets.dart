import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/screens/staff/staff_tickets.dart';

class StudentTicketsScreen extends StatefulWidget {
  final TicketService ticketService;
  
  const StudentTicketsScreen({super.key, required this.ticketService});

  @override
  State<StudentTicketsScreen> createState() => _StudentTicketsScreenState();
}

class _StudentTicketsScreenState extends State<StudentTicketsScreen> {
  late Future<void> _fetchFuture;
  String _selectedFilter = 'All';
  final List<String> _filters = ['All', 'Open', 'In Progress', 'Resolved'];

  @override
  void initState() {
    super.initState();
    _fetchFuture = widget.ticketService.fetchTickets(limit: 50);
  }

  List<Ticket> get _filteredTickets {
    final all = widget.ticketService.tickets;
    if (_selectedFilter == 'All') return all;
    return all.where((t) {
      if (_selectedFilter == 'In Progress') {
        return t.statusLabel == 'In Progress' || t.statusLabel == 'Escalated';
      }
      return t.statusLabel == _selectedFilter;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8FAFF),
      child: SafeArea(
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
                  SizedBox(height: AppSpacing.xs(context)),
                  Text(
                    'Showing your submitted feedback',
                    style: TextStyle(
                      fontSize: AppSpacing.fontCardTitle(context) + 1,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade500,
                    ),
                  ),
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
              child: FutureBuilder<void>(
                future: _fetchFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snapshot.hasError) {
                    return const Center(child: Text("Error fetching tickets."));
                  }

                  if (_filteredTickets.isEmpty) {
                    return _buildEmptyState();
                  }

                  return ListView.separated(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.horizontalPad(context), 0,
                      AppSpacing.horizontalPad(context), 100,
                    ),
                    physics: const BouncingScrollPhysics(),
                    itemCount: _filteredTickets.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 16),
                    itemBuilder: (context, index) {
                      final ticket = _filteredTickets[index];
                      
                      String timeStr = '';
                      try {
                        final dt = DateTime.parse(ticket.createdAt.toString());
                        timeStr = DateFormat('dd MMM yyyy, hh:mm a').format(dt);
                      } catch (_) {
                        timeStr = ticket.createdAt.toString();
                      }

                      return ComplaintCard(
                        ticket: ticket,
                        ticketService: widget.ticketService,
                      );
                    },
                  );
                }
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
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
            'You haven\'t submitted any feedback yet.',
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

// Extracted ComplaintCard so it can be used by both the dashboard home and ticket screen
// Updated to match Staff UI ComplaintCard
class ComplaintCard extends StatelessWidget {
  final Ticket ticket;
  final TicketService ticketService;

  const ComplaintCard({
    super.key,
    required this.ticket,
    required this.ticketService,
  });

  Color _statusBg(String st) {
    if (st == 'Open') return const Color(0xFFEFF6FF);
    if (st == 'In Progress' || st == 'Escalated') return const Color(0xFFFFF7ED);
    if (st == 'Resolved') return const Color(0xFFDCFCE7);
    return const Color(0xFFF3F4F6);
  }

  Color _statusColorText(String st) {
    if (st == 'Open') return const Color(0xFF2563EB);
    if (st == 'In Progress' || st == 'Escalated') return const Color(0xFFEA580C);
    if (st == 'Resolved') return const Color(0xFF16A34A);
    return const Color(0xFF6B7280);
  }

  @override
  Widget build(BuildContext context) {
    final cp = AppSpacing.cardPadding(context);
    final compact = AppSpacing.isCompact(context);
    return Container(
      padding: cp,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        border: Border.all(color: Colors.grey.shade100, width: 1),
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
                  ticket.ticketNumber ?? ticket.id,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) + 1,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF2563EB),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: compact ? 8.0 : 10.0,
                  vertical: compact ? 3.0 : 5.0,
                ),
                decoration: BoxDecoration(
                  color: _statusBg(ticket.statusLabel),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  ticket.statusLabel,
                  style: TextStyle(
                    color: _statusColorText(ticket.statusLabel),
                    fontSize: AppSpacing.fontCardTitle(context),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),

          SizedBox(height: AppSpacing.sm(context)),

          // ── Title ────────────────────────────────────────────────────────
          Text(
            ticket.title,
            style: TextStyle(
              fontSize: AppSpacing.fontSectionHeader(context),
              fontWeight: FontWeight.w700,
              color: const Color(0xFF111827),
            ),
          ),

          SizedBox(height: AppSpacing.sm(context)),
          Divider(color: Colors.grey.shade200, height: 1),
          SizedBox(height: AppSpacing.sm(context)),

          // ── Date · Location (Category) ───────────────────────────────────
          Row(
            children: [
              Icon(Icons.schedule_rounded, size: AppSpacing.iconXS(context), color: Colors.grey.shade400),
              SizedBox(width: AppSpacing.xs(context)),
              Expanded(
                child: Text(
                  DateFormat('dd MMM yyyy, hh:mm a').format(ticket.createdAt),
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context),
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: AppSpacing.xs(context)),
          Row(
            children: [
              Icon(Icons.category_rounded, size: AppSpacing.iconXS(context), color: Colors.grey.shade400),
              SizedBox(width: AppSpacing.xs(context)),
              Expanded(
                child: Text(
                  ticket.category,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context),
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          SizedBox(height: AppSpacing.xs(context)),
          Row(
            children: [
              Icon(Icons.priority_high_rounded, size: AppSpacing.iconXS(context), color: Colors.grey.shade400),
              SizedBox(width: AppSpacing.xs(context)),
              Expanded(
                child: Text(
                  'Priority: ${ticket.priorityLabel}',
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context),
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),

          SizedBox(height: AppSpacing.md(context)),
          Divider(color: Colors.grey.shade200, height: 1),
          SizedBox(height: AppSpacing.sm(context)),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  backgroundColor: Colors.transparent,
                  builder: (_) => StaffComplaintDetailsSheet(
                    complaint: ticket,
                    staffPosition: 'Student', // Pass student as position so they get read-only access
                    staffName: 'Student',
                    ticketService: ticketService,
                    onStatusChanged: (_) {}, // Read-only for students/parents
                  ),
                );
              },
              icon: Icon(Icons.info_outline_rounded, color: const Color(0xFF2563EB), size: AppSpacing.iconXS(context) + 2),
              label: Text(
                'View Details',
                style: TextStyle(
                  color: const Color(0xFF2563EB),
                  fontSize: AppSpacing.fontCardTitle(context) + 1,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: TextButton.styleFrom(
                backgroundColor: const Color(0xFFEFF6FF),
                padding: EdgeInsets.symmetric(vertical: compact ? 10.0 : 12.0),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),


          // ── Tracking Message ─────────────────────────────────────────────
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, size: 14, color: Colors.grey.shade400),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Your feedback is being tracked. You\'ll be notified of updates.',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Colors.grey.shade500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}