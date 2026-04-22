// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

// ✅ GET: Fetch notifications for authenticated user
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const onlyUnread = searchParams.get('unread') === 'true';

    // ✅ BUILD QUERY
    let query = `
      SELECT 
        n.id, 
        n.user_id, 
        n.sender_id,
        n.title, 
        n.message, 
        n.type, 
        n.reading,
        n.link,
        n.image_url,
        n.action_type,
        n.reference_id,
        n.created_at,
        u.name as sender_name,
        u.avatar as sender_avatar
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.user_id = ? AND n.is_deleted = FALSE
    `;
    
    const params: any[] = [userId];
    
    // ✅ Filter hanya unread jika requested
    if (onlyUnread) {
      query += ' AND n.reading = FALSE';
    }
    
    query += ' ORDER BY n.created_at DESC LIMIT ?';
    params.push(limit);

    const [notifications] = await pool.execute(query, params);

    // ✅ Format response
    const formattedNotifications = (Array.isArray(notifications) ? notifications : []).map((n: any) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      reading: Boolean(n.reading),
      senderId: n.sender_id,
      senderName: n.sender_name,
      senderAvatar: n.sender_avatar,
      link: n.link,
      imageUrl: n.image_url,
      actionType: n.action_type,
      referenceId: n.reference_id,
      createdAt: n.created_at,
    }));

    // ✅ Hitung unread count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND reading = FALSE AND is_deleted = FALSE',
      [userId]
    );
    const unreadCount = (countResult as any)[0]?.unread_count || 0;

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      meta: {
        total: formattedNotifications.length,
        unreadCount,
        limit,
      },
    });

  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return handleAPIError(error, 'GET /api/notifications');
  }
}

// ✅ PATCH: Update notification reading status
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { id, reading, all } = await req.json();

    // ✅ CASE 1: Update single notification reading status
    if (id && reading !== undefined) {
      // Verify ownership
      const [check] = await pool.execute(
        'SELECT id FROM notifications WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
        [id, userId]
      );
      
      if ((check as any[]).length === 0) {
        return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
      }

      await pool.execute(
        'UPDATE notifications SET reading = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [reading ? 1 : 0, id]
      );

      return NextResponse.json({
        success: true,
        message: `Notification marked as ${reading ? 'read' : 'unread'}`,
      });
    }

    // ✅ CASE 2: Mark ALL notifications as read
    if (all === true) {
      await pool.execute(
        'UPDATE notifications SET reading = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND is_deleted = FALSE',
        [userId]
      );

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });

  } catch (error: any) {
    console.error('Error updating notification:', error);
    return handleAPIError(error, 'PATCH /api/notifications');
  }
}

// ✅ DELETE: Soft delete notification
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { id, all } = await req.json();

    // ✅ CASE 1: Delete single notification
    if (id) {
      const [check] = await pool.execute(
        'SELECT id FROM notifications WHERE id = ? AND user_id = ? AND is_deleted = FALSE',
        [id, userId]
      );
      
      if ((check as any[]).length === 0) {
        return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
      }

      await pool.execute(
        'UPDATE notifications SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
        [id]
      );

      return NextResponse.json({ success: true, message: 'Notification deleted' });
    }

    // ✅ CASE 2: Clear all notifications
    if (all === true) {
      await pool.execute(
        'UPDATE notifications SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE user_id = ?',
        [userId]
      );

      return NextResponse.json({ success: true, message: 'All notifications cleared' });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });

  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return handleAPIError(error, 'DELETE /api/notifications');
  }
}