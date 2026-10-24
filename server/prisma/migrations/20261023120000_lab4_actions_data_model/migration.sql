-- Lab 4 Actions Taken foundation. This migration is additive and preserves
-- every Lab 1-3 row and identifier.
CREATE TYPE "ActionStatus" AS ENUM (
  'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);

CREATE TYPE "ActionEventType" AS ENUM (
  'CREATED', 'UPDATED', 'ASSIGNEE_CHANGED', 'STATUS_CHANGED'
);

CREATE TYPE "TicketEventType" AS ENUM (
  'OWNER_CHANGED', 'PRIORITY_CHANGED', 'STATUS_CHANGED'
);

ALTER TABLE "Ticket"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Lab 3 has no authoritative resolution timestamp. updatedAt is the approved
-- deterministic proxy for Tickets already in a resolved or closed state.
UPDATE "Ticket"
SET "resolvedAt" = "updatedAt"
WHERE "status" IN ('RESOLVED', 'CLOSED');

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_version_positive" CHECK ("version" > 0);

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actionAt" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "result" TEXT,
  "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
  "assigneeId" INTEGER NOT NULL,
  "createdById" INTEGER NOT NULL,
  "performedById" INTEGER,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" INTEGER,
  "cancellationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionTaken_version_positive" CHECK ("version" > 0),
  CONSTRAINT "ActionTaken_description_length" CHECK (
    "description" = btrim("description")
    AND char_length("description") BETWEEN 1 AND 2000
  ),
  CONSTRAINT "ActionTaken_result_length" CHECK (
    "result" IS NULL OR (
      "result" = btrim("result")
      AND char_length("result") BETWEEN 1 AND 2000
    )
  ),
  CONSTRAINT "ActionTaken_follow_up_consistency" CHECK (
    (
      "followUpRequired" = true
      AND "followUpNote" IS NOT NULL
      AND "followUpNote" = btrim("followUpNote")
      AND char_length("followUpNote") BETWEEN 1 AND 1000
    ) OR (
      "followUpRequired" = false
      AND "followUpNote" IS NULL
    )
  ),
  CONSTRAINT "ActionTaken_attachment_notes_length" CHECK (
    "attachmentNotes" IS NULL OR (
      "attachmentNotes" = btrim("attachmentNotes")
      AND char_length("attachmentNotes") BETWEEN 1 AND 1000
    )
  ),
  CONSTRAINT "ActionTaken_cancellation_reason_length" CHECK (
    "cancellationReason" IS NULL OR (
      "cancellationReason" = btrim("cancellationReason")
      AND char_length("cancellationReason") BETWEEN 1 AND 500
    )
  ),
  CONSTRAINT "ActionTaken_completion_consistency" CHECK (
    (
      "status" = 'COMPLETED'
      AND "result" IS NOT NULL
      AND "performedById" IS NOT NULL
      AND "completedAt" IS NOT NULL
    ) OR (
      "status" <> 'COMPLETED'
      AND "performedById" IS NULL
      AND "completedAt" IS NULL
    )
  ),
  CONSTRAINT "ActionTaken_cancellation_consistency" CHECK (
    (
      "status" = 'CANCELLED'
      AND "cancelledAt" IS NOT NULL
      AND "cancelledById" IS NOT NULL
      AND "cancellationReason" IS NOT NULL
    ) OR (
      "status" <> 'CANCELLED'
      AND "cancelledAt" IS NULL
      AND "cancelledById" IS NULL
      AND "cancellationReason" IS NULL
    )
  )
);

CREATE TABLE "ActionTakenEvent" (
  "id" SERIAL NOT NULL,
  "actionTakenId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "ActionEventType" NOT NULL,
  "fromStatus" "ActionStatus",
  "toStatus" "ActionStatus",
  "fromAssigneeId" INTEGER,
  "toAssigneeId" INTEGER,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActionTakenEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketWorkflowEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actorId" INTEGER NOT NULL,
  "eventType" "TicketEventType" NOT NULL,
  "fromStatus" "TicketStatus",
  "toStatus" "TicketStatus",
  "fromOwnerId" INTEGER,
  "toOwnerId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketWorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionTaken_ticketId_actionAt_id_idx"
  ON "ActionTaken"("ticketId", "actionAt", "id");
CREATE INDEX "ActionTaken_assigneeId_status_actionAt_id_idx"
  ON "ActionTaken"("assigneeId", "status", "actionAt", "id");
CREATE INDEX "ActionTaken_performedById_completedAt_id_idx"
  ON "ActionTaken"("performedById", "completedAt", "id");
CREATE INDEX "ActionTaken_createdById_idx" ON "ActionTaken"("createdById");
CREATE INDEX "ActionTaken_cancelledById_idx" ON "ActionTaken"("cancelledById");

CREATE INDEX "ActionTakenEvent_actionTakenId_createdAt_id_idx"
  ON "ActionTakenEvent"("actionTakenId", "createdAt", "id");
CREATE INDEX "ActionTakenEvent_actorId_idx" ON "ActionTakenEvent"("actorId");
CREATE INDEX "ActionTakenEvent_fromAssigneeId_idx" ON "ActionTakenEvent"("fromAssigneeId");
CREATE INDEX "ActionTakenEvent_toAssigneeId_idx" ON "ActionTakenEvent"("toAssigneeId");

CREATE INDEX "TicketWorkflowEvent_ticketId_createdAt_id_idx"
  ON "TicketWorkflowEvent"("ticketId", "createdAt", "id");
CREATE INDEX "TicketWorkflowEvent_actorId_idx" ON "TicketWorkflowEvent"("actorId");
CREATE INDEX "TicketWorkflowEvent_fromOwnerId_idx" ON "TicketWorkflowEvent"("fromOwnerId");
CREATE INDEX "TicketWorkflowEvent_toOwnerId_idx" ON "TicketWorkflowEvent"("toOwnerId");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTaken_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActionTakenEvent"
  ADD CONSTRAINT "ActionTakenEvent_actionTakenId_fkey"
    FOREIGN KEY ("actionTakenId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_fromAssigneeId_fkey"
    FOREIGN KEY ("fromAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ActionTakenEvent_toAssigneeId_fkey"
    FOREIGN KEY ("toAssigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TicketWorkflowEvent"
  ADD CONSTRAINT "TicketWorkflowEvent_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketWorkflowEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketWorkflowEvent_fromOwnerId_fkey"
    FOREIGN KEY ("fromOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TicketWorkflowEvent_toOwnerId_fkey"
    FOREIGN KEY ("toOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
