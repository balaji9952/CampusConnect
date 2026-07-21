const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const locs = await prisma.locations.findMany();
  const cats = await prisma.complaint_categories.findMany();
  console.log("Locs:", locs);
  console.log("Cats:", cats);
}
main();
