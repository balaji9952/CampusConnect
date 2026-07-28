import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCategories() {
  const cats = await prisma.location_categories.findMany();
  console.log('Categories:');
  console.log(cats);
}

checkCategories()
  .catch(e => console.error(e));
