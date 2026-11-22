import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  transactionOptions: {
    maxWait: 10000,
    timeout: 60000,
  },
});

export async function withDbRetry(operation, retries = 3, attempt = 0) {
  try {
    return await operation();
  } catch (error) {
    const isConnectionError =
      error.code === 'P1001' ||
      error.message?.includes("Can't reach database server");

    if (isConnectionError && retries > 0) {
      console.log('Database sleeping. Waiting for Neon to wake up...');

      const delay = Math.min(500 * (2 ** attempt), 4000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log('Retrying database operation...');

      return withDbRetry(operation, retries - 1, attempt + 1);
    }

    throw error;
  }
}

export default prisma;
