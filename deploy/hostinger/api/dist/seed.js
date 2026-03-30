"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@iptv.local";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
        const hash = await bcryptjs_1.default.hash(adminPassword, 10);
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
