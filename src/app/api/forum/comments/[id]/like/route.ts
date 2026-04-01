import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
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
    const { id } = await params;

    // Check if already liked
    const [existingLike] = await pool.execute(
      'SELECT * FROM forum_likes WHERE user_id = ? AND comment_id = ?',
      [userId, id]
    );

    if ((existingLike as any[]).length > 0) {
      // Unlike
      await pool.execute(
        'DELETE FROM forum_likes WHERE user_id = ? AND comment_id = ?',
        [userId, id]
      );
      await pool.execute(
        'UPDATE forum_comments SET likes = likes - 1 WHERE id = ?',
        [id]
      );

      return NextResponse.json({
        success: true,
        liked: false,
        message: 'Like dihapus',
      });
    } else {
      // Like
      await pool.execute(
        'INSERT INTO forum_likes (user_id, comment_id) VALUES (?, ?)',
        [userId, id]
      );
      await pool.execute(
        'UPDATE forum_comments SET likes = likes + 1 WHERE id = ?',
        [id]
      );

      return NextResponse.json({
        success: true,
        liked: true,
        message: 'Komentar disukai',
      });
    }
  } catch (error: any) {
    console.error('Error liking comment:', error);
    return handleAPIError(error, 'POST /api/forum/comments/[id]/like');
  }
}