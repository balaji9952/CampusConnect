import prisma from '../src/utils/prisma';
import * as fs from 'fs';

async function main() {
  const locations = await prisma.locations.findMany({
    include: {
      departments: true,
      academic_QR_sublocations: true,
      qr_codes: true,
      tickets: { select: { id: true } }
    }
  });

  const allQrCodes = await prisma.qr_codes.findMany();
  const allSubLocations = await prisma.academic_QR_sublocations.findMany();

  let report = `# Campus Connect Location & QR Migration Report\n\n`;

  // --- SECTION 1 ---
  report += `## SECTION 1 - LOCATION INVENTORY\n\n`;
  locations.forEach((loc: any) => {
    const qrTokens = loc.qr_codes.filter((q: any) => !q.sub_location_id).map((q: any) => q.qr_token).join(', ') || 'None';
    report += `- **ID:** ${loc.id} | **Name:** ${loc.name} | **Category:** ${loc.category}\n`;
    report += `  - **Dept:** ${loc.departments?.name || 'N/A'} | **Block:** ${loc.block || 'N/A'} | **Floor:** ${loc.floor || 'N/A'}\n`;
    report += `  - **Status:** ${loc.is_active ? 'Active' : 'Inactive'} | **QR Token:** ${qrTokens} | **Sub Locations:** ${loc.academic_QR_sublocations.length}\n\n`;
  });

  // --- SECTION 2 ---
  report += `## SECTION 2 - SUB LOCATION INVENTORY\n\n`;
  let hasSub = false;
  locations.forEach((loc: any) => {
    if (loc.academic_QR_sublocations.length > 0) {
      hasSub = true;
      loc.academic_QR_sublocations.forEach((sub: any) => {
        const matchingQrs = allQrCodes.filter((q: any) => q.sub_location_id === sub.id).map((q: any) => q.qr_token).join(', ') || 'None';
        report += `${loc.name} ↓ ${sub.name} ↓ ID: ${sub.id} ↓ QR Token: ${matchingQrs}\n\n`;
      });
    }
  });
  if (!hasSub) report += `*No sub-locations found.*\n\n`;

  // --- SECTION 3 ---
  report += `## SECTION 3 - CATEGORY SUMMARY\n\n`;
  const categories = [...new Set(locations.map((l: any) => l.category))];
  categories.sort();
  categories.forEach((cat: any) => {
    report += `### ${cat}\n`;
    locations.filter((l: any) => l.category === cat).forEach((l: any) => {
      report += `- ${l.name}\n`;
    });
    report += `\n`;
  });

  // --- SECTION 4 ---
  report += `## SECTION 4 - QR SUMMARY\n\n`;
  locations.forEach((loc: any) => {
    const qrs = loc.qr_codes.filter((q: any) => !q.sub_location_id);
    if (qrs.length > 0) {
      qrs.forEach((q: any) => {
        report += `${loc.id} ↓ ${loc.name} ↓ ${q.qr_token} ↓ ${q.qr_token.replace('QR-', '')} ↓ ${q.qr_image_url} ↓ ${q.is_active}\n\n`;
      });
    } else {
      report += `${loc.id} ↓ ${loc.name} ↓ NONE ↓ NONE ↓ NONE ↓ N/A\n\n`;
    }
  });

  // --- SECTION 5 ---
  report += `## SECTION 5 - FOREIGN KEY VERIFICATION\n\n`;
  const invalidLocQrs = allQrCodes.filter((q: any) => !locations.some((l: any) => l.id === q.location_id));
  const invalidSubQrs = allQrCodes.filter((q: any) => q.sub_location_id && !allSubLocations.some((s: any) => s.id === q.sub_location_id));
  
  if (invalidLocQrs.length === 0 && invalidSubQrs.length === 0) {
    report += `✅ All QR Codes correctly map to valid Locations and Sub-Locations.\n\n`;
  } else {
    report += `❌ **ORPHAN RECORDS DETECTED**\n`;
    if (invalidLocQrs.length > 0) report += `- QR Codes missing parent Location: ${invalidLocQrs.length}\n`;
    if (invalidSubQrs.length > 0) report += `- QR Codes missing parent Sub-Location: ${invalidSubQrs.length}\n`;
    report += `\n`;
  }
  
  report += `*Note: The database schema enforces that Sub Locations must map to a valid Location (location_id -> locations.id foreign key), ensuring no orphan Sub Locations can exist.* \n\n`;

  // --- SECTION 6 ---
  report += `## SECTION 6 - MIGRATION REPORT\n\n`;
  const totalCategories = categories.length;
  const totalLocations = locations.length;
  const totalSubLocations = allSubLocations.length;
  const totalQRCodes = allQrCodes.length;
  const totalActiveQRCodes = allQrCodes.filter((q: any) => q.is_active).length;
  
  const locsWithoutQr = locations.filter((l: any) => l.qr_codes.filter((q: any) => !q.sub_location_id).length === 0).length;
  const qrTokens = allQrCodes.map((q: any) => q.qr_token);
  const dupQRs = qrTokens.filter((e, i, a) => a.indexOf(e) !== i).length;
  const unusedLocations = locations.filter((l: any) => !l.tickets || l.tickets.length === 0).length;
  const locsWithoutCat = locations.filter((l: any) => !l.category).length;
  const locsWithoutRouting = locations.filter((l: any) => l.routing_type === 'GLOBAL_ROUTED' && !l.routing_key).length; 

  report += `- Total Categories: ${totalCategories}\n`;
  report += `- Total Locations: ${totalLocations}\n`;
  report += `- Total Sub Locations: ${totalSubLocations}\n`;
  report += `- Total QR Codes: ${totalQRCodes}\n`;
  report += `- Total Active QR Codes: ${totalActiveQRCodes}\n`;
  report += `- Missing QR Codes (Locations with no QR): ${locsWithoutQr}\n`;
  report += `- Duplicate QR Tokens: ${dupQRs}\n`;
  report += `- Unused Locations (0 Tickets): ${unusedLocations}\n`;
  report += `- Locations without Categories: ${locsWithoutCat}\n`;
  report += `- Locations without QR: ${locsWithoutQr}\n`;
  report += `- Locations with Invalid Routing Config: ${locsWithoutRouting}\n\n`;

  // --- SECTION 7 ---
  report += `## SECTION 7 - EXPORT TABLE\n\n`;
  report += `| Location ID | Category | Location | Sub Location Count | QR Token | Active |\n`;
  report += `|---|---|---|---|---|---|\n`;
  
  const sorted = [...locations].sort((a: any, b: any) => {
    const catA = a.category || '';
    const catB = b.category || '';
    if (catA !== catB) return catA.localeCompare(catB);
    if (a.id !== b.id) return a.id - b.id;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((l: any) => {
    const qrToken = l.qr_codes.filter((q: any) => !q.sub_location_id).map((q: any) => q.qr_token).join(', ') || 'None';
    report += `| ${l.id} | ${l.category || 'N/A'} | ${l.name} | ${l.academic_QR_sublocations.length} | ${qrToken} | ${l.is_active ? 'Yes' : 'No'} |\n`;
  });

  fs.writeFileSync('C:/Users/Balaji Ramasamy/.gemini/antigravity-ide/brain/e9a1a306-9f39-4453-b9c7-a9d00f625d73/location_migration_report.md', report);
  console.log("SUCCESS!");
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  setTimeout(() => process.exit(0), 100);
});
