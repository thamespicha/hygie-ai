import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Intercept Vercel's locked URL and replace the warning-triggering parameter
const connectionUrl = process.env.DATABASE_URL?.replace(
  "sslmode=require",
  "sslmode=verify-full"
);

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: connectionUrl || process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

