-- =============================================================================
-- Campus Connect — Feedback & Complaint Management System
-- Script: 003_seed_data.sql
-- Run AFTER 001_create_tables.sql and 002_indexes.sql
-- Inserts default reference data (departments, locations, categories)
-- =============================================================================

USE CampusConnectDB;
GO

-- =============================================================================
-- SEED: departments
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM departments)
BEGIN
    INSERT INTO departments (name, code) VALUES
        ('Civil Engineering',                           'CE'),
        ('Computer Science and Engineering',            'CSE'),
        ('Mechanical Engineering',                      'ME'),
        ('Electronics and Communication Engineering',   'ECE'),
        ('Electrical and Electronics Engineering',      'EEE'),
        ('Information Technology',                      'IT'),
        ('Artificial Intelligence and Data Science',    'AIDS'),
        ('Master of Business Administration',           'MBA'),
        ('Administration',                              'ADMIN');

    PRINT 'Departments seeded.';
END
GO

-- =============================================================================
-- SEED: locations
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM locations)
BEGIN
    INSERT INTO locations (name, block, floor) VALUES
        ('Academic Block',      'Main Block',       NULL),
        ('Hostel',              'Hostel Block',     NULL),
        ('Canteen',             'Ground Floor',     'Ground Floor'),
        ('Library',             'Main Block',       '1st Floor'),
        ('Toilet / Washroom',   NULL,               NULL),
        ('Transport',           'Parking Area',     NULL),
        ('Computer Lab',        'CSE Block',        '2nd Floor'),
        ('ECE Lab',             'ECE Block',        '1st Floor'),
        ('Mechanical Lab',      'ME Block',         'Ground Floor'),
        ('Seminar Hall',        'Main Block',       '3rd Floor'),
        ('Staff Room',          'Main Block',       '2nd Floor'),
        ('Principal Office',    'Admin Block',      '1st Floor'),
        ('Sports Ground',       NULL,               NULL),
        ('Other',               NULL,               NULL);

    PRINT 'Locations seeded.';
END
GO

-- =============================================================================
-- SEED: complaint_categories
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM complaint_categories)
BEGIN
    INSERT INTO complaint_categories (name, description, icon, sort_order) VALUES
        ('Infrastructure',  'Building, walls, doors, windows, roof issues',           'business',          1),
        ('Cleanliness',     'Cleaning, hygiene, waste disposal issues',               'cleaning_services', 2),
        ('Food Quality',    'Mess food quality, hygiene, availability issues',        'restaurant',        3),
        ('Safety',          'Safety hazards, lighting, security concerns',            'security',          4),
        ('Maintenance',     'General maintenance and repair needs',                   'build',             5),
        ('Electrical',      'Power, wiring, switches, fans, lights issues',           'electrical_services',6),
        ('Plumbing',        'Water, pipes, taps, drainage, leakage issues',           'plumbing',          7),
        ('IT / Network',    'Internet, Wi-Fi, computers, projector issues',           'wifi',              8),
        ('Staff Behavior',  'Complaints regarding staff conduct',                     'person',            9),
        ('Other',           'Any issue not covered in the above categories',          'help_outline',      10);

    PRINT 'Complaint categories seeded.';
END
GO

-- =============================================================================
-- SEED: Default Admin User (Change password after first login!)
-- password_hash below = BCrypt hash of 'Admin@1234' (change immediately!)
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM users WHERE role = 1 AND designation = 'Admin')
BEGIN
    INSERT INTO users (
        id, name, email, password_hash, phone,
        role, designation, is_active
    ) VALUES (
        NEWID(),
        'System Administrator',
        'admin@campusconnect.edu.in',
        '$2a$11$omgThMlDZUc/nvQHQrt8QeSt523bcxvvAW4WGr0pVEnq6VU4kUHzu',   -- BCrypt hash for 'Admin@1234'
        '0000000000',
        1,          -- Staff
        'Admin',
        1
    );

    PRINT 'Default admin user seeded. IMPORTANT: Change the password hash!';
END
GO

PRINT 'Seed data inserted successfully.';
GO
