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
    const { postId, commentId, reason } = await req.json();

    if (!reason || reason.length < 10) {
      throw new Error('Alasan report minimal 10 karakter');
    }

    if (!postId && !commentId) {
      throw new Error('Post ID or Comment ID is required');
    }

    await pool.execute(
      `INSERT INTO forum_reports (reporter_id, post_id, comment_id, reason, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, postId || null, commentId || null, reason]
    );

    return NextResponse.json({
      success: true,
      message: 'Report berhasil dikirim',
    });
  } catch (error: any) {
    console.error('Error creating report:', error);
    return handleAPIError(error, 'POST /api/forum/report');
  }
}