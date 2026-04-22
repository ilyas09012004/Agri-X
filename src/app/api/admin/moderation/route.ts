// src/app/api/admin/moderation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';
import { NotificationService } from '@/lib/notification.service';

// ============================================================================
// GET: Fetch pending posts for moderation (dengan images data)
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    // ✅ 1. Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    // ✅ 2. Get query params
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const offset = (page - 1) * limit;

    // ✅ 3. Build status filter
    let statusFilter = 'p.status = ?';
    const statusParams: any[] = [status];

    // ✅ 4. Fetch posts with author & category info
    const [posts] = await pool.execute(
      `SELECT 
        p.id,
        p.user_id,
        p.category_id,
        p.title,
        p.content,
        p.status,
        p.admin_note,
        p.views,
        p.likes,
        p.comments_count,
        p.is_pinned,
        p.is_locked,
        p.is_deleted,
        p.created_at,
        p.updated_at,
        u.id as author_id,
        u.name as author_name,
        u.email as author_email,
        u.avatar as author_avatar,
        c.id as category_id,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM forum_post_images WHERE post_id = p.id) as image_count
      FROM forum_posts p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.is_deleted = FALSE AND ${statusFilter}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...statusParams, limit, offset]
    );

    // ✅ 5. Fetch images untuk setiap post
    const postsWithImages = await Promise.all(
      (Array.isArray(posts) ? posts : []).map(async (post: any) => {
        const [images] = await pool.execute(
          `SELECT 
            id,
            image_url,
            image_alt,
            image_source,
            display_order,
            is_primary,
            created_at
          FROM forum_post_images 
          WHERE post_id = ? 
          ORDER BY display_order ASC, id ASC`,
          [post.id]
        );

        return {
          ...post,
          images: Array.isArray(images) ? images : [],
        };
      })
    );

    // ✅ 6. Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM forum_posts p WHERE p.is_deleted = FALSE AND ${statusFilter}`,
      statusParams
    );
    const total = (countResult as any)[0]?.total || 0;

    // ✅ 7. Format response dengan images
    const formattedPosts = postsWithImages.map((post: any) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      author_name: post.author_name,
      author_email: post.author_email,
      author_avatar: post.author_avatar,
      category_name: post.category_name,
      category_slug: post.category_slug,
      category_icon: post.category_icon,
      status: post.status,
      admin_note: post.admin_note,
      image_count: post.image_count,
      images: post.images,
      comment_count: post.comments_count,
      views: post.views,
      likes: post.likes,
      is_pinned: Boolean(post.is_pinned),
      is_locked: Boolean(post.is_locked),
      created_at: post.created_at,
      updated_at: post.updated_at,
    }));

    return NextResponse.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error: any) {
    console.error('Error fetching moderation posts:', error);
    return handleAPIError(error, 'GET /api/admin/moderation');
  }
}

// ============================================================================
// POST: Approve/Reject post OR Broadcast system announcement
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    // ✅ 1. Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const adminId = decoded.sub;
    const body = await req.json();
    
    // ✅ 2. Route based on action type
    const { action, postId, adminNote, broadcast } = body;

    // ✅ ROUTE A: Broadcast system announcement to all users
    if (broadcast === true) {
      return await handleBroadcastAnnouncement(adminId, body);
    }

    // ✅ ROUTE B: Approve/Reject single post (existing logic)
    return await handleModeratePost(adminId, postId, action, adminNote);

  } catch (error: any) {
    console.error('Error in POST /api/admin/moderation:', error);
    return handleAPIError(error, 'POST /api/admin/moderation');
  }
}

// ============================================================================
// Helper: Handle Broadcast Announcement
// ============================================================================
async function handleBroadcastAnnouncement(adminId: string, body: any) {
  const { title, message, targetAudience, customUserIds, link, imageUrl } = body;

  // ✅ Validation
  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Judul dan pesan wajib diisi' },
      { status: 400 }
    );
  }

  // ✅ Get admin name for sender info
  const [admins] = await pool.execute('SELECT name FROM users WHERE id = ?', [adminId]);
  const admin = (admins as any[])[0];
  const adminName = admin?.name || 'Admin';

  // ✅ Prepare variables for template
  const variables = {
    title: title.trim(),
    message: message.trim(),
    link: link || '',
    admin_name: adminName,
  };

  // ✅ Determine target users based on audience
  let userIds: number[] = [];
  
  if (targetAudience === 'custom' && Array.isArray(customUserIds)) {
    userIds = customUserIds;
  } else {
    let query = 'SELECT id FROM users WHERE 1=1';
    const params: any[] = [];
    
    if (targetAudience === 'active') {
      query += ' AND last_login_at > DATE_SUB(NOW(), INTERVAL 30 DAY)';
    } else if (targetAudience === 'premium') {
      query += ' AND role = "premium"';
    }
    // 'all' = no additional filter
    
    const [users] = await pool.execute(query, params);
    userIds = (users as any[]).map((u: any) => u.id);
  }

  if (userIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Tidak ada user yang memenuhi kriteria target' },
      { status: 400 }
    );
  }

  // ✅ Send notification to each user (batch processing)
  let sentCount = 0;
  let failedCount = 0;
  
  for (const userId of userIds) {
    try {
      await NotificationService.send({
        userId,
        senderId: parseInt(adminId),
        type: 'system',
        templateCode: 'system_announcement',
        variables,
        actionType: 'system_broadcast',
        referenceId: `broadcast_${Date.now()}`,
        customLink: link || undefined,
        imageUrl: imageUrl || undefined,
      });
      sentCount++;
    } catch (error) {
      console.error(`Failed to send to user ${userId}:`, error);
      failedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    message: `Pengumuman berhasil dikirim ke ${sentCount} user`,
    meta: {
      sent: sentCount,
      failed: failedCount,
      targetAudience,
      totalTargets: userIds.length,
    },
  });
}

// ============================================================================
// Helper: Handle Single Post Moderation
// ============================================================================
async function handleModeratePost(adminId: string, postId: number, action: string, adminNote?: string) {
  // ✅ Validation
  if (!postId) {
    return NextResponse.json({ success: false, error: 'Post ID wajib diisi' }, { status: 400 });
  }

  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Action harus "approve" atau "reject"' },
      { status: 400 }
    );
  }

  // ✅ Get post details + author info
  const [posts] = await pool.execute(
    `SELECT 
      p.id, p.user_id, p.title, p.status, p.category_id,
      u.id as author_id,
      u.name as author_name,
      u.email as author_email
    FROM forum_posts p
    INNER JOIN users u ON p.user_id = u.id
    WHERE p.id = ? AND p.is_deleted = FALSE`,
    [postId]
  );

  const post = (posts as any[])[0];
  if (!post) {
    return NextResponse.json({ success: false, error: 'Post tidak ditemukan' }, { status: 404 });
  }

  // ✅ Check if already processed
  if (action === 'approve' && post.status === 'approved') {
    return NextResponse.json({ success: false, error: 'Post sudah disetujui sebelumnya' }, { status: 400 });
  }
  if (action === 'reject' && post.status === 'rejected') {
    return NextResponse.json({ success: false, error: 'Post sudah ditolak sebelumnya' }, { status: 400 });
  }

  // ✅ Update post status
  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  
  await pool.execute(
    `UPDATE forum_posts 
     SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP(3)
     WHERE id = ?`,
    [newStatus, adminNote || null, postId]
  );

  // ✅ Update category post count (only if approved)
  if (action === 'approve') {
    await pool.execute(
      'UPDATE forum_categories SET post_count = post_count + 1 WHERE id = ?',
      [post.category_id]
    );
  }

  // ✅ SEND NOTIFICATION to post author using template
  try {
    const [admins] = await pool.execute('SELECT name FROM users WHERE id = ?', [adminId]);
    const admin = (admins as any[])[0];
    const adminName = admin?.name || 'Admin';

    if (action === 'approve') {
      await NotificationService.send({
        userId: post.user_id,
        senderId: parseInt(adminId),
        type: 'system',
        templateCode: 'forum_post_approved',
        variables: {
          post_title: post.title.substring(0, 100),
          post_id: postId.toString(),
          admin_name: adminName,
          author_name: post.author_name,
        },
        actionType: 'forum_moderation_approved',
        referenceId: postId.toString(),
        customLink: `/forum/${postId}`,
      });
    } else {
      await NotificationService.send({
        userId: post.user_id,
        senderId: parseInt(adminId),
        type: 'system',
        templateCode: 'forum_post_rejected',
        variables: {
          post_title: post.title.substring(0, 100),
          reason: adminNote || 'Tidak memenuhi kriteria komunitas',
          admin_name: adminName,
          author_name: post.author_name,
        },
        actionType: 'forum_moderation_rejected',
        referenceId: postId.toString(),
      });
    }
  } catch (notifError) {
    console.error('Failed to send notification (non-critical):', notifError);
  }

  // ✅ Return success response
  return NextResponse.json({
    success: true,
    message: `Post berhasil ${action === 'approve' ? 'disetujui' : 'ditolak'}`,
    post: {
      id: postId,
      status: newStatus,
      admin_note: adminNote,
    },
  });
}

// ============================================================================
// DELETE: Bulk delete posts (for spam cleanup)
// ============================================================================
export async function DELETE(req: NextRequest) {
  try {
    // ✅ Verify admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { postIds, reason } = await req.json();

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Post IDs required' }, { status: 400 });
    }

    // ✅ Soft delete multiple posts
    const placeholders = postIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE forum_posts 
       SET is_deleted = TRUE, admin_note = ?, updated_at = CURRENT_TIMESTAMP(3)
       WHERE id IN (${placeholders})`,
      [reason || 'Deleted by admin', ...postIds]
    );

    return NextResponse.json({
      success: true,
      message: `${postIds.length} post(s) deleted`,
    });

  } catch (error: any) {
    console.error('Error deleting posts:', error);
    return handleAPIError(error, 'DELETE /api/admin/moderation');
  }
}