import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function main() {
  // Seed admin accounts from ADMIN_EMAILS env var (comma-separated)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()).filter(Boolean) || [];

  for (const email of adminEmails) {
    const player = await prisma.player.upsert({
      where: { email },
      update: { isAdmin: true },
      create: { name: deriveNameFromEmail(email), email, isAdmin: true },
    });
    console.log(`Admin: ${player.name} (${player.email})`);
  }

  if (adminEmails.length > 0) {
    console.log(`Seeded ${adminEmails.length} admin(s)`);
  }

  // Seed regular users from SEED_USERS env var (comma-separated)
  const userEmails = process.env.SEED_USERS?.split(',').map((e) => e.trim()).filter(Boolean) || [];

  for (const email of userEmails) {
    const player = await prisma.player.upsert({
      where: { email },
      update: {},
      create: { name: deriveNameFromEmail(email), email },
    });
    console.log(`User: ${player.name} (${player.email})`);
  }

  if (userEmails.length > 0) {
    console.log(`Seeded ${userEmails.length} user(s)`);
  }

  if (adminEmails.length === 0 && userEmails.length === 0) {
    console.log('No ADMIN_EMAILS or SEED_USERS set — skipping seed. See .env.example');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
