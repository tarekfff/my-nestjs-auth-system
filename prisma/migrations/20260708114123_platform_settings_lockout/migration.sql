-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "loginLockoutDurationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "loginLockoutThreshold" INTEGER NOT NULL DEFAULT 5;

