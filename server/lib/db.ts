import { PrismaClient } from '~/server/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL 未配置。请在 .env.local 或 .env 中填写 PostgreSQL 连接串。')
  }

  const adapter = new PrismaPg({
    connectionString,
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')
      ? { rejectUnauthorized: false }
      : undefined,
  })

  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prisma?: ReturnType<typeof createPrismaClient>
} & typeof global

export const db = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}


export async function withDbRetry<T>(operation: () => Promise<T>, label = 'database query'): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      const message = String(error?.message || '')
      const retryable =
        message.includes('Connection terminated unexpectedly') ||
        message.includes('Unable to start a transaction') ||
        error?.code === 'P2028' ||
        error?.code === 'P1001' ||
        error?.code === 'P1017'

      if (!retryable || attempt === 2) break
      await db.$disconnect().catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)))
    }
  }
  console.warn(`${label} failed after retry`, lastError)
  throw lastError
}
