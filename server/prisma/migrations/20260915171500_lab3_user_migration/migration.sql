-- Guard the Lab 2 source data before changing types or relations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DevelopmentRequester"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Lab 3 migration aborted: duplicate normalized requester emails';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Ticket"
    WHERE "requestedPriority" NOT IN ('LOW', 'MEDIUM', 'HIGH')
  ) THEN
    RAISE EXCEPTION 'Lab 3 migration aborted: invalid requested priority';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Ticket"
    WHERE "status" NOT IN (
      'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER',
      'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'
    )
  ) THEN
    RAISE EXCEPTION 'Lab 3 migration aborted: invalid ticket status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Ticket" ticket
    LEFT JOIN "DevelopmentRequester" requester ON requester."id" = ticket."requesterId"
    LEFT JOIN "Category" category ON category."id" = ticket."categoryId"
    LEFT JOIN "RelatedSystem" related_system ON related_system."id" = ticket."relatedSystemId"
    WHERE requester."id" IS NULL
       OR category."id" IS NULL
       OR related_system."id" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM "Attachment" attachment
    LEFT JOIN "Ticket" ticket ON ticket."id" = attachment."ticketId"
    WHERE ticket."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Lab 3 migration aborted: broken Lab 2 relation';
  END IF;
END $$;

-- Rename the requester table in place so IDs and Ticket ownership remain intact.
ALTER TABLE "DevelopmentRequester" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "DevelopmentRequester_pkey" TO "User_pkey";
ALTER INDEX "DevelopmentRequester_email_key" RENAME TO "User_email_key";
ALTER INDEX "DevelopmentRequester_isActive_idx" RENAME TO "User_isActive_idx";

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TicketStatus" AS ENUM (
  'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER',
  'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'
);

UPDATE "User" SET "email" = lower(btrim("email"));

ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- Hash of the documented fictional local initial password, generated with
-- Argon2id (m=19456 KiB, t=2, p=1, 16-byte salt, 32-byte output).
UPDATE "User"
SET "passwordHash" = '$argon2id$v=19$m=19456,p=1,t=2$8NhbztGbBnByHe2w/eRexQ$c95zo22n2FswcZF9t22Lc8+dYy7mB7xkMl6vVR41ysk';

ALTER TABLE "User"
  ALTER COLUMN "passwordHash" SET NOT NULL,
  ALTER COLUMN "role" DROP DEFAULT;

CREATE UNIQUE INDEX "User_email_normalized_key" ON "User" (lower("email"));
CREATE INDEX "User_role_idx" ON "User"("role");

ALTER TABLE "Ticket"
  ALTER COLUMN "requestedPriority" TYPE "Priority"
    USING ("requestedPriority"::"Priority"),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "TicketStatus"
    USING ("status"::"TicketStatus"),
  ALTER COLUMN "status" SET DEFAULT 'NEW',
  ADD COLUMN "ownerId" INTEGER,
  ADD COLUMN "itPriority" "Priority",
  ADD COLUMN "ownerAssignedAt" TIMESTAMP(3),
  ADD COLUMN "requesterResolutionIndicatedAt" TIMESTAMP(3);

UPDATE "Ticket" SET "itPriority" = "requestedPriority";
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;

CREATE TABLE "PublicComment" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InternalNote" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "Ticket_itPriority_idx" ON "Ticket"("itPriority");
CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");
CREATE INDEX "PublicComment_authorId_idx" ON "PublicComment"("authorId");
CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");
CREATE INDEX "InternalNote_authorId_idx" ON "InternalNote"("authorId");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PublicComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InternalNote"
  ADD CONSTRAINT "InternalNote_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InternalNote_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
