// =============================================================================
// Campus Connect — ASP.NET Core Entity Models
// File: Models/Entities.cs
// Matches: MSSQL tables created in 001_create_tables.sql
// =============================================================================

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CampusConnect.Models
{
    // ── Department ──────────────────────────────────────────────────────────────
    [Table("departments")]
    public class Department
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(150)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(20)]
        [Column("code")]
        public string? Code { get; set; }

        [Column("hod_user_id")]
        public string? HodUserId { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("HodUserId")]
        public User? Hod { get; set; }
        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<Location> Locations { get; set; } = new List<Location>();
    }

    // ── User ────────────────────────────────────────────────────────────────────
    // Maps to AppUser in lib/models/user.dart (Flutter)
    [Table("users")]
    public class User
    {
        [Key, MaxLength(36)]
        [Column("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required, MaxLength(150)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Required, MaxLength(255)]
        [Column("email")]
        public string Email { get; set; } = string.Empty;

        [Required, MaxLength(255)]
        [Column("password_hash")]
        public string PasswordHash { get; set; } = string.Empty;  // BCrypt hash

        [Required, MaxLength(15)]
        [Column("phone")]
        public string Phone { get; set; } = string.Empty;

        /// <summary>0 = Student, 1 = Staff</summary>
        [Column("role")]
        public byte Role { get; set; }

        [Column("department_id")]
        public int? DepartmentId { get; set; }

        [MaxLength(50)]
        [Column("roll_no")]
        public string? RollNo { get; set; }           // Register No. (student) | Staff ID (staff)

        [MaxLength(10)]
        [Column("program_type")]
        public string? ProgramType { get; set; }      // 'UG' | 'PG'

        [MaxLength(50)]
        [Column("branch")]
        public string? Branch { get; set; }           // 'B.E' | 'B.Tech' | 'M.BA'

        [MaxLength(20)]
        [Column("study_year")]
        public string? StudyYear { get; set; }        // 'I-Year' | 'II-Year' | 'III-Year' | 'IV-Year'

        [MaxLength(100)]
        [Column("designation")]
        public string? Designation { get; set; }      // Staff position

        [MaxLength(500)]
        [Column("avatar_url")]
        public string? AvatarUrl { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("last_login_at")]
        public DateTime? LastLoginAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }
        public ICollection<Ticket> CreatedTickets { get; set; } = new List<Ticket>();
        public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    }

    // ── Location ────────────────────────────────────────────────────────────────
    [Table("locations")]
    public class Location
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(100)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(100)]
        [Column("block")]
        public string? Block { get; set; }

        [MaxLength(20)]
        [Column("floor")]
        public string? Floor { get; set; }

        [Column("department_id")]
        public int? DepartmentId { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("DepartmentId")]
        public Department? Department { get; set; }
        public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
        public ICollection<QrCode> QrCodes { get; set; } = new List<QrCode>();
    }

    // ── QrCode ──────────────────────────────────────────────────────────────────
    [Table("qr_codes")]
    public class QrCode
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("location_id")]
        public int LocationId { get; set; }

        [Required, MaxLength(64)]
        [Column("qr_token")]
        public string QrToken { get; set; } = string.Empty;

        [MaxLength(500)]
        [Column("qr_image_url")]
        public string? QrImageUrl { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [MaxLength(36)]
        [Column("generated_by")]
        public string? GeneratedBy { get; set; }

        [Column("generated_at")]
        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        [Column("expires_at")]
        public DateTime? ExpiresAt { get; set; }

        // Navigation
        [ForeignKey("LocationId")]
        public Location Location { get; set; } = null!;
    }

    // ── ComplaintCategory ────────────────────────────────────────────────────────
    [Table("complaint_categories")]
    public class ComplaintCategory
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required, MaxLength(100)]
        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        [Column("description")]
        public string? Description { get; set; }

        [MaxLength(50)]
        [Column("icon")]
        public string? Icon { get; set; }

        [Column("sort_order")]
        public int SortOrder { get; set; } = 0;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
    }

    // ── Ticket ──────────────────────────────────────────────────────────────────
    // Maps to Ticket in lib/models/ticket.dart (Flutter)
    [Table("tickets")]
    public class Ticket
    {
        [Key, MaxLength(30)]
        [Column("id")]
        public string Id { get; set; } = string.Empty;   // 'TKT-YYYYMMDD-NNN'

        [Required, MaxLength(255)]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(2000)]
        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Column("location_id")]
        public int LocationId { get; set; }

        [Required, MaxLength(100)]
        [Column("location_name")]
        public string LocationName { get; set; } = string.Empty;

        [Column("category_id")]
        public int CategoryId { get; set; }

        [Required, MaxLength(100)]
        [Column("category_name")]
        public string CategoryName { get; set; } = string.Empty;

        /// <summary>0=Low | 1=Medium | 2=High | 3=Critical</summary>
        [Column("priority")]
        public byte Priority { get; set; } = 1;

        /// <summary>0=Open | 1=InProgress | 2=EscalatedL2 | 3=EscalatedL3 | 4=Resolved | 5=Closed</summary>
        [Column("status")]
        public byte Status { get; set; } = 0;

        [Column("escalation_level")]
        public byte EscalationLevel { get; set; } = 1;

        [MaxLength(150)]
        [Column("assigned_to_name")]
        public string? AssignedToName { get; set; }

        [MaxLength(100)]
        [Column("assigned_role")]
        public string? AssignedRole { get; set; }

        [Column("has_photo")]
        public bool HasPhoto { get; set; } = false;

        [MaxLength(500)]
        [Column("photo_url")]
        public string? PhotoUrl { get; set; }

        [Required, MaxLength(36)]
        [Column("creator_id")]
        public string CreatorId { get; set; } = string.Empty;

        [Required, MaxLength(150)]
        [Column("creator_name")]
        public string CreatorName { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        [Column("creator_role")]
        public string CreatorRole { get; set; } = string.Empty;   // 'Student' | 'Staff'

        [Column("resolved_at")]
        public DateTime? ResolvedAt { get; set; }

        [Column("closed_at")]
        public DateTime? ClosedAt { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("LocationId")]
        public Location Location { get; set; } = null!;
        [ForeignKey("CategoryId")]
        public ComplaintCategory Category { get; set; } = null!;
        [ForeignKey("CreatorId")]
        public User Creator { get; set; } = null!;
        public ICollection<TicketUpdate> Updates { get; set; } = new List<TicketUpdate>();
        public ICollection<EscalationHistory> EscalationHistory { get; set; } = new List<EscalationHistory>();
        public ICollection<Notification> Notifications { get; set; } = new List<Notification>();
    }

    // ── TicketUpdate ────────────────────────────────────────────────────────────
    // Maps to TicketUpdate in lib/models/ticket.dart (Flutter)
    [Table("ticket_updates")]
    public class TicketUpdate
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required, MaxLength(30)]
        [Column("ticket_id")]
        public string TicketId { get; set; } = string.Empty;

        [Required, MaxLength(1000)]
        [Column("message")]
        public string Message { get; set; } = string.Empty;

        [MaxLength(30)]
        [Column("update_type")]
        public string UpdateType { get; set; } = "remark";

        [Required, MaxLength(150)]
        [Column("updated_by")]
        public string UpdatedBy { get; set; } = string.Empty;   // Name or 'System'

        [MaxLength(36)]
        [Column("user_id")]
        public string? UserId { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("TicketId")]
        public Ticket Ticket { get; set; } = null!;
    }

    // ── EscalationHistory ───────────────────────────────────────────────────────
    [Table("escalation_history")]
    public class EscalationHistory
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [Required, MaxLength(30)]
        [Column("ticket_id")]
        public string TicketId { get; set; } = string.Empty;

        [Column("from_level")]
        public byte FromLevel { get; set; }

        [Column("to_level")]
        public byte ToLevel { get; set; }

        [MaxLength(150)]
        [Column("from_assignee")]
        public string? FromAssignee { get; set; }

        [MaxLength(150)]
        [Column("to_assignee")]
        public string? ToAssignee { get; set; }

        [Required, MaxLength(500)]
        [Column("reason")]
        public string Reason { get; set; } = string.Empty;

        [MaxLength(150)]
        [Column("escalated_by")]
        public string? EscalatedBy { get; set; }

        [MaxLength(36)]
        [Column("user_id")]
        public string? UserId { get; set; }

        [Column("escalated_at")]
        public DateTime EscalatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("TicketId")]
        public Ticket Ticket { get; set; } = null!;
    }

    // ── Notification ────────────────────────────────────────────────────────────
    [Table("notifications")]
    public class Notification
    {
        [Key, MaxLength(36)]
        [Column("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [MaxLength(36)]
        [Column("user_id")]
        public string? UserId { get; set; }          // NULL = broadcast to all

        [Required, MaxLength(255)]
        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Required, MaxLength(1000)]
        [Column("body")]
        public string Body { get; set; } = string.Empty;

        [Required, MaxLength(50)]
        [Column("type")]
        public string Type { get; set; } = string.Empty;

        [MaxLength(30)]
        [Column("ticket_id")]
        public string? TicketId { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Column("privileged_only")]
        public bool PrivilegedOnly { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("UserId")]
        public User? User { get; set; }
        [ForeignKey("TicketId")]
        public Ticket? Ticket { get; set; }
    }

    // ── AuditLog ────────────────────────────────────────────────────────────────
    [Table("audit_logs")]
    public class AuditLog
    {
        [Key]
        [Column("id")]
        public long Id { get; set; }

        [MaxLength(36)]
        [Column("user_id")]
        public string? UserId { get; set; }

        [MaxLength(150)]
        [Column("user_name")]
        public string? UserName { get; set; }

        [MaxLength(50)]
        [Column("user_role")]
        public string? UserRole { get; set; }

        [Required, MaxLength(100)]
        [Column("action")]
        public string Action { get; set; } = string.Empty;

        [MaxLength(50)]
        [Column("entity_type")]
        public string? EntityType { get; set; }

        [MaxLength(50)]
        [Column("entity_id")]
        public string? EntityId { get; set; }

        [Column("old_value")]
        public string? OldValue { get; set; }    // JSON

        [Column("new_value")]
        public string? NewValue { get; set; }    // JSON

        [MaxLength(500)]
        [Column("description")]
        public string? Description { get; set; }

        [MaxLength(45)]
        [Column("ip_address")]
        public string? IpAddress { get; set; }

        [MaxLength(500)]
        [Column("user_agent")]
        public string? UserAgent { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
