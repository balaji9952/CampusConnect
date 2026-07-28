-- PostgreSQL / Supabase Reset Script

BEGIN;

-- If any statement fails, PostgreSQL aborts the transaction.
-- COMMIT will not execute successfully until the transaction is rolled back.

-- Why use DELETE instead of TRUNCATE CASCADE?
-- TRUNCATE CASCADE on 'locations' or 'tickets' would automatically cascade to 
-- the 'notifications' table because of the ticket_id foreign key.
-- This would wipe out ALL notifications (including system announcements).
-- Therefore, we must use DELETE to retain granular control.

-- 1. Notifications (ticket-related only)
DELETE FROM notifications WHERE ticket_id IS NOT NULL;

-- 2. Ticket Dependencies
DELETE FROM ticket_updates;
DELETE FROM ticket_assignments;
DELETE FROM escalation_history;

-- 3. Tickets
DELETE FROM tickets;
DELETE FROM qr_verification_sessions;

-- 4. QR Codes & Sublocations
DELETE FROM qr_codes;
DELETE FROM "academic_QR_sublocations";

-- 5. Locations
DELETE FROM locations;

-- Reset Sequences safely (Starts the next inserted ID at 1)
SELECT setval(pg_get_serial_sequence('ticket_updates', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('ticket_assignments', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('escalation_history', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('qr_codes', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('"academic_QR_sublocations"', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('locations', 'id'), 1, false);

COMMIT;
