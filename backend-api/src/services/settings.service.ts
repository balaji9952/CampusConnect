import prisma from '../utils/prisma';

export class SettingsService {
  static async getSetting(key: string) {
    const record = await prisma.system_settings.findUnique({ where: { key } });
    if (!record) return null;
    try {
      return JSON.parse(record.value);
    } catch (e) {
      return record.value; // Fallback if not strictly JSON
    }
  }

  static async setSetting(key: string, value: any, userId: string, userName: string, userRole: string, description: string) {
    const stringifiedValue = JSON.stringify(value);

    const previous = await prisma.system_settings.findUnique({
      where: { key }
    });

    await prisma.$transaction(async (tx) => {
      await tx.system_settings.upsert({
        where: { key },
        update: {
          value: stringifiedValue,
          updated_by: userId
        },
        create: {
          key,
          value: stringifiedValue,
          updated_by: userId
        }
      });

      await tx.audit_logs.create({
        data: {
          action: 'SETTING_UPDATED',
          entity_type: 'SYSTEM_SETTING',
          entity_id: key,
          user_id: userId,
          user_name: userName || 'Unknown',
          user_role: userRole || 'Unknown',
          old_value: previous ? previous.value : null,
          new_value: stringifiedValue,
          description: description
        }
      });
    });
  }
}
