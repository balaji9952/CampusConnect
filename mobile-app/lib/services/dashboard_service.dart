import 'package:flutter/foundation.dart';
import 'package:campus_connect/services/api_service.dart';

class CampusSummary {
  final int receivedToday;
  final int resolvedToday;
  final int pending;
  final int inProgress;
  final int escalated;
  final double resolutionRate;
  final int campusHealthScore;
  final String campusStatus;
  final String campusStatusMessage;
  final int activeDepartments;
  final int zeroComplaintDepartments;
  final int receivedTrend;
  final int resolvedTrend;
  final int pendingTrend;

  CampusSummary.fromJson(Map<String, dynamic> json)
      : receivedToday = json['receivedToday'] ?? 0,
        resolvedToday = json['resolvedToday'] ?? 0,
        pending = json['pending'] ?? 0,
        inProgress = json['inProgress'] ?? 0,
        escalated = json['escalated'] ?? 0,
        resolutionRate = (json['resolutionRate'] ?? 0).toDouble(),
        campusHealthScore = json['campusHealthScore'] ?? 0,
        campusStatus = json['campusStatus'] ?? '',
        campusStatusMessage = json['campusStatusMessage'] ?? '',
        activeDepartments = json['activeDepartments'] ?? 0,
        zeroComplaintDepartments = json['zeroComplaintDepartments'] ?? 0,
        receivedTrend = json['receivedTrend'] ?? 0,
        resolvedTrend = json['resolvedTrend'] ?? 0,
        pendingTrend = json['pendingTrend'] ?? 0;
}

class DepartmentTodayReport {
  final int departmentId;
  final String departmentName;
  final int received;
  final int pending;
  final int inProgress;
  final int resolved;
  final int escalated;
  final double resolutionRate;
  final double averageResolutionHours;
  final int healthScore;

  DepartmentTodayReport.fromJson(Map<String, dynamic> json)
      : departmentId = json['departmentId'] ?? 0,
        departmentName = json['departmentName'] ?? '',
        received = json['received'] ?? 0,
        pending = json['pending'] ?? 0,
        inProgress = json['inProgress'] ?? 0,
        resolved = json['resolved'] ?? 0,
        escalated = json['escalated'] ?? 0,
        resolutionRate = (json['resolutionRate'] ?? 0).toDouble(),
        averageResolutionHours = (json['averageResolutionHours'] ?? 0).toDouble(),
        healthScore = json['healthScore'] ?? 0;
}

class ExecutiveInsights {
  final String? highestPending;
  final String? bestPerforming;
  final String? mostActive;

  ExecutiveInsights.fromJson(Map<String, dynamic> json)
      : highestPending = json['highestPending'],
        bestPerforming = json['bestPerforming'],
        mostActive = json['mostActive'];
}

class RecentActivity {
  final DateTime time;
  final String message;

  RecentActivity.fromJson(Map<String, dynamic> json)
      : time = DateTime.tryParse(json['time'] ?? '') ?? DateTime.now(),
        message = json['message'] ?? '';
}

class PrincipalExecutiveData {
  final CampusSummary campusSummary;
  final List<DepartmentTodayReport> departmentReport;
  final ExecutiveInsights insights;
  final List<String> recommendations;
  final List<RecentActivity> recentActivity;

  PrincipalExecutiveData.fromJson(Map<String, dynamic> json)
      : campusSummary = CampusSummary.fromJson(json['campusSummary'] ?? {}),
        departmentReport = (json['departmentReport'] as List?)
                ?.map((i) => DepartmentTodayReport.fromJson(i))
                .toList() ??
            [],
        insights = ExecutiveInsights.fromJson(json['executiveInsights'] ?? {}),
        recommendations = (json['recommendations'] as List?)
                ?.map((i) => i.toString())
                .toList() ??
            [],
        recentActivity = (json['recentActivity'] as List?)
                ?.map((i) => RecentActivity.fromJson(i))
                .toList() ??
            [];
}

class DashboardStats {
  final int totalTickets;
  final int openTickets;
  final int inProgressTickets;
  final int resolvedTickets;
  final int escalatedTickets;
  final int level1Tickets;
  final int level2Tickets;
  final int level3Tickets;
  final PrincipalExecutiveData? principalExecutiveData;

  DashboardStats({
    required this.totalTickets,
    required this.openTickets,
    required this.inProgressTickets,
    required this.resolvedTickets,
    required this.escalatedTickets,
    this.level1Tickets = 0,
    this.level2Tickets = 0,
    this.level3Tickets = 0,
    this.principalExecutiveData,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    PrincipalExecutiveData? pData;
    if (json['principalExecutiveData'] != null) {
      pData = PrincipalExecutiveData.fromJson(json['principalExecutiveData']);
    }

    return DashboardStats(
      totalTickets: json['totalTickets'] ?? 0,
      openTickets: json['openTickets'] ?? 0,
      inProgressTickets: json['inProgressTickets'] ?? 0,
      resolvedTickets: json['resolvedTickets'] ?? 0,
      escalatedTickets: json['escalatedTickets'] ?? 0,
      level1Tickets: json['level1Tickets'] ?? 0,
      level2Tickets: json['level2Tickets'] ?? 0,
      level3Tickets: json['level3Tickets'] ?? 0,
      principalExecutiveData: pData,
    );
  }

  int get pendingTickets => openTickets + inProgressTickets;
}

class DashboardService {
  final ApiService _apiService = ApiService();

  Future<DashboardStats?> fetchStats() async {
    try {
      final response = await _apiService.get('/dashboard/stats');
      debugPrint('GET /dashboard/stats RESPONSE: $response');
      
      if (response != null && response['success'] == true) {
        final stats = DashboardStats.fromJson(response['data']);
        debugPrint('GET /dashboard/stats PARSED successfully. Total: ${stats.totalTickets}');
        return stats;
      }
      return null;
    } catch (e, stackTrace) {
      debugPrint('FETCH DASHBOARD STATS ERROR: $e');
      debugPrintStack(stackTrace: stackTrace);
      rethrow;
    }
  }
}
