// =============================================================================
// Campus Connect — ASP.NET Core EF Core DbContext
// File: Data/CampusConnectDbContext.cs
// =============================================================================

using CampusConnect.Models;
using Microsoft.EntityFrameworkCore;

namespace CampusConnect.Data
{
    public class CampusConnectDbContext : DbContext
    {
        public CampusConnectDbContext(DbContextOptions<CampusConnectDbContext> options)
            : base(options) { }

        // ── DbSets (one per table) ──────────────────────────────────────────────
        public DbSet<Department>        Departments         { get; set; }
        public DbSet<User>              Users               { get; set; }
        public DbSet<Location>          Locations           { get; set; }
        public DbSet<QrCode>            QrCodes             { get; set; }
        public DbSet<ComplaintCategory> ComplaintCategories { get; set; }
        public DbSet<Ticket>            Tickets             { get; set; }
        public DbSet<TicketUpdate>      TicketUpdates       { get; set; }
        public DbSet<EscalationHistory> EscalationHistories { get; set; }
        public DbSet<Notification>      Notifications       { get; set; }
        public DbSet<AuditLog>          AuditLogs           { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ── departments ──────────────────────────────────────────────────────
            modelBuilder.Entity<Department>(entity =>
            {
                entity.HasIndex(e => e.Name).IsUnique();

                // Circular FK: departments.hod_user_id → users.id
                // Must explicitly set delete behavior to avoid cycles
                entity.HasOne(d => d.Hod)
                      .WithMany()
                      .HasForeignKey(d => d.HodUserId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // ── users ────────────────────────────────────────────────────────────
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(e => e.Email).IsUnique();
                entity.HasIndex(e => e.Role);
                entity.HasIndex(e => e.RollNo)
                      .HasFilter("[roll_no] IS NOT NULL");

                entity.HasOne(u => u.Department)
                      .WithMany(d => d.Users)
                      .HasForeignKey(u => u.DepartmentId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // ── locations ────────────────────────────────────────────────────────
            modelBuilder.Entity<Location>(entity =>
            {
                entity.HasIndex(e => e.Name).IsUnique();

                entity.HasOne(l => l.Department)
                      .WithMany(d => d.Locations)
                      .HasForeignKey(l => l.DepartmentId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // ── qr_codes ─────────────────────────────────────────────────────────
            modelBuilder.Entity<QrCode>(entity =>
            {
                entity.HasIndex(e => e.QrToken).IsUnique();

                entity.HasOne(q => q.Location)
                      .WithMany(l => l.QrCodes)
                      .HasForeignKey(q => q.LocationId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── complaint_categories ─────────────────────────────────────────────
            modelBuilder.Entity<ComplaintCategory>(entity =>
            {
                entity.HasIndex(e => e.Name).IsUnique();
            });

            // ── tickets ──────────────────────────────────────────────────────────
            modelBuilder.Entity<Ticket>(entity =>
            {
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.CreatorId);
                entity.HasIndex(e => e.LocationId);
                entity.HasIndex(e => new { e.EscalationLevel, e.Status });

                entity.HasOne(t => t.Creator)
                      .WithMany(u => u.CreatedTickets)
                      .HasForeignKey(t => t.CreatorId)
                      .OnDelete(DeleteBehavior.Restrict);   // Don't delete tickets when user deleted

                entity.HasOne(t => t.Location)
                      .WithMany(l => l.Tickets)
                      .HasForeignKey(t => t.LocationId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(t => t.Category)
                      .WithMany(c => c.Tickets)
                      .HasForeignKey(t => t.CategoryId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            // ── ticket_updates ───────────────────────────────────────────────────
            modelBuilder.Entity<TicketUpdate>(entity =>
            {
                entity.HasIndex(e => e.TicketId);

                entity.HasOne(tu => tu.Ticket)
                      .WithMany(t => t.Updates)
                      .HasForeignKey(tu => tu.TicketId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── escalation_history ───────────────────────────────────────────────
            modelBuilder.Entity<EscalationHistory>(entity =>
            {
                entity.HasIndex(e => e.TicketId);

                entity.HasOne(eh => eh.Ticket)
                      .WithMany(t => t.EscalationHistory)
                      .HasForeignKey(eh => eh.TicketId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ── notifications ────────────────────────────────────────────────────
            modelBuilder.Entity<Notification>(entity =>
            {
                entity.HasIndex(e => new { e.UserId, e.IsRead });

                entity.HasOne(n => n.User)
                      .WithMany(u => u.Notifications)
                      .HasForeignKey(n => n.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(n => n.Ticket)
                      .WithMany(t => t.Notifications)
                      .HasForeignKey(n => n.TicketId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // ── audit_logs (no navigation, just raw inserts) ─────────────────────
            modelBuilder.Entity<AuditLog>(entity =>
            {
                entity.HasIndex(e => e.CreatedAt);
                entity.HasIndex(e => new { e.EntityType, e.EntityId });
            });
        }
    }
}
