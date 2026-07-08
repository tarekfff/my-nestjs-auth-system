import { PrismaClient, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the first admin',
    );
  }

  const existing = await prisma.staffUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`StaffUser ${email} already exists, skipping seed.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.staffUser.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Admin',
      role: StaffRole.ADMIN,
    },
  });

  console.log(`Seeded first ADMIN StaffUser: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
