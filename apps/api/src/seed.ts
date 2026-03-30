import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@iptv.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hash,
        role: "ADMIN",
      },
    });
  }

  const adConfig = await prisma.adConfig.findFirst();
  if (!adConfig) {
    await prisma.adConfig.create({
      data: {
        adsEnabled: false,
        delayMs: 2000,
        cooldownMs: 60000,
      },
    });
  }

  console.log("Seed completed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
