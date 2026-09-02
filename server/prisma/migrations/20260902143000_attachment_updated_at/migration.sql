-- Add the lifecycle update timestamp required for Attachment metadata.
ALTER TABLE "Attachment"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
