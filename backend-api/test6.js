const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const cats = await prisma.location_categories.findMany();
  console.log("Categories:", cats.length);
  console.log(cats);
}
run().finally(() => prisma.$disconnect());
