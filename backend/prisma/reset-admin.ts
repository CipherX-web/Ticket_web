import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const hash = await argon2.hash('PrintX#Admin2026!', { type: argon2.argon2id });
  const user = await prisma.staffUser.upsert({
    where: { email: 'admin@printxads.lk' },
    update: {
      passwordHash: hash,
      isActive: true,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: 'admin@printxads.lk',
      name: 'Print X Super Admin',
      passwordHash: hash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('Admin user successfully reset:');
  console.log('ID:', user.id);
  console.log('Email:', user.email);
  console.log('Role:', user.role);
  console.log('Active:', user.isActive);

  // Test argon2 verification immediately to confirm
  const isMatch = await argon2.verify(user.passwordHash, 'PrintX#Admin2026!');
  console.log('Argon2 password self-test match:', isMatch);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
