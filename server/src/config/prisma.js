import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function withDbRetry(operation, retries = 1) {
  try {
    return await operation();
  } catch (error) {
    const isConnectionError =
      error.code === 'P1001' ||
      error.message?.includes("Can't reach database server");

    if (isConnectionError && retries > 0) {
      console.log('Database sleeping. Waiting for Neon to wake up...');

      await new Promise((resolve) => setTimeout(resolve, 5000));

      console.log('Retrying database operation...');

      return withDbRetry(operation, retries - 1);
    }

    throw error;
  }
}

export default prisma;