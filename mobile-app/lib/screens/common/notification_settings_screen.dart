import 'package:flutter/material.dart';
import 'package:campus_connect/utils/app_spacing.dart';
import 'package:campus_connect/utils/app_colors.dart';
import 'package:campus_connect/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

class NotificationSettingsScreen extends StatefulWidget {
  final ApiService apiService;

  const NotificationSettingsScreen({super.key, required this.apiService});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  bool _isLoading = true;
  
  // Preferences state
  bool _ticketAssignments = true;
  bool _escalations = true;
  bool _resolutions = true;
  bool _reminders = true;
  bool _announcements = true;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    try {
      // 1. Try loading from local cache first for instant UI
      final prefs = await SharedPreferences.getInstance();
      final cachedPrefs = prefs.getString('notification_preferences');
      if (cachedPrefs != null) {
        final data = jsonDecode(cachedPrefs);
        setState(() {
          _ticketAssignments = data['ticket_assignments'] ?? true;
          _escalations = data['escalations'] ?? true;
          _resolutions = data['resolutions'] ?? true;
          _reminders = data['reminders'] ?? true;
          _announcements = data['announcements'] ?? true;
          _isLoading = false;
        });
      }

      // 2. Fetch fresh from API
      final response = await widget.apiService.get('/users/me/preferences');
      if (response != null && response['success'] == true && response['data'] != null) {
        final data = response['data'];
        
        // Cache it
        await prefs.setString('notification_preferences', jsonEncode(data));

        if (mounted) {
          setState(() {
            _ticketAssignments = data['ticket_assignments'] ?? true;
            _escalations = data['escalations'] ?? true;
            _resolutions = data['resolutions'] ?? true;
            _reminders = data['reminders'] ?? true;
            _announcements = data['announcements'] ?? true;
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      debugPrint('[NotificationSettings] Failed to load preferences: $e');
      if (mounted && _isLoading) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to load preferences'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _updatePreference(String key, bool value, void Function() revert) async {
    try {
      // Optistic Update logic is handled by caller (the Switch onChange)
      
      // Build the update payload based on current local state
      final payload = {
        'ticket_assignments': _ticketAssignments,
        'escalations': _escalations,
        'resolutions': _resolutions,
        'reminders': _reminders,
        'announcements': _announcements,
      };
      
      // Override the specific key being updated
      payload[key] = value;

      final response = await widget.apiService.put('/users/me/preferences', body: payload);
      
      if (response != null && response['success'] == true) {
        // Cache the successful update
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('notification_preferences', jsonEncode(payload));
      } else {
        throw Exception('API returned failure');
      }
    } catch (e) {
      debugPrint('[NotificationSettings] Failed to update preference: $e');
      revert();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to save preference'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Widget _buildSwitchTile({
    required String title,
    required String description,
    required bool value,
    required String prefKey,
    required IconData icon,
    required Color iconColor,
  }) {
    return Container(
      margin: EdgeInsets.only(bottom: AppSpacing.md(context)),
      padding: AppSpacing.cardPadding(context),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(AppSpacing.isCompact(context) ? 8.0 : 10.0),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: AppSpacing.iconMd(context)),
          ),
          SizedBox(width: AppSpacing.md(context)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: AppSpacing.xs(context)),
                Text(
                  description,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(width: AppSpacing.sm(context)),
          Switch.adaptive(
            value: value,
            activeColor: AppColors.primary,
            onChanged: (newValue) {
              // Optimistic UI update
              setState(() {
                switch (prefKey) {
                  case 'ticket_assignments': _ticketAssignments = newValue; break;
                  case 'escalations': _escalations = newValue; break;
                  case 'resolutions': _resolutions = newValue; break;
                  case 'reminders': _reminders = newValue; break;
                  case 'announcements': _announcements = newValue; break;
                }
              });

              // Revert callback if API fails
              void revert() {
                if (mounted) {
                  setState(() {
                    switch (prefKey) {
                      case 'ticket_assignments': _ticketAssignments = !newValue; break;
                      case 'escalations': _escalations = !newValue; break;
                      case 'resolutions': _resolutions = !newValue; break;
                      case 'reminders': _reminders = !newValue; break;
                      case 'announcements': _announcements = !newValue; break;
                    }
                  });
                }
              }

              _updatePreference(prefKey, newValue, revert);
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        elevation: 0,
        title: Text(
          'Notification Settings',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: EdgeInsets.all(AppSpacing.horizontalPad(context)),
              physics: const BouncingScrollPhysics(),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Push Notifications',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  SizedBox(height: AppSpacing.md(context)),
                  _buildSwitchTile(
                    title: 'Assignments',
                    description: 'When a ticket is assigned to you',
                    value: _ticketAssignments,
                    prefKey: 'ticket_assignments',
                    icon: Icons.assignment_ind_rounded,
                    iconColor: Colors.blue.shade700,
                  ),
                  _buildSwitchTile(
                    title: 'Escalations',
                    description: 'When a ticket is escalated',
                    value: _escalations,
                    prefKey: 'escalations',
                    icon: Icons.warning_amber_rounded,
                    iconColor: Colors.orange.shade700,
                  ),
                  _buildSwitchTile(
                    title: 'Resolutions',
                    description: 'When your ticket is resolved',
                    value: _resolutions,
                    prefKey: 'resolutions',
                    icon: Icons.check_circle_outline_rounded,
                    iconColor: Colors.green.shade700,
                  ),
                  _buildSwitchTile(
                    title: 'Reminders',
                    description: 'Daily pending ticket reminders',
                    value: _reminders,
                    prefKey: 'reminders',
                    icon: Icons.alarm_rounded,
                    iconColor: Colors.purple.shade700,
                  ),
                  _buildSwitchTile(
                    title: 'Announcements',
                    description: 'General system announcements',
                    value: _announcements,
                    prefKey: 'announcements',
                    icon: Icons.campaign_rounded,
                    iconColor: Colors.teal.shade700,
                  ),
                ],
              ),
            ),
    );
  }
}
