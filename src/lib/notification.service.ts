// src/lib/notification.service.ts
// src/lib/notification.service.ts
import pool from './db';

export interface NotificationData {
  userId: number;
  senderId?: number;
  type: 'order' | 'payment' | 'forum' | 'system' | 'promo';
  templateCode: string;
  variables: Record<string, string | number>;
  customLink?: string;
  imageUrl?: string;
  actionType?: string;
  referenceId?: string;
}

// src/lib/notification.service.ts - verify this part
export class NotificationService {
  static async send(data: NotificationData) {
    try {
      // 1. Get template
      const [templates] = await pool.execute(
        'SELECT * FROM notification_templates WHERE code = ? AND is_active = TRUE',
        [data.templateCode]
      );
      
      const template = (templates as any[])[0];
      if (!template) {
        // ✅ Throw clear error if template not found
        throw new Error(`Notification template not found: ${data.templateCode}`);
      }

      // 2. Replace placeholders
      const title = this.replacePlaceholders(template.title_template, data.variables);
      const message = this.replacePlaceholders(template.message_template, data.variables);
      const link = data.customLink || this.replacePlaceholders(template.link_pattern || '', data.variables);

      // 3. Insert notification
      const [result] = await pool.execute(
        `INSERT INTO notifications (
          user_id, sender_id, title, message, type, link, 
          action_type, reference_id, image_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))`,
        [
          data.userId,
          data.senderId || null,
          title,
          message,
          data.type,
          link || null,
          data.actionType || null,
          data.referenceId || null,
          data.imageUrl || null,
        ]
      );

      return { success: true, notificationId: (result as any).insertId };
      
    } catch (error: any) {
      console.error('Send notification error:', {
        templateCode: data.templateCode,
        variables: data.variables,
        error: error.message,
      });
      throw error;
    }
  }

  // ✅ Helper: Replace {{placeholder}} with values
  private static replacePlaceholders(template: string, variables: Record<string, string | number>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      // Replace ALL occurrences of {{key}} (case-sensitive)
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * ✅ Get unread count untuk user
   */
  static async getUnreadCount(userId: number): Promise<number> {
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND reading = FALSE AND is_deleted = FALSE',
      [userId]
    );
    return (result as any)[0]?.count || 0;
  }

  /**
   * ✅ Mark notification as read
   */
  static async markAsRead(userId: number, notificationId?: number) {
    if (notificationId) {
      await pool.execute(
        'UPDATE notifications SET reading = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
    } else {
      // Mark all as read
      await pool.execute(
        'UPDATE notifications SET reading = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND is_deleted = FALSE',
        [userId]
      );
    }
  }
}