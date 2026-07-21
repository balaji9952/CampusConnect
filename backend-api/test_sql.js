const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  try {
    const rawData = await prisma.$queryRaw`
        SELECT 
          ISNULL(d.id, 0) AS departmentId,
          ISNULL(d.name, 'Global/General') AS departmentName,
          
          CAST(SUM(CASE WHEN t.created_at >= ${startOfToday} THEN 1 ELSE 0 END) AS INT) AS receivedToday,
          CAST(SUM(CASE WHEN t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS pending,
          CAST(SUM(CASE WHEN t.status = 1 THEN 1 ELSE 0 END) AS INT) AS inProgress,
          CAST(SUM(CASE WHEN t.created_at >= ${startOfToday} AND t.status IN (2, 4) THEN 1 ELSE 0 END) AS INT) AS resolvedToday,
          CAST(SUM(CASE WHEN t.escalation_level > 1 AND t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS escalated,
          
          CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} THEN 1 ELSE 0 END) AS INT) AS receivedYesterday,
          CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} AND t.status IN (2, 4) THEN 1 ELSE 0 END) AS INT) AS resolvedYesterday,
          CAST(SUM(CASE WHEN t.created_at >= ${startOfYesterday} AND t.created_at < ${startOfToday} AND t.status IN (0, 1) THEN 1 ELSE 0 END) AS INT) AS pendingYesterday,
          
          AVG(CASE WHEN t.created_at >= ${startOfToday} AND t.status IN (2, 4) 
                   THEN CAST(DATEDIFF(minute, t.created_at, ISNULL(t.resolved_at, t.updated_at)) AS FLOAT) / 60.0 
                   ELSE NULL END) AS averageResolutionHours
        FROM tickets t
        LEFT JOIN locations l ON t.location_id = l.id
        LEFT JOIN departments d ON l.department_id = d.id
        WHERE t.is_deleted = 0
          AND (t.created_at >= ${startOfYesterday} OR t.status IN (0, 1))
        GROUP BY d.id, d.name
      `;
      console.log("RAW DATA:", JSON.stringify(rawData, null, 2));
  } catch (e) {
      console.log("ERROR:", e);
  }
}

run();
