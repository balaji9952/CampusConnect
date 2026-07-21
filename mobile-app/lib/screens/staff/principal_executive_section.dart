import 'package:flutter/material.dart';
import 'package:campus_connect/services/dashboard_service.dart';
import 'package:shimmer/shimmer.dart';
import 'package:percent_indicator/percent_indicator.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:campus_connect/utils/app_spacing.dart';

class PrincipalExecutiveSection extends StatefulWidget {
  final PrincipalExecutiveData? data;
  final bool isLoading;
  final VoidCallback onRefresh;

  const PrincipalExecutiveSection({
    super.key,
    required this.data,
    required this.isLoading,
    required this.onRefresh,
  });

  @override
  State<PrincipalExecutiveSection> createState() => _PrincipalExecutiveSectionState();
}

class _PrincipalExecutiveSectionState extends State<PrincipalExecutiveSection> {
  String _selectedTab = 'Today';
  String _sortOption = 'Highest Pending';

  @override
  Widget build(BuildContext context) {
    if (widget.isLoading && widget.data == null) {
      return _buildSkeletonLoader();
    }

    if (widget.data == null) {
      return _buildEmptyState();
    }

    final summary = widget.data!.campusSummary;


    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildStatusBanner(summary),
            Padding(
              padding: EdgeInsets.all(AppSpacing.md(context)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildExecutiveHeader(),

                  SizedBox(height: AppSpacing.lg(context)),
                  _buildKPIGrid(summary),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildSmartRecommendations(),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildChartsSection(),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildNeedsAttention(),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildDepartmentList(),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildExecutiveTimeline(),
                  SizedBox(height: AppSpacing.lg(context)),
                  _buildExportActions(),
                ],
              ),
            ),
          ],
        );
  }

  Widget _buildStatusBanner(CampusSummary summary) {
    Color bgColor;
    Color iconColor;
    IconData icon;

    if (summary.campusStatus == 'Critical') {
      bgColor = const Color(0xFFFEF2F2);
      iconColor = const Color(0xFFDC2626);
      icon = Icons.cancel_rounded;
    } else if (summary.campusStatus == 'Needs Attention') {
      bgColor = const Color(0xFFFFFBEB);
      iconColor = const Color(0xFFF59E0B);
      icon = Icons.warning_rounded;
    } else {
      bgColor = const Color(0xFFF0FDF4);
      iconColor = const Color(0xFF16A34A);
      icon = Icons.check_circle_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      color: bgColor,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: iconColor, size: 28),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Campus Status: ${summary.campusStatus}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: iconColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  summary.campusStatusMessage,
                  style: TextStyle(
                    fontSize: 14,
                    color: iconColor.withValues(alpha: 0.8),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExecutiveHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Executive Operations Center',
          style: TextStyle(
            fontSize: AppSpacing.isCompact(context) ? 20.0 : 24.0,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF111827),
            letterSpacing: -0.5,
          ),
        ),
        SizedBox(height: AppSpacing.xs(context) / 2),
        Text(
          DateFormat('EEEE, MMMM d, yyyy').format(DateTime.now()),
          style: TextStyle(
            fontSize: AppSpacing.fontCardTitle(context),
            color: const Color(0xFF6B7280),
          ),
        ),
      ],
    );
  }

  Widget _buildTimeFilters() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days'].map((tab) {
          final isSelected = _selectedTab == tab;
          final isEnabled = tab == 'Today';
          
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              onTap: isEnabled ? () {
                setState(() => _selectedTab = tab);
              } : () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Coming Soon'), behavior: SnackBarBehavior.floating),
                );
              },
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.xs(context)),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF111827) : Colors.white,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
                  border: Border.all(
                    color: isSelected ? const Color(0xFF111827) : const Color(0xFFE5E7EB),
                  ),
                ),
                child: Text(
                  tab,
                  style: TextStyle(
                    fontSize: AppSpacing.fontCardTitle(context) - 1,
                    fontWeight: FontWeight.w600,
                    color: isSelected ? Colors.white : (isEnabled ? const Color(0xFF4B5563) : const Color(0xFF9CA3AF)),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildKPIGrid(CampusSummary summary) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 600 ? 3 : 2;
        return GridView.count(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: constraints.maxWidth > 600 ? 1.5 : 1.2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            _buildKPICard("Today's Complaints", summary.receivedToday, summary.receivedTrend, Icons.assignment_rounded, const Color(0xFF2563EB)),
            _buildKPICard('Resolved Today', summary.resolvedToday, summary.resolvedTrend, Icons.check_circle_rounded, const Color(0xFF16A34A)),
            _buildKPICard('Pending', summary.pending, summary.pendingTrend, Icons.pending_actions_rounded, const Color(0xFFF59E0B)),
            _buildKPICard('Escalated', summary.escalated, 0, Icons.warning_rounded, const Color(0xFFDC2626)),
            _buildKPICard('Resolution Rate', '${summary.resolutionRate.round()}%', 0, Icons.pie_chart_rounded, const Color(0xFF4F46E5), isPercent: true),
            _buildKPICard('Campus Health', '${summary.campusHealthScore}%', 0, Icons.monitor_heart_rounded, const Color(0xFF0D9488), isPercent: true),
          ],
        );
      }
    );
  }

  Widget _buildKPICard(String title, dynamic value, int trend, IconData icon, Color color, {bool isPercent = false}) {
    return Container(
      padding: EdgeInsets.all(AppSpacing.md(context)),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 24),
              if (trend != 0)
                Row(
                  children: [
                    Icon(
                      trend > 0 ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                      size: 14,
                      color: trend > 0 ? (title.contains('Complaints') || title.contains('Pending') ? const Color(0xFFDC2626) : const Color(0xFF16A34A)) : (title.contains('Complaints') || title.contains('Pending') ? const Color(0xFF16A34A) : const Color(0xFFDC2626)),
                    ),
                    const SizedBox(width: 2),
                    Text(
                      '${trend > 0 ? '+' : ''}$trend',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: trend > 0 ? (title.contains('Complaints') || title.contains('Pending') ? const Color(0xFFDC2626) : const Color(0xFF16A34A)) : (title.contains('Complaints') || title.contains('Pending') ? const Color(0xFF16A34A) : const Color(0xFFDC2626)),
                      ),
                    ),
                  ],
                ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$value',
                style: TextStyle(
                  fontSize: AppSpacing.isCompact(context) ? 24.0 : 28.0,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF111827),
                  letterSpacing: -1,
                ),
              ),
              SizedBox(height: AppSpacing.xs(context) / 2),
              Text(
                title,
                style: TextStyle(
                  fontSize: AppSpacing.fontCardTitle(context) - 1,
                  color: const Color(0xFF6B7280),
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSmartRecommendations() {
    if (widget.data!.recommendations.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recommended Actions',
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context) + 2,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF111827),
          ),
        ),
        SizedBox(height: AppSpacing.sm(context)),
        ...widget.data!.recommendations.map((rec) => Padding(
          padding: EdgeInsets.only(bottom: AppSpacing.sm(context)),
          child: Container(
            padding: EdgeInsets.all(AppSpacing.sm(context)),
            decoration: BoxDecoration(
              color: const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                Icon(Icons.tips_and_updates_rounded, color: const Color(0xFFD97706), size: AppSpacing.iconSm(context)),
                SizedBox(width: AppSpacing.sm(context)),
                Expanded(
                  child: Text(
                    rec,
                    style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), color: const Color(0xFF374151)),
                  ),
                ),
              ],
            ),
          ),
        )),
      ],
    );
  }

  Widget _buildNeedsAttention() {
    final insights = widget.data!.insights;
    if (insights.highestPending == null) return const SizedBox.shrink();

    return Container(
      padding: EdgeInsets.all(AppSpacing.md(context)),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFEF2F2), Color(0xFFFFF1F2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
        border: Border.all(color: const Color(0xFFFECDD3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.crisis_alert_rounded, color: const Color(0xFFE11D48), size: AppSpacing.iconSm(context)),
              SizedBox(width: AppSpacing.xs(context)),
              Text(
                'Needs Attention',
                style: TextStyle(fontSize: AppSpacing.fontSectionHeader(context), fontWeight: FontWeight.bold, color: const Color(0xFF9F1239)),
              ),
            ],
          ),
          SizedBox(height: AppSpacing.sm(context)),
          if (insights.highestPending != null)
            _buildAttentionItem('Highest Pending', insights.highestPending!),
        ],
      ),
    );
  }

  Widget _buildAttentionItem(String label, String deptName) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, color: Color(0xFFBE123C))),
          Text(deptName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF881337))),
        ],
      ),
    );
  }

  Widget _buildChartsSection() {
    final summary = widget.data!.campusSummary;
    if (summary.receivedToday == 0) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Complaint Distribution',
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context) + 2,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF111827),
          ),
        ),
        SizedBox(height: AppSpacing.md(context)),
        Container(
          height: 250,
          padding: EdgeInsets.all(AppSpacing.md(context)),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              Expanded(
                flex: 2,
                child: PieChart(
                  PieChartData(
                    sectionsSpace: 4,
                    centerSpaceRadius: 40,
                    sections: [
                      if (summary.pending > 0)
                        PieChartSectionData(
                          color: const Color(0xFFF59E0B),
                          value: summary.pending.toDouble(),
                          title: '${summary.pending}',
                          radius: 30,
                          titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      if (summary.inProgress > 0)
                        PieChartSectionData(
                          color: const Color(0xFF7C3AED),
                          value: summary.inProgress.toDouble(),
                          title: '${summary.inProgress}',
                          radius: 30,
                          titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      if (summary.resolvedToday > 0)
                        PieChartSectionData(
                          color: const Color(0xFF16A34A),
                          value: summary.resolvedToday.toDouble(),
                          title: '${summary.resolvedToday}',
                          radius: 30,
                          titleStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(
                flex: 1,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildLegendItem('Pending', const Color(0xFFF59E0B)),
                    const SizedBox(height: 8),
                    _buildLegendItem('In Progress', const Color(0xFF7C3AED)),
                    const SizedBox(height: 8),
                    _buildLegendItem('Resolved', const Color(0xFF16A34A)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: AppSpacing.xs(context)),
        Text(label, style: TextStyle(fontSize: AppSpacing.fontCardTitle(context) - 2, color: const Color(0xFF4B5563))),
      ],
    );
  }

  Widget _buildDepartmentList() {
    var depts = List<DepartmentTodayReport>.from(widget.data!.departmentReport);
    
    if (_sortOption == 'Highest Pending') {
      depts.sort((a, b) => b.pending.compareTo(a.pending));
    } else if (_sortOption == 'Highest Resolution %') {
      depts.sort((a, b) => b.resolutionRate.compareTo(a.resolutionRate));
    } else {
      depts.sort((a, b) => b.received.compareTo(a.received));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                'Department Report',
                style: TextStyle(fontSize: AppSpacing.fontSectionHeader(context) + 2, fontWeight: FontWeight.bold, color: const Color(0xFF111827)),
              ),
            ),
            const SizedBox(width: 8),
            DropdownButton<String>(
              value: _sortOption,
              underline: const SizedBox(),
              style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563), fontWeight: FontWeight.w600),
              icon: const Icon(Icons.sort_rounded, size: 16),
              items: ['Highest Pending', 'Highest Resolution %', 'Most Complaints']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (val) {
                if (val != null) setState(() => _sortOption = val);
              },
            ),
          ],
        ),
        SizedBox(height: AppSpacing.sm(context)),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: depts.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            return _buildExpandableDeptCard(depts[index], index + 1);
          },
        ),
      ],
    );
  }

  Widget _buildExpandableDeptCard(DepartmentTodayReport dept, int rank) {
    Color healthColor = const Color(0xFF16A34A);
    if (dept.healthScore < 60) healthColor = const Color(0xFFDC2626);
    else if (dept.healthScore < 85) healthColor = const Color(0xFFF59E0B);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2)),
        ],
      ),
      child: ExpansionTile(
        tilePadding: EdgeInsets.symmetric(horizontal: AppSpacing.md(context), vertical: AppSpacing.xs(context)),
        shape: const RoundedRectangleBorder(side: BorderSide.none),
        title: Row(
          children: [
            Container(
              width: AppSpacing.isCompact(context) ? 20.0 : 24.0,
              height: AppSpacing.isCompact(context) ? 20.0 : 24.0,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
              child: Text('#$rank', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context) - 2, fontWeight: FontWeight.bold, color: const Color(0xFF6B7280))),
            ),
            SizedBox(width: AppSpacing.sm(context)),
            Expanded(
              child: Text(
                dept.departmentName,
                style: TextStyle(fontSize: AppSpacing.fontSectionHeader(context), fontWeight: FontWeight.bold, color: const Color(0xFF111827)),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(color: healthColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
              child: Text(
                '${dept.healthScore}%',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: healthColor),
              ),
            ),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _buildMiniMetric('Received', '${dept.received}'),
              _buildMiniMetric('Pending', '${dept.pending}', color: const Color(0xFFD97706)),
              _buildMiniMetric('Resolved', '${dept.resolved}', color: const Color(0xFF16A34A)),
            ],
          ),
        ),
        children: [
          const Divider(height: 1, color: Color(0xFFE5E7EB)),
          Padding(
            padding: EdgeInsets.all(AppSpacing.md(context)),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Resolution Rate', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context) - 1, color: const Color(0xFF4B5563))),
                    Text('${dept.resolutionRate.round()}%', style: TextStyle(fontSize: AppSpacing.fontCardTitle(context), fontWeight: FontWeight.bold, color: const Color(0xFF111827))),
                  ],
                ),
                SizedBox(height: AppSpacing.xs(context)),
                LinearPercentIndicator(
                  lineHeight: 8.0,
                  percent: dept.received > 0 ? (dept.resolutionRate / 100) : 0,
                  backgroundColor: const Color(0xFFF3F4F6),
                  progressColor: healthColor,
                  barRadius: const Radius.circular(4),
                  padding: EdgeInsets.zero,
                ),
                SizedBox(height: AppSpacing.md(context)),
                Row(
                  children: [
                    Expanded(child: _buildDetailMetric('Escalated', '${dept.escalated}', Icons.trending_up_rounded, const Color(0xFFDC2626))),
                    Expanded(child: _buildDetailMetric('Avg Resolution', '${dept.averageResolutionHours}h', Icons.timer_rounded, const Color(0xFF2563EB))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetric(String label, String value, {Color color = const Color(0xFF111827)}) {
    return Row(
      children: [
        Text('$label: ', style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
        Text(value, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _buildDetailMetric(String label, String value, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 6),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
            Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        )
      ],
    );
  }

  Widget _buildExecutiveTimeline() {
    if (widget.data!.recentActivity.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Activity',
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context) + 2,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF111827),
          ),
        ),
        SizedBox(height: AppSpacing.md(context)),
        Container(
          padding: EdgeInsets.all(AppSpacing.md(context)),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg(context)),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            children: widget.data!.recentActivity.take(4).map((activity) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('HH:mm').format(activity.time.toLocal()),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF9CA3AF)),
                    ),
                    const SizedBox(width: 12),
                    Container(width: 2, height: 16, color: const Color(0xFFE5E7EB), margin: const EdgeInsets.only(top: 2)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        activity.message,
                        style: const TextStyle(fontSize: 13, color: Color(0xFF374151)),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildExportActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Export & Reports',
          style: TextStyle(
            fontSize: AppSpacing.fontSectionHeader(context) + 2,
            fontWeight: FontWeight.bold,
            color: const Color(0xFF111827),
          ),
        ),
        SizedBox(height: AppSpacing.md(context)),
        Row(
          children: [
            Expanded(child: _buildExportButton('Download PDF', Icons.picture_as_pdf_rounded)),
            SizedBox(width: AppSpacing.sm(context)),
            Expanded(child: _buildExportButton('Export Excel', Icons.table_chart_rounded)),
          ],
        ),
        SizedBox(height: AppSpacing.xl(context) * 2),
      ],
    );
  }

  Widget _buildExportButton(String label, IconData icon) {
    return OutlinedButton.icon(
      onPressed: () {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Coming Soon'), behavior: SnackBarBehavior.floating));
      },
      icon: Icon(icon, size: AppSpacing.iconSm(context) - 2),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF374151),
        padding: EdgeInsets.symmetric(vertical: AppSpacing.sm(context)),
        side: const BorderSide(color: Color(0xFFD1D5DB)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppSpacing.radiusSm(context))),
      ),
    );
  }

  Widget _buildSkeletonLoader() {
    return Padding(
      padding: EdgeInsets.all(AppSpacing.md(context)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Shimmer.fromColors(
            baseColor: Colors.grey.shade200,
            highlightColor: Colors.grey.shade100,
            child: Container(height: 100, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)))),
          ),
          SizedBox(height: AppSpacing.lg(context)),
          Row(
            children: List.generate(3, (i) => Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: AppSpacing.sm(context)),
                child: Shimmer.fromColors(
                  baseColor: Colors.grey.shade200, highlightColor: Colors.grey.shade100,
                  child: Container(height: 120, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)))),
                ),
              ),
            )),
          ),
          SizedBox(height: AppSpacing.lg(context)),
          Shimmer.fromColors(
            baseColor: Colors.grey.shade200, highlightColor: Colors.grey.shade100,
            child: Container(height: 300, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(AppSpacing.radiusMd(context)))),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return const Center(child: Text("Failed to load dashboard."));
  }


}
