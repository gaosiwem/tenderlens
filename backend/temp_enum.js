const { PrismaClient } = require('@prisma/client');
(async () => {
  const client = new PrismaClient();
  await client.$connect();
  try {
    await client.$executeRawUnsafe("ALTER TYPE \"UsageType\" ADD VALUE IF NOT EXISTS 'WHATSAPP_NOTIFICATION';");
    console.log('enum value ensured');
  } catch(e){ console.error('error', e.message); }
  await client.$disconnect();
})();
