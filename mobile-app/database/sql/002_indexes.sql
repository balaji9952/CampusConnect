-- =============================================================================
-- Campus Connect — Feedback & Complaint Management System
-- Script: 002_indexes.sql
-- Run AFTER 001_create_tables.sql
-- All performance indexes for MSSQL
-- =============================================================================

USE campusconnect;
GO

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE INDEX IX_users_email
    ON users(email);

CREATE INDEX IX_users_role
    ON users(role);

CREATE INDEX IX_users_department
    ON users(department_id);

CREATE INDEX IX_users_roll_no
    ON users(roll_no)
    WHERE roll_no IS NOT NULL;

-- ── tickets ───────────────────────────────────────────────────────────────────
CREATE INDEX IX_tickets_status
    ON tickets(status);

CREATE INDEX IX_tickets_creator
    ON tickets(creator_id);

CREATE INDEX IX_tickets_location
    ON tickets(location_id);

CREATE INDEX IX_tickets_category
    ON tickets(category_id);

CREATE INDEX IX_tickets_created_desc
    ON tickets(created_at DESC);

CREATE INDEX IX_tickets_escalation
    ON tickets(escalation_level, status)
    WHERE status NOT IN (4, 5);         -- exclude Resolved & Closed

-- ── ticket_updates ────────────────────────────────────────────────────────────
CREATE INDEX IX_ticket_updates_ticket
    ON ticket_updates(ticket_id, created_at DESC);

-- ── escalation_history ────────────────────────────────────────────────────────
CREATE INDEX IX_escalation_ticket
    ON escalation_history(ticket_id, escalated_at DESC);

-- ── notifications ─────────────────────────────────────────────────────────────
CREATE INDEX IX_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IX_notifications_ticket
    ON notifications(ticket_id)
    WHERE ticket_id IS NOT NULL;

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE INDEX IX_audit_user
    ON audit_logs(user_id, created_at DESC);

CREATE INDEX IX_audit_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IX_audit_created
    ON audit_logs(created_at DESC);

-- ── qr_codes ──────────────────────────────────────────────────────────────────
CREATE INDEX IX_qr_token
    ON qr_codes(qr_token);

CREATE INDEX IX_qr_location
    ON qr_codes(location_id)
    WHERE is_active = 1;

PRINT 'All indexes created successfully.';
GO
