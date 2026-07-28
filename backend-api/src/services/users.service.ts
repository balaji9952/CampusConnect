import prisma from '../utils/prisma';
import bcrypt from 'bcrypt';
import { getRoleString } from '../utils/auth';

export class UsersService {
  /**
   * Returns the full user profile by ID.
   */
  static async getById(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { departments_users_department_idTodepartments: true },
    });
    if (!user) return null;
    return this.mapToDto(user);
  }

  /**
   * Updates allowed profile fields for a user.
   * Students: name, programType, branch, studyYear, department (by name)
   * Staff:    name, designation
   */
  static async updateProfile(userId: string, data: {
    name?: string;
    programType?: string;
    branch?: string;
    studyYear?: string;
    department?: string;
    designation?: string;
    email?: string;
    rollNo?: string;
  }) {
    if (!data.name && !data.programType && !data.branch && !data.studyYear && !data.department && !data.designation && !data.email && !data.rollNo) {
      throw new Error('Validation error: At least one field must be provided for update');
    }

    // Resolve department name → id if provided
    let departmentId: number | undefined;
    if (data.department) {
      const dept = await prisma.departments.findFirst({
        where: { name: data.department },
        select: { id: true },
      });
      if (dept) departmentId = dept.id;
    }

    const updatePayload: any = {};
    if (data.name)        updatePayload.name         = data.name.trim();
    if (data.programType) updatePayload.program_type = data.programType;
    if (data.branch)      updatePayload.branch       = data.branch;
    if (data.studyYear)   updatePayload.study_year   = data.studyYear;
    if (data.designation) updatePayload.designation  = data.designation;
    if (departmentId)     updatePayload.department_id = departmentId;
    if (data.rollNo)      updatePayload.roll_no      = data.rollNo.trim();
    
    if (data.email) {
      const emailLower = data.email.trim().toLowerCase();
      const existing = await prisma.users.findFirst({
        where: { email: emailLower, id: { not: userId } }
      });
      if (existing) throw new Error('Validation error: Email is already in use by another user');
      updatePayload.email = emailLower;
    }

    updatePayload.updated_at = new Date();

    const updated = await prisma.users.update({
      where: { id: userId },
      data: updatePayload,
      include: { departments_users_department_idTodepartments: true },
    });

    return this.mapToDto(updated);
  }

  /**
   * Updates the user's avatar_url after a successful profile photo upload or removal.
   */
  static async updatePhoto(userId: string, photoUrl: string | null) {
    const updated = await prisma.users.update({
      where: { id: userId },
      data: {
        avatar_url: photoUrl,
        updated_at: new Date(),
      },
      include: { departments_users_department_idTodepartments: true },
    });
    return this.mapToDto(updated);
  }

  /**
   * Changes the user's password.
   */
  static async changePassword(userId: string, currentPassword?: string, newPassword?: string, confirmPassword?: string) {
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error('Validation error: All password fields are required');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Validation error: New passwords do not match');
    }
    if (newPassword === currentPassword) {
      throw new Error('Validation error: New password cannot be the same as current password');
    }
    if (newPassword.length < 6) {
      throw new Error('Validation error: Password must be at least 6 characters long');
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new Error('Invalid current password');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        password_hash: hashedPassword,
        updated_at: new Date(),
      },
    });

    await prisma.audit_logs.create({
      data: {
        user_id: user.id,
        user_name: user.name,
        user_role: getRoleString(user.role),
        action: 'CHANGE_PASSWORD',
        entity_type: 'user',
        entity_id: user.id,
        description: `User changed their password: ${user.email}`,
      },
    });

    return updatedUser;
  }

  static async verifyPassword(userId: string, password: string) {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    return isMatch;
  }

  static async getPreferences(userId: string) {
    let prefs = await prisma.user_notification_preferences.findUnique({
      where: { user_id: userId }
    });
    if (!prefs) {
      prefs = await prisma.user_notification_preferences.create({
        data: { user_id: userId }
      });
    }
    return prefs;
  }

  static async updatePreferences(userId: string, data: any) {
    const updateData: any = {};
    if (typeof data.ticket_assignments === 'boolean') updateData.ticket_assignments = data.ticket_assignments;
    if (typeof data.escalations === 'boolean') updateData.escalations = data.escalations;
    if (typeof data.resolutions === 'boolean') updateData.resolutions = data.resolutions;
    if (typeof data.reminders === 'boolean') updateData.reminders = data.reminders;
    if (typeof data.announcements === 'boolean') updateData.announcements = data.announcements;
    
    updateData.updated_at = new Date();

    return await prisma.user_notification_preferences.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        ...updateData
      }
    });
  }

  static mapToDto(u: any) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: getRoleString(u.role),
      departmentId: u.department_id,
      departmentName: u.departments_users_department_idTodepartments?.name ?? null,
      rollNo: u.roll_no,
      programType: u.program_type,
      branch: u.branch,
      studyYear: u.study_year,
      designation: u.designation,
      avatarUrl: u.avatar_url,
      createdAt: u.created_at,
    };
  }
}
