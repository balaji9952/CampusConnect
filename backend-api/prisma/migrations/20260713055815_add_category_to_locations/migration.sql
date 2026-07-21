/*
  Warnings:

  - A unique constraint covering the columns `[routing_key,escalation_level]` on the table `global_assignments` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "global_assignments" ADD COLUMN     "escalation_level" SMALLINT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "category" VARCHAR(50) NOT NULL DEFAULT 'General',
ADD COLUMN     "internal_code" VARCHAR(50);

-- CreateTable
CREATE TABLE "escalation_assignments" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "escalation_level" SMALLINT NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escalation_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "designations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_privileged" BOOLEAN NOT NULL DEFAULT false,
    "is_hod" BOOLEAN NOT NULL DEFAULT false,
    "can_escalate" BOOLEAN NOT NULL DEFAULT false,
    "escalation_level" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK__designations" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "escalation_assignments_department_id_is_active_idx" ON "escalation_assignments"("department_id", "is_active");

-- CreateIndex
CREATE INDEX "escalation_assignments_escalation_level_idx" ON "escalation_assignments"("escalation_level");

-- CreateIndex
CREATE UNIQUE INDEX "escalation_assignments_department_id_escalation_level_key" ON "escalation_assignments"("department_id", "escalation_level");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_designations_name" ON "designations"("name");

-- CreateIndex
CREATE INDEX "designations_is_privileged_idx" ON "designations"("is_privileged");

-- CreateIndex
CREATE INDEX "designations_can_escalate_idx" ON "designations"("can_escalate");

-- CreateIndex
CREATE INDEX "designations_escalation_level_idx" ON "designations"("escalation_level");

-- CreateIndex
CREATE INDEX "global_assignments_escalation_level_idx" ON "global_assignments"("escalation_level");

-- CreateIndex
CREATE UNIQUE INDEX "global_assignments_routing_key_escalation_level_key" ON "global_assignments"("routing_key", "escalation_level");

-- AddForeignKey
ALTER TABLE "escalation_assignments" ADD CONSTRAINT "escalation_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "escalation_assignments" ADD CONSTRAINT "escalation_assignments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
