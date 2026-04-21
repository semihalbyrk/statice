const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_USERS = [
  {
    email: 'admin@statice.nl',
    password: 'Admin1234!',
    full_name: 'Admin User',
    role: 'ADMIN',
    is_active: true,
  },
  {
    email: 'planner@statice.nl',
    password: 'Planner123!',
    full_name: 'Logistics Planner',
    role: 'LOGISTICS_PLANNER',
    is_active: true,
  },
  {
    email: 'gate@statice.nl',
    password: 'Gate1234!',
    full_name: 'Gate Operator',
    role: 'GATE_OPERATOR',
    is_active: true,
  },
  {
    email: 'reporting@statice.nl',
    password: 'Report123!',
    full_name: 'Reporting Manager',
    role: 'REPORTING_MANAGER',
    is_active: true,
  },
  {
    email: 'sorting@statice.nl',
    password: 'Sorting123!',
    full_name: 'Sorting Employee',
    role: 'SORTING_EMPLOYEE',
    is_active: true,
  },
  {
    email: 'finance@statice.nl',
    password: 'Finance123!',
    full_name: 'Finance Manager',
    role: 'FINANCE_MANAGER',
    is_active: true,
  },
  {
    email: 'system@statice.nl',
    password: 'System!NoLogin!2026',
    full_name: 'System',
    role: 'ADMIN',
    is_active: false,
  },
];

async function main() {
  for (const user of DEFAULT_USERS) {
    const password_hash = await bcrypt.hash(user.password, 10);

    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        password_hash,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      },
      create: {
        email: user.email,
        password_hash,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
      },
    });
  }

  console.log(`Synced ${DEFAULT_USERS.length} default users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
