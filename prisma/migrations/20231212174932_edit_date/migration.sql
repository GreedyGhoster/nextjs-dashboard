-- AlterTable
ALTER TABLE "Invoices" ALTER COLUMN "date" DROP DEFAULT,
ALTER COLUMN "date" SET DATA TYPE TEXT;