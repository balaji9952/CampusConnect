-- =============================================================================
-- Campus Connect — Migration 004
-- Adds ticket_number column and index to the tickets table.
-- Run AFTER 001_create_tables.sql
-- =============================================================================

USE CampusConnectDB;
GO

-- Add ticket_number column (nullable to support existing rows)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns 
  WHERE object_id = OBJECT_ID('tickets') AND name = 'ticket_number'
)
BEGIN
  ALTER TABLE tickets ADD ticket_number VARCHAR(30) NULL;
  PRINT 'Column ticket_number added to tickets.';
END
GO

-- Add unique index (allowing nulls — SQL Server allows multiple NULLs in unique indexes)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes 
  WHERE object_id = OBJECT_ID('tickets') AND name = 'UQ_ticket_number'
)
BEGIN
  CREATE UNIQUE INDEX UQ_ticket_number ON tickets(ticket_number)
  WHERE ticket_number IS NOT NULL;   -- Filtered index: NULLs are excluded
  PRINT 'Unique index UQ_ticket_number created on tickets(ticket_number).';
END
GO

PRINT 'Migration 004 complete.';
GO
