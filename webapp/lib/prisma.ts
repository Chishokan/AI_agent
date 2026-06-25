import { PrismaClient } from "@prisma/client";

// 開発時のホットリロードで多重生成しないよう global にキャッシュ
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
