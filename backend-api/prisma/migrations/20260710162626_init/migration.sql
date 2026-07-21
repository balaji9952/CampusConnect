-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" VARCHAR(36),
    "user_name" VARCHAR(150),
    "user_role" VARCHAR(50),
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(50),
    "old_value" TEXT,
    "new_value" TEXT,
    "description" VARCHAR(500),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__audit_lo__3213E83F33D73A3A" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "routing_type" VARCHAR(50) NOT NULL DEFAULT 'DEPARTMENT_ROUTED',
    "routing_key" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "sla_response_hours" INTEGER NOT NULL DEFAULT 24,
    "sla_escalation_hours" INTEGER NOT NULL DEFAULT 48,
    "sla_resolution_hours" INTEGER NOT NULL DEFAULT 72,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__complain__3213E83F3DD5A649" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(20),
    "hod_user_id" VARCHAR(36),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__departme__3213E83FBEFDD360" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_history" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" VARCHAR(30) NOT NULL,
    "from_level" SMALLINT NOT NULL,
    "to_level" SMALLINT NOT NULL,
    "from_assignee" VARCHAR(150),
    "to_assignee" VARCHAR(150),
    "reason" VARCHAR(500) NOT NULL,
    "escalated_by" VARCHAR(150),
    "user_id" VARCHAR(36),
    "escalated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__escalati__3213E83F5515FDDC" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "block" VARCHAR(100),
    "floor" VARCHAR(20),
    "department_id" INTEGER,
    "routing_type" VARCHAR(50) NOT NULL DEFAULT 'DEPARTMENT_ROUTED',
    "routing_key" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__location__3213E83F02E81331" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36),
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "ticket_id" VARCHAR(30),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "privileged_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__notifica__3213E83F850DB87A" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER NOT NULL,
    "sub_location_id" INTEGER,
    "qr_token" VARCHAR(64) NOT NULL,
    "qr_image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "generated_by" VARCHAR(36),
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "PK__qr_codes__3213E83FFE3896C7" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_QR_sublocations" (
    "id" SERIAL NOT NULL,
    "location_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_QR_sublocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_updates" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" VARCHAR(30) NOT NULL,
    "message" TEXT NOT NULL,
    "update_type" VARCHAR(30) NOT NULL DEFAULT 'remark',
    "updated_by" VARCHAR(150) NOT NULL,
    "user_id" VARCHAR(36),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__ticket_u__3213E83F47A92BA5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "location_id" INTEGER NOT NULL,
    "location_name" VARCHAR(100) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "ticket_type" VARCHAR(50) NOT NULL DEFAULT 'COMPLAINT',
    "priority" SMALLINT NOT NULL DEFAULT 1,
    "status" SMALLINT NOT NULL DEFAULT 0,
    "escalation_level" SMALLINT NOT NULL DEFAULT 1,
    "assigned_to_name" VARCHAR(150),
    "assigned_role" VARCHAR(100),
    "has_photo" BOOLEAN NOT NULL DEFAULT false,
    "photo_url" VARCHAR(500),
    "creator_id" VARCHAR(36) NOT NULL,
    "creator_name" VARCHAR(150) NOT NULL,
    "creator_role" VARCHAR(50) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "ticket_number" VARCHAR(30),

    CONSTRAINT "PK__tickets__3213E83F2479ACDE" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "role" SMALLINT NOT NULL,
    "department_id" INTEGER,
    "roll_no" VARCHAR(50),
    "program_type" VARCHAR(10),
    "branch" VARCHAR(50),
    "study_year" VARCHAR(20),
    "designation" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "last_google_login" TIMESTAMP(3),
    "google_sub" VARCHAR(255),
    "google_email" VARCHAR(255),
    "auth_provider" VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK__users__3213E83F8185631D" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_fcm_tokens" (
    "token" VARCHAR(500) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "device_id" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_fcm_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "user_id" VARCHAR(36) NOT NULL,
    "ticket_assignments" BOOLEAN NOT NULL DEFAULT true,
    "escalations" BOOLEAN NOT NULL DEFAULT true,
    "resolutions" BOOLEAN NOT NULL DEFAULT true,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "global_assignments" (
    "id" SERIAL NOT NULL,
    "routing_key" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assignments" (
    "id" BIGSERIAL NOT NULL,
    "ticket_id" VARCHAR(30) NOT NULL,
    "assigned_to_user_id" VARCHAR(36),
    "assigned_by" VARCHAR(36),
    "assignment_reason" VARCHAR(500) NOT NULL,
    "escalation_level" SMALLINT NOT NULL DEFAULT 1,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "request_path" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "status_code" INTEGER,
    "response_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" VARCHAR(100),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "jwt_id" VARCHAR(100) NOT NULL,
    "device_name" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_verification_sessions" (
    "id" VARCHAR(36) NOT NULL,
    "token" VARCHAR(36) NOT NULL,
    "user_id" VARCHAR(36) NOT NULL,
    "location_id" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_by_ip" VARCHAR(50),
    "device_id" VARCHAR(100),

    CONSTRAINT "qr_verification_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IX_audit_created" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "IX_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "IX_audit_user" ON "audit_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_complaint_categories_name" ON "complaint_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_departments_name" ON "departments"("name");

-- CreateIndex
CREATE INDEX "IX_escalation_ticket" ON "escalation_history"("ticket_id", "escalated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_locations_name" ON "locations"("name");

-- CreateIndex
CREATE INDEX "IX_notifications_user_unread" ON "notifications"("user_id", "is_read", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "IX_qr_token" ON "qr_codes"("qr_token");

-- CreateIndex
CREATE INDEX "IX_subloc_location" ON "academic_QR_sublocations"("location_id");

-- CreateIndex
CREATE INDEX "IX_ticket_updates_ticket" ON "ticket_updates"("ticket_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_ticket_number" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "IX_tickets_category" ON "tickets"("category_id");

-- CreateIndex
CREATE INDEX "IX_tickets_created_desc" ON "tickets"("created_at" DESC);

-- CreateIndex
CREATE INDEX "IX_tickets_creator" ON "tickets"("creator_id");

-- CreateIndex
CREATE INDEX "IX_tickets_location" ON "tickets"("location_id");

-- CreateIndex
CREATE INDEX "IX_tickets_status" ON "tickets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_users_google_sub" ON "users"("google_sub");

-- CreateIndex
CREATE INDEX "IX_users_department" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "IX_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "IX_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "user_fcm_tokens_user_id_idx" ON "user_fcm_tokens"("user_id");

-- CreateIndex
CREATE INDEX "user_fcm_tokens_device_id_idx" ON "user_fcm_tokens"("device_id");

-- CreateIndex
CREATE INDEX "global_assignments_routing_key_is_active_idx" ON "global_assignments"("routing_key", "is_active");

-- CreateIndex
CREATE INDEX "ticket_assignments_ticket_id_assigned_at_idx" ON "ticket_assignments"("ticket_id", "assigned_at" DESC);

-- CreateIndex
CREATE INDEX "ticket_assignments_assigned_to_user_id_idx" ON "ticket_assignments"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "ticket_assignments_assigned_by_idx" ON "ticket_assignments"("assigned_by");

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_created_at_idx" ON "idempotency_keys"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idempotency_keys_status_idx" ON "idempotency_keys"("status");

-- CreateIndex
CREATE UNIQUE INDEX "qr_verification_sessions_token_key" ON "qr_verification_sessions"("token");

-- CreateIndex
CREATE INDEX "qr_verification_sessions_token_idx" ON "qr_verification_sessions"("token");

-- CreateIndex
CREATE INDEX "qr_verification_sessions_user_id_expires_at_idx" ON "qr_verification_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "qr_verification_sessions_location_id_idx" ON "qr_verification_sessions"("location_id");

-- CreateIndex
CREATE INDEX "qr_verification_sessions_used_idx" ON "qr_verification_sessions"("used");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "FK__audit_log__user___72C60C4A" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "FK_departments_hod" FOREIGN KEY ("hod_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "escalation_history" ADD CONSTRAINT "FK__escalatio__ticke__6754599E" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "escalation_history" ADD CONSTRAINT "FK__escalatio__user___68487DD7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "FK__locations__depar__45F365D3" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "FK__notificat__ticke__6D0D32F4" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "FK__notificat__user___6C190EBB" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "FK__qr_codes__genera__4D94879B" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "FK__qr_codes__locati__4BAC3F29" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "academic_QR_sublocations" ADD CONSTRAINT "FK__subloc__location" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_updates" ADD CONSTRAINT "FK__ticket_up__ticke__619B8048" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_updates" ADD CONSTRAINT "FK__ticket_up__user___6383C8BA" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "FK__tickets__categor__5812160E" FOREIGN KEY ("category_id") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "FK__tickets__creator__5CD6CB2B" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "FK__tickets__locatio__571DF1D5" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "FK__users__departmen__3E52440B" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_assignments" ADD CONSTRAINT "global_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket_assignments" ADD CONSTRAINT "ticket_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
