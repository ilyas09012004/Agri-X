import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const userRole = decoded.role;
    const type = req.nextUrl.searchParams.get('type'); // 'all' | 'moderation'
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

    // ✅ Admin bisa filter notifikasi moderation
    let typeCondition = '';
    const params: any[] = [userId];
    
    if (type === 'moderation' && userRole === 'admin') {
      typeCondition = 'AND n.type = ?';
      params.push('moderation');
    }

    const [notifications] = await pool.execute(`
      SELECT 
        n.*,
        u.name as from_user_name,
        u.avatar as from_user_avatar,
        p.title as post_title,
        p.status as post_status
      FROM forum_notifications n
      LEFT JOIN users u ON n.from_user_id = u.id
      LEFT JOIN forum_posts p ON n.post_id = p.id
      WHERE n.user_id = ? ${typeCondition}
      ORDER BY n.is_read ASC, n.created_at DESC
      LIMIT ?
    `, [...params, limit]);

    // Count unread for badge
    const [unreadCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM forum_notifications WHERE user_id = ? AND is_read = FALSE',
      [userId]
    );

    return NextResponse.json({
      success: true,
      notifications: Array.isArray(notifications) ? notifications : [],
      unreadCount: (unreadCount as any)[0]?.count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return handleAPIError(error, 'GET /api/forum/notifications');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const userId = decoded.sub;
    const { notificationId, markAll } = await req.json();

    if (markAll) {
      await pool.execute(
        'UPDATE forum_notifications SET is_read = TRUE WHERE user_id = ?',
        [userId]
      );
    } else if (notificationId) {
      await pool.execute(
        'UPDATE forum_notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    console.error('Error updating notifications:', error);
    return handleAPIError(error, 'PUT /api/forum/notifications');
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded || decoded.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const adminId = decoded.sub;
    const { postId, action, adminNote } = await req.json();

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Invalid action');
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Update post status
    await pool.execute(
      `UPDATE forum_posts 
       SET status = ?, admin_note = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
       WHERE id = ?`,
      [newStatus, adminNote || null, adminId, postId]
    );

    // Get post author for notification
    const [post] = await pool.execute(
      'SELECT user_id, title FROM forum_posts WHERE id = ?',
      [postId]
    );

    if ((post as any[]).length > 0) {
      const authorId = (post as any[])[0].user_id;
      const postTitle = (post as any[])[0].title;
      
      // Create notification for author
      await pool.execute(
        `INSERT INTO forum_notifications 
         (user_id, type, title, message, post_id, from_user_id)
         VALUES (?, 'moderation', ?, ?, ?, ?)`,
        [
          authorId,
          `Post Anda ${action === 'approve' ? 'disetujui' : 'ditolak'}`,
          adminNote || `Admin telah ${action === 'approve' ? 'menyetujui' : 'menolak'} post: "${postTitle.substring(0, 50)}..."`,
          postId,
          adminId
        ]
      );
    }

    return NextResponse.json({
      success: true,
      message: `Post ${action === 'approve' ? 'disetujui' : 'ditolak'}`,
    });
  } catch (error: any) {
    console.error('Error moderating post:', error);
    return handleAPIError(error, 'POST /api/admin/moderation');
  }
}