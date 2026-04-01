import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

export async function POST(req: NextRequest) {
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
    const { postId, content, parentId } = await req.json();

    if (!postId || !content) {
      throw new Error('Post ID and content are required');
    }

    if (content.length < 1) {
      throw new Error('Komentar tidak boleh kosong');
    }

    // Check if post exists
    const [posts] = await pool.execute(
      'SELECT id, user_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [postId]
    );

    if ((posts as any[]).length === 0) {
      throw new Error('Post tidak ditemukan');
    }

    const post = (posts as any[])[0];

    // Insert comment
    const [result] = await pool.execute(
      `INSERT INTO forum_comments (post_id, user_id, content, parent_id)
       VALUES (?, ?, ?, ?)`,
      [postId, userId, content, parentId || null]
    );

    const commentId = (result as any).insertId;

    // Update comment count
    await pool.execute(
      'UPDATE forum_posts SET comments_count = comments_count + 1 WHERE id = ?',
      [postId]
    );

    // Create notification for post author (if not self)
    if (post.user_id !== parseInt(userId)) {
      await pool.execute(
        `INSERT INTO forum_notifications (user_id, type, title, message, post_id, comment_id, from_user_id)
         VALUES (?, 'comment', 'Komentar baru pada post Anda', 'Someone commented on your post', ?, ?, ?)`,
        [post.user_id, postId, commentId, userId]
      );
    }

    return NextResponse.json({
      success: true,
      commentId,
      message: 'Komentar berhasil ditambahkan',
    });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return handleAPIError(error, 'POST /api/forum/comments');
  }
}

export async function DELETE(req: NextRequest) {
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
    const { commentId } = await req.json();

    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    // Check if user owns the comment
    const [comments] = await pool.execute(
      'SELECT user_id FROM forum_comments WHERE id = ?',
      [commentId]
    );

    if ((comments as any[]).length === 0) {
      throw new Error('Komentar tidak ditemukan');
    }

    const comment = (comments as any[])[0];

    if (comment.user_id !== parseInt(userId)) {
      throw new Error('Anda tidak memiliki izin untuk menghapus komentar ini');
    }

    // Soft delete
    await pool.execute(
      'UPDATE forum_comments SET is_deleted = TRUE WHERE id = ?',
      [commentId]
    );

    // Update comment count
    const [post] = await pool.execute(
      'SELECT post_id FROM forum_comments WHERE id = ?',
      [commentId]
    );
    
    if ((post as any[]).length > 0) {
      await pool.execute(
        'UPDATE forum_posts SET comments_count = comments_count - 1 WHERE id = ?',
        [(post as any[])[0].post_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Komentar berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return handleAPIError(error, 'DELETE /api/forum/comments');
  }
}