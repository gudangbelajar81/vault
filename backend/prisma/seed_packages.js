const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.package.count();
  if (count === 0) {
    await prisma.package.createMany({
      data: [
        { tier_code: 'BASIC', display_name: 'BASIC (Rp 500.000)', price: 500000, features: '[]' },
        { tier_code: 'PRO', display_name: 'PRO (Rp 1.500.000)', price: 1500000, features: '[]' },
        { tier_code: 'ULTIMATE', display_name: 'ULTIMATE (Rp 2.500.000)', price: 2500000, features: '[]' }
      ]
    });
    console.log('Seeded packages.');
  } else {
    console.log('Packages already exist.');
  }
}
main().finally(() => prisma.$disconnect());
