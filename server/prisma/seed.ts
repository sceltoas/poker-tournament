import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const players = [
  { name: 'Ken Gullaksen', email: 'ken.gullaksen@scelto.no', isAdmin: true },
  { name: 'Ola Nordmann', email: 'ola.nordmann@scelto.no', isAdmin: false },
  { name: 'Kari Nordmann', email: 'kari.nordmann@scelto.no', isAdmin: false },
  { name: 'Per Hansen', email: 'per.hansen@scelto.no', isAdmin: false },
  { name: 'Lisa Johansen', email: 'lisa.johansen@scelto.no', isAdmin: false },
  { name: 'Erik Larsen', email: 'erik.larsen@scelto.no', isAdmin: true },
  { name: 'Marte Olsen', email: 'marte.olsen@scelto.no', isAdmin: false },
  { name: 'Jonas Berg', email: 'jonas.berg@scelto.no', isAdmin: false },
  { name: 'Ingrid Dahl', email: 'ingrid.dahl@scelto.no', isAdmin: false },
  { name: 'Thomas Nilsen', email: 'thomas.nilsen@scelto.no', isAdmin: false },
  { name: 'Sofie Moen', email: 'sofie.moen@scelto.no', isAdmin: false },
  { name: 'Anders Vik', email: 'anders.vik@scelto.no', isAdmin: false },
  { name: 'Hanna Strand', email: 'hanna.strand@scelto.no', isAdmin: false },
  { name: 'Magnus Haugen', email: 'magnus.haugen@scelto.no', isAdmin: false },
  { name: 'Emilie Brekke', email: 'emilie.brekke@scelto.no', isAdmin: false },
  { name: 'Kristian Lund', email: 'kristian.lund@scelto.no', isAdmin: false },
  { name: 'Nora Solberg', email: 'nora.solberg@scelto.no', isAdmin: false },
  { name: 'Henrik Aas', email: 'henrik.aas@scelto.no', isAdmin: false },
  { name: 'Julie Bakke', email: 'julie.bakke@scelto.no', isAdmin: false },
  { name: 'Sander Holm', email: 'sander.holm@scelto.no', isAdmin: false },
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
