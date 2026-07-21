import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/models/ticket.dart';
import 'package:campus_connect/services/ticket_service.dart';
import 'package:campus_connect/utils/app_spacing.dart';

class StaffTicketDetailsScreen extends StatefulWidget {
  final Ticket ticket;
  final TicketService ticketService;
  final String staffPosition;
  final bool isPrivileged;

  const StaffTicketDetailsScreen({
    Key? key,
    required this.ticket,
    required this.ticketService,
    required this.staffPosition,
    required this.isPrivileged,
  }) : super(key: key);

  @override
  State<StaffTicketDetailsScreen> createState() => _StaffTicketDetailsScreenState();
}

class _StaffTicketDetailsScreenState extends State<StaffTicketDetailsScreen> {
  late Ticket _ticket;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _ticket = widget.ticket;
    _refreshTicket();
  }

  Future<void> _refreshTicket() async {
    try {
      final updated = await widget.ticketService.getTicketById(_ticket.id);
      if (mounted && updated != null) {
        setState(() => _ticket = updated);
      }
    } catch (e) {
      debugPrint("Error fetching ticket: $e");
    }
  }

  Future<void> _updateStatus(int newStatusId) async {
    setState(() => _isLoading = true);
    try {
      await widget.ticketService.updateTicketStatus(_ticket.id, newStatusId);
      await _refreshTicket();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Status updated')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _resolveTicket(String remarks) async {
    setState(() => _isLoading = true);
    try {
      await widget.ticketService.resolveTicket(_ticket.id, remarks);
      await _refreshTicket();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket resolved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showResolveDialog() {
    final _remarksController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Resolve Ticket'),
        content: TextField(
          controller: _remarksController,
          decoration: const InputDecoration(labelText: 'Resolution Remarks', border: OutlineInputBorder()),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _resolveTicket(_remarksController.text.trim());
            },
            child: const Text('Resolve'),
          ),
        ],
      ),
    );
  }

  Future<void> _assignTicket(String assigneeName) async {
    setState(() => _isLoading = true);
    try {
      await widget.ticketService.assignTicket(_ticket.id, assigneeName);
      await _refreshTicket();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ticket assigned')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAssignDialog() {
    final _assigneeController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Assign Ticket'),
        content: TextField(
          controller: _assigneeController,
          decoration: const InputDecoration(labelText: 'Assignee Name', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _assignTicket(_assigneeController.text.trim());
            },
            child: const Text('Assign'),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.md(context)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: AppSpacing.iconSm(context) - 2, color: Colors.grey.shade400),
          SizedBox(width: AppSpacing.sm(context)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: TextStyle(fontSize: AppSpacing.fontCardTitle(context) - 2, fontWeight: FontWeight.w500, color: Colors.grey.shade500)),
                SizedBox(height: AppSpacing.xs(context) / 2),
                Text(value, style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), fontWeight: FontWeight.w600, color: const Color(0xFF111827))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: const BackButton(color: Colors.black),
        title: const Text('Ticket Details', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(AppSpacing.xl(context)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailRow(Icons.confirmation_number_rounded, 'Complaint ID', _ticket.ticketNumber ?? _ticket.id),
                  _buildDetailRow(Icons.title_rounded, 'Title', _ticket.title),
                  _buildDetailRow(Icons.category_rounded, 'Category', _ticket.category),
                  _buildDetailRow(Icons.location_on_rounded, 'Location', _ticket.location),
                  _buildDetailRow(Icons.schedule_rounded, 'Submitted At', DateFormat('dd MMM yyyy, hh:mm a').format(_ticket.createdAt)),
                  _buildDetailRow(Icons.info_outline, 'Status', _ticket.statusLabel),
                  if (_ticket.assignedTo.isNotEmpty)
                    _buildDetailRow(Icons.person, 'Assigned To', _ticket.assignedTo),
                  if (_ticket.updates.isNotEmpty)
                    _buildDetailRow(Icons.comment, 'Latest Update', _ticket.updates.last.message),

                  SizedBox(height: AppSpacing.md(context)),
                  Text('Description', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context) - 1, fontWeight: FontWeight.w600, color: const Color(0xFF6B7280))),
                  SizedBox(height: AppSpacing.xs(context)),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.all(AppSpacing.md(context)),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Text(
                      _ticket.description,
                      style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), fontWeight: FontWeight.w500, color: const Color(0xFF374151), height: 1.6),
                    ),
                  ),

                  SizedBox(height: AppSpacing.xl(context)),

                  if (widget.isPrivileged && _ticket.status != 2) ...[
                    const Divider(),
                    SizedBox(height: AppSpacing.md(context)),
                    Text('Actions', style: TextStyle(fontSize: AppSpacing.fontSectionHeader(context), fontWeight: FontWeight.w700)),
                    SizedBox(height: AppSpacing.md(context)),
                    Row(
                      children: [
                        if (_ticket.status == 0)
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () => _updateStatus(1), // 1 = In Progress
                              style: ElevatedButton.styleFrom(backgroundColor: Colors.orange, padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context))),
                              child: Text('Mark In Progress', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), color: Colors.white, fontWeight: FontWeight.bold)),
                            ),
                          ),
                        if (_ticket.status == 0) SizedBox(width: AppSpacing.sm(context)),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _showResolveDialog,
                            style: ElevatedButton.styleFrom(backgroundColor: Colors.green, padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context))),
                            child: Text('Resolve Ticket', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: AppSpacing.md(context)),
                    if (_ticket.status != 2)
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _showAssignDialog,
                          style: OutlinedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: AppSpacing.md(context))),
                          child: Text('Assign Ticket', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), fontWeight: FontWeight.bold)),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}
