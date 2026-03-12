import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const players = [
  { name: 'Admin Adminson', email: 'adm@scelto.no', isAdmin: true },
  { name: 'Dev Devson', email: 'dev@scelto.no', isAdmin: false },
];

async function main() {
  console.log('Seeding database...');

  for (const player of players) {
    await prisma.player.upsert({
      where: { email: player.email },
      update: { name: player.name, isAdmin: player.isAdmin },
      create: player,
    });
  }

  console.log(`Seeded ${players.length} players`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
