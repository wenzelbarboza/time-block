import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let prismaClient: PrismaClient

if (typeof window === 'undefined') {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) {
    throw new Error("TURSO_DATABASE_URL environment variable is not defined.")
  }

  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  prismaClient =
    globalForPrisma.prisma ??
    new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient
  }
} else {
  prismaClient = new PrismaClient()
}

export const db = prismaClient