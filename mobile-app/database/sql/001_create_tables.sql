-- =============================================================================
-- Campus Connect — Feedback & Complaint Management System
-- Database: Microsoft SQL Server (MSSQL)
-- Backend:  ASP.NET Core
-- Script:   001_create_tables.sql
-- Run this script ONCE on your college MSSQL server.
-- =============================================================================

USE campusconnect;   -- Change this to your actual database name
GO

-- =============================================================================
-- TABLE 1: departments
-- Must be created before users and locations (FK dependencies)
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='departments' AND xtype='U')
CREATE TABLE departments (
    id            INT              PRIMARY KEY IDENTITY(1,1),
    name          NVARCHAR(150)    NOT NULL,
    code          VARCHAR(20)      NULL,          -- e.g. 'CSE', 'ECE', 'ME'
    hod_user_id   VARCHAR(36)      NULL,          -- FK added later (circular ref workaround)
    is_active     BIT              NOT NULL DEFAULT 1,
    created_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_departments_name UNIQUE (name)
);
GO

-- =============================================================================
-- TABLE 2: users
-- Stores all students and staff accounts.
-- Maps to: AppUser in lib/models/user.dart
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
CREATE TABLE users (
    id              VARCHAR(36)      PRIMARY KEY,           -- UUID (e.g. Guid.NewGuid())
    name            NVARCHAR(150)    NOT NULL,
    email           NVARCHAR(255)    NOT NULL,
    password_hash   NVARCHAR(255)    NOT NULL,              -- BCrypt hashed — NEVER plain text
    phone           VARCHAR(15)      NOT NULL,
    role            TINYINT          NOT NULL,              -- 0 = Student, 1 = Staff
    department_id   INT              NULL
                        REFERENCES departments(id) ON DELETE SET NULL,
    roll_no         VARCHAR(50)      NULL,                  -- Register No. (student) OR Staff ID (staff)
    program_type    VARCHAR(10)      NULL,                  -- 'UG' | 'PG' (students only)
    branch          VARCHAR(50)      NULL,                  -- 'B.E' | 'B.Tech' | 'M.BA'
    study_year      VARCHAR(20)      NULL,                  -- 'I-Year' | 'II-Year' | 'III-Year' | 'IV-Year'
    designation     NVARCHAR(100)    NULL,                  -- Staff position (staff only)
    avatar_url      NVARCHAR(500)    NULL,                  -- Profile photo URL / file path
    is_active       BIT              NOT NULL DEFAULT 1,
    last_login_at   DATETIME2        NULL,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_users_email UNIQUE (email)
);
GO

-- Now add the HOD FK to departments (now that users exists)
ALTER TABLE departments
ADD CONSTRAINT FK_departments_hod
    FOREIGN KEY (hod_user_id) REFERENCES users(id) ON DELETE SET NULL;
GO

-- =============================================================================
-- TABLE 3: locations
-- Campus locations where complaints can be raised.
-- Each location can have a QR code.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='locations' AND xtype='U')
CREATE TABLE locations (
    id              INT              PRIMARY KEY IDENTITY(1,1),
    name            NVARCHAR(100)    NOT NULL,              -- 'Canteen', 'Hostel', 'Library'
    block           NVARCHAR(100)    NULL,                  -- 'Main Block', 'ECE Block'
    floor           VARCHAR(20)      NULL,                  -- 'Ground Floor', '2nd Floor'
    department_id   INT              NULL
                        REFERENCES departments(id) ON DELETE SET NULL,
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_locations_name UNIQUE (name)
);
GO

-- =============================================================================
-- TABLE 4: qr_codes
-- QR codes linked to each campus location.
-- Scanned by students to quickly submit complaints.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='qr_codes' AND xtype='U')
CREATE TABLE qr_codes (
    id              INT              PRIMARY KEY IDENTITY(1,1),
    location_id     INT              NOT NULL
                        REFERENCES locations(id) ON DELETE CASCADE,
    qr_token        VARCHAR(64)      NOT NULL,              -- Secure random token
    qr_image_url    NVARCHAR(500)    NULL,                  -- Path to generated QR image
    is_active       BIT              NOT NULL DEFAULT 1,
    generated_by    VARCHAR(36)      NULL
                        REFERENCES users(id) ON DELETE SET NULL,
    generated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at      DATETIME2        NULL,
    CONSTRAINT UQ_qr_token UNIQUE (qr_token)
);
GO

-- =============================================================================
-- TABLE 5: complaint_categories
-- Types of complaints — configurable from admin panel.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='complaint_categories' AND xtype='U')
CREATE TABLE complaint_categories (
    id              INT              PRIMARY KEY IDENTITY(1,1),
    name            NVARCHAR(100)    NOT NULL,
    description     NVARCHAR(500)    NULL,
    icon            VARCHAR(50)      NULL,                  -- Material icon name
    sort_order      INT              NOT NULL DEFAULT 0,
    is_active       BIT              NOT NULL DEFAULT 1,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_complaint_categories_name UNIQUE (name)
);
GO

-- =============================================================================
-- TABLE 6: tickets  *** CORE TABLE ***
-- Main complaint/feedback ticket.
-- Maps to: Ticket in lib/models/ticket.dart
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tickets' AND xtype='U')
CREATE TABLE tickets (
    id                  VARCHAR(30)      PRIMARY KEY,       -- Format: 'TKT-YYYYMMDD-NNN'
    title               NVARCHAR(255)    NOT NULL,
    description         NVARCHAR(2000)   NOT NULL,
    location_id         INT              NOT NULL
                            REFERENCES locations(id),
    location_name       NVARCHAR(100)    NOT NULL,          -- Denormalized snapshot
    category_id         INT              NOT NULL
                            REFERENCES complaint_categories(id),
    category_name       NVARCHAR(100)    NOT NULL,          -- Denormalized snapshot

    -- Status & Priority
    -- priority:  0=Low | 1=Medium | 2=High | 3=Critical
    -- status:    0=Open | 1=InProgress | 2=EscalatedL2 | 3=EscalatedL3 | 4=Resolved | 5=Closed
    priority            TINYINT          NOT NULL DEFAULT 1,
    status              TINYINT          NOT NULL DEFAULT 0,
    escalation_level    TINYINT          NOT NULL DEFAULT 1, -- 1, 2 or 3

    -- Assignment
    assigned_to_name    NVARCHAR(150)    NULL,
    assigned_role       NVARCHAR(100)    NULL,              -- 'Mess In-charge', 'Warden', 'HOD', 'Dean', 'Principal'

    -- Attachment
    has_photo           BIT              NOT NULL DEFAULT 0,
    photo_url           NVARCHAR(500)    NULL,

    -- Creator (denormalized for history accuracy)
    creator_id          VARCHAR(36)      NOT NULL
                            REFERENCES users(id),
    creator_name        NVARCHAR(150)    NOT NULL,
    creator_role        NVARCHAR(50)     NOT NULL,          -- 'Student' | 'Staff'

    -- Timestamps
    resolved_at         DATETIME2        NULL,
    closed_at           DATETIME2        NULL,
    created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =============================================================================
-- TABLE 7: ticket_updates
-- Activity log and remarks for each ticket.
-- Maps to: TicketUpdate in lib/models/ticket.dart
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ticket_updates' AND xtype='U')
CREATE TABLE ticket_updates (
    id              BIGINT           PRIMARY KEY IDENTITY(1,1),
    ticket_id       VARCHAR(30)      NOT NULL
                        REFERENCES tickets(id) ON DELETE CASCADE,
    message         NVARCHAR(1000)   NOT NULL,
    -- update_type: 'created' | 'status_change' | 'remark' | 'escalation' | 'resolved' | 'closed' | 'photo_added'
    update_type     VARCHAR(30)      NOT NULL DEFAULT 'remark',
    updated_by      NVARCHAR(150)    NOT NULL,              -- Name (or 'System')
    user_id         VARCHAR(36)      NULL
                        REFERENCES users(id) ON DELETE SET NULL,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =============================================================================
-- TABLE 8: escalation_history
-- Full audit trail of every escalation event on a ticket.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='escalation_history' AND xtype='U')
CREATE TABLE escalation_history (
    id              BIGINT           PRIMARY KEY IDENTITY(1,1),
    ticket_id       VARCHAR(30)      NOT NULL
                        REFERENCES tickets(id) ON DELETE CASCADE,
    from_level      TINYINT          NOT NULL,              -- Previous escalation level (1/2/3)
    to_level        TINYINT          NOT NULL,              -- New escalation level
    from_assignee   NVARCHAR(150)    NULL,
    to_assignee     NVARCHAR(150)    NULL,
    reason          NVARCHAR(500)    NOT NULL,              -- 'Auto: 24h SLA breach' | 'Manual escalation by ...'
    escalated_by    NVARCHAR(150)    NULL,                  -- 'System' or user name
    user_id         VARCHAR(36)      NULL
                        REFERENCES users(id) ON DELETE SET NULL,
    escalated_at    DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =============================================================================
-- TABLE 9: notifications
-- In-app notifications sent to users.
-- Maps to: notifications list in TicketService
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='notifications' AND xtype='U')
CREATE TABLE notifications (
    id              VARCHAR(36)      PRIMARY KEY,           -- UUID
    -- user_id NULL = system-wide broadcast to all users
    user_id         VARCHAR(36)      NULL
                        REFERENCES users(id) ON DELETE CASCADE,
    title           NVARCHAR(255)    NOT NULL,
    body            NVARCHAR(1000)   NOT NULL,
    -- type: 'ticket_created' | 'status_update' | 'escalation' | 'resolved' | 'system' | 'sla_breach'
    type            VARCHAR(50)      NOT NULL,
    ticket_id       VARCHAR(30)      NULL
                        REFERENCES tickets(id) ON DELETE SET NULL,
    is_read         BIT              NOT NULL DEFAULT 0,
    privileged_only BIT              NOT NULL DEFAULT 0,    -- Only shown to HOD/Dean/Principal/Admin
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- =============================================================================
-- TABLE 10: audit_logs
-- Full admin audit trail — every significant action in the system.
-- Used by the Admin Web Panel > Audit Logs page.
-- =============================================================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='audit_logs' AND xtype='U')
CREATE TABLE audit_logs (
    id              BIGINT           PRIMARY KEY IDENTITY(1,1),
    user_id         VARCHAR(36)      NULL
                        REFERENCES users(id) ON DELETE SET NULL,
    user_name       NVARCHAR(150)    NULL,
    user_role       NVARCHAR(50)     NULL,
    -- action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'TICKET_CREATED' | 'TICKET_STATUS_CHANGED'
    --         'TICKET_ESCALATED' | 'TICKET_RESOLVED' | 'TICKET_CLOSED' | 'TICKET_DELETED'
    --         'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'SETTINGS_CHANGED'
    action          NVARCHAR(100)    NOT NULL,
    entity_type     VARCHAR(50)      NULL,                  -- 'ticket' | 'user' | 'department' | 'notification'
    entity_id       VARCHAR(50)      NULL,                  -- ID of the affected record
    old_value       NVARCHAR(MAX)    NULL,                  -- JSON: state before change
    new_value       NVARCHAR(MAX)    NULL,                  -- JSON: state after change
    description     NVARCHAR(500)    NULL,                  -- Human-readable summary
    ip_address      VARCHAR(45)      NULL,
    user_agent      NVARCHAR(500)    NULL,
    created_at      DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

PRINT 'All 10 tables created successfully.';
GO
