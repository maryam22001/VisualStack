-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resetCode" TEXT,
ADD COLUMN     "resetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
