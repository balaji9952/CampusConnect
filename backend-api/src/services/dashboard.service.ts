import prisma from '../utils/prisma';

export class DashboardService {
  static async getStudentStats(userId: string) {
    const baseWhere = { creator_id: userId, is_deleted: false };

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      escalatedTickets,
      level1Tickets,
      level2Tickets,
      level3Tickets
    ] = await Promise.all([
      prisma.tickets.count({ where: baseWhere }),
      prisma.tickets.count({ where: { ...baseWhere, status: 0 } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 1 } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 2 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: { gt: 1 }, status: { notIn: [2, 4] } } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 1 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 2 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 3 } })
    ]);

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      escalatedTickets,
      level1Tickets,
      level2Tickets,
      level3Tickets
    };
  }

  static async getStaffAdminStats(userId: string, role: string) {
    const { VisibilityService } = require('./visibility.service');
    const baseWhere = await VisibilityService.getTicketVisibilityWhereClause(userId, role);

    if (baseWhere.id === 'NOT_FOUND' || baseWhere.id === 'UNRECOGNIZED_ROLE' || (Array.isArray(baseWhere.id?.in) && baseWhere.id.in.length === 0 && role !== 'Admin')) {
      return {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        escalatedTickets: 0,
        level1Tickets: 0,
        level2Tickets: 0,
        level3Tickets: 0,
        ticketsByCategory: [],
        ticketsByLocation: []
      };
    }


    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      escalatedTickets,
      level1Tickets,
      level2Tickets,
      level3Tickets,
      byCategoryRaw,
      byLocationRaw
    ] = await Promise.all([
      prisma.tickets.count({ where: baseWhere }),
      prisma.tickets.count({ where: { ...baseWhere, status: 0 } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 1 } }),
      prisma.tickets.count({ where: { ...baseWhere, status: 2 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: { gt: 1 }, status: { notIn: [2, 4] } } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 1 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 2 } }),
      prisma.tickets.count({ where: { ...baseWhere, escalation_level: 3 } }),
      prisma.tickets.groupBy({ by: ['category_name'], where: baseWhere, _count: { _all: true } }),
      prisma.tickets.groupBy({ by: ['location_name'], where: baseWhere, _count: { _all: true } })
    ]);

    const ticketsByCategory = byCategoryRaw.map(c => ({
      category_name: c.category_name,
      count: c._count._all
    }));

    const ticketsByLocation = byLocationRaw.map(l => ({
      location_name: l.location_name,
      count: l._count._all
    }));

    return {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      escalatedTickets,
      level1Tickets,
      level2Tickets,
      level3Tickets,
      ticketsByCategory,
      ticketsByLocation
    };
  }

  static async getPrincipalExecutiveReport() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const rawData = await prisma.$queryRaw<any[]>`
      SELECT 
        COALESCE(d.id, 0) AS departmentId,
        COALESCE(d.name, 'Global/General') AS departmentName,
        
        CAST(SUM(CASE WHEN t.created_at >= ${startOfToday} THEN 1 ELSE 0 END) AS INT) AS receivedToday,
        CAST(SUM(CASE WHEN t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS pending,
        CAST(SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) AS INT) AS inProgress,
        CAST(SUM(CASE WHEN t.created_at >= ${startOfToday} AND t.status IN (2, 4) THEN 1 ELSE 0 END) AS INT) AS resolvedToday,
        CAST(SUM(CASE WHEN t.escalation_level > 1 AND t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS escalated,
        
        CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} THEN 1 ELSE 0 END) AS INT) AS receivedYesterday,
        CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} AND t.status IN (2, 4) THEN 1 ELSE 0 END) AS INT) AS resolvedYesterday,
        CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} AND t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS pendingYesterday,
        
        AVG(CASE WHEN t.created_at >= ${startOfToday} AND t.status IN (2, 4) 
                 THEN EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, t.updated_at) - t.created_at)) / 3600.0 
                 ELSE NULL END) AS averageResolutionHours
      FROM tickets t
      LEFT JOIN locations l ON t.location_id = l.id
      LEFT JOIN departments d ON l.department_id = d.id
      WHERE t.is_deleted = false
        AND (t.created_at >= ${startOfYesterday} OR t.status IN (0, 1))
      GROUP BY d.id, d.name
    `;

    let totalReceivedToday = 0;
    let totalResolvedToday = 0;
    let totalPendingToday = 0;
    let totalInProgressToday = 0;
    let totalEscalatedToday = 0;

    let totalReceivedYesterday = 0;
    let totalResolvedYesterday = 0;
    let totalPendingYesterday = 0;

    let activeDepts = 0;
    let deptsWithZeroComplaints = 0;

    const departmentReports = rawData.map(row => {
      const received = row.receivedToday || 0;
      const resolved = row.resolvedToday || 0;
      const pending = row.pending || 0;
      const inProgress = row.inProgress || 0;
      const escalated = row.escalated || 0;
      
      const receivedYest = row.receivedYesterday || 0;
      const resolvedYest = row.resolvedYesterday || 0;
      const pendingYest = row.pendingYesterday || 0;
      
      totalReceivedToday += received;
      totalResolvedToday += resolved;
      totalPendingToday += pending;
      totalInProgressToday += inProgress;
      totalEscalatedToday += escalated;

      totalReceivedYesterday += receivedYest;
      totalResolvedYesterday += resolvedYest;
      totalPendingYesterday += pendingYest;

      if (received > 0) activeDepts++;
      else deptsWithZeroComplaints++;

      const resolutionRate = received > 0 ? (resolved / received) * 100 : 0;
      const avgResHrs = row.averageResolutionHours || 0;

      // Department Health Score logic
      let healthScore = 100;
      if (pending > 0) healthScore -= (pending * 5);
      if (escalated > 0) healthScore -= (escalated * 10);
      if (avgResHrs > 24) healthScore -= 15;
      else if (avgResHrs > 12) healthScore -= 5;
      
      healthScore = Math.max(0, Math.min(100, healthScore));

      return {
        departmentId: row.departmentId,
        departmentName: row.departmentName,
        received,
        pending,
        inProgress,
        resolved,
        escalated,
        resolutionRate: Number(resolutionRate.toFixed(1)),
        averageResolutionHours: Number(avgResHrs.toFixed(1)),
        healthScore: Math.round(healthScore)
      };
    });

    const campusResRate = totalReceivedToday > 0 ? (totalResolvedToday / totalReceivedToday) * 100 : 0;
    
    // Sort for rankings
    const sortedByPending = [...departmentReports].sort((a, b) => b.pending - a.pending);
    const sortedByResolution = [...departmentReports].sort((a, b) => b.resolutionRate - a.resolutionRate);
    const sortedByReceived = [...departmentReports].sort((a, b) => b.received - a.received);

    const highestPending = sortedByPending[0]?.pending > 0 ? sortedByPending[0] : null;
    const bestPerforming = sortedByResolution[0]?.received > 0 ? sortedByResolution[0] : null;
    const mostActive = sortedByReceived[0]?.received > 0 ? sortedByReceived[0] : null;

    // Campus Health Logic
    let campusHealthScore = 100;
    if (totalPendingToday > 10) campusHealthScore -= 10;
    if (totalEscalatedToday > 5) campusHealthScore -= 20;
    if (campusResRate < 50 && totalReceivedToday > 5) campusHealthScore -= 20;
    campusHealthScore = Math.max(0, campusHealthScore);
    
    let campusStatus = "Healthy";
    if (campusHealthScore < 60) campusStatus = "Critical";
    else if (campusHealthScore < 85) campusStatus = "Needs Attention";

    let campusStatusMessage = "Campus is operating smoothly today.";
    if (campusStatus === "Critical") {
      campusStatusMessage = "Multiple departments exceed acceptable pending thresholds.";
    } else if (campusStatus === "Needs Attention") {
      if (highestPending) {
        campusStatusMessage = `${highestPending.departmentName} Department has the highest pending complaints.`;
      } else {
        campusStatusMessage = "Complaint resolution is below average today.";
      }
    } else {
      if (totalReceivedToday > 0 && campusResRate > 80) {
        campusStatusMessage = `${campusResRate.toFixed(0)}% of complaints are being resolved within acceptable time.`;
      }
    }

    // Smart Recommendations
    const recommendations: string[] = [];
    if (highestPending && highestPending.pending > 3) {
      recommendations.push(`Review ${highestPending.departmentName} Department workload.`);
    }
    if (bestPerforming && bestPerforming.resolutionRate > 80) {
      recommendations.push(`${bestPerforming.departmentName} achieved the highest resolution rate today.`);
    }
    if (totalReceivedToday > totalReceivedYesterday * 1.5 && totalReceivedYesterday > 5) {
      recommendations.push(`Complaints increased by ${Math.round(((totalReceivedToday - totalReceivedYesterday)/totalReceivedYesterday)*100)}% compared to yesterday.`);
    }
    if (recommendations.length === 0) {
       recommendations.push("Continue monitoring active departments.");
    }

    // Recent Activity (Lightweight query)
    const recentUpdates = await prisma.ticket_updates.findMany({
      where: { created_at: { gte: startOfToday } },
      orderBy: { created_at: 'desc' },
      take: 8,
      include: {
        tickets: { select: { ticket_number: true, complaint_categories: { select: { name: true } } } },
        users: { select: { name: true } }
      }
    });

    const recentActivity = recentUpdates.map(u => ({
      time: u.created_at,
      message: `${u.update_type.replace('_', ' ')} by ${u.users?.name || 'System'} on ${u.tickets?.complaint_categories?.name || 'ticket'}`
    }));

    return {
      campusSummary: {
        receivedToday: totalReceivedToday,
        resolvedToday: totalResolvedToday,
        pending: totalPendingToday,
        inProgress: totalInProgressToday,
        escalated: totalEscalatedToday,
        resolutionRate: Number(campusResRate.toFixed(1)),
        campusHealthScore,
        campusStatus,
        campusStatusMessage,
        activeDepartments: activeDepts,
        zeroComplaintDepartments: deptsWithZeroComplaints,
        
        // Trends
        receivedTrend: totalReceivedToday - totalReceivedYesterday,
        resolvedTrend: totalResolvedToday - totalResolvedYesterday,
        pendingTrend: totalPendingToday - totalPendingYesterday,
      },
      departmentReport: departmentReports.sort((a, b) => b.received - a.received), // Default sort by received
      executiveInsights: {
        highestPending: highestPending?.departmentName,
        bestPerforming: bestPerforming?.departmentName,
        mostActive: mostActive?.departmentName,
      },
      recommendations,
      recentActivity
    };
  }
}
