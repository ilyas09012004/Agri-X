import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const commentId = resolvedParams.id;

    if (!commentId || isNaN(Number(commentId))) {
      return NextResponse.json({ success: false, error: 'Invalid Comment ID' }, { status: 400 });
    }

    // Verifikasi Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = verifyAccessToken(token);
    if (!decoded || !decoded.sub) {
       return NextResponse.json({ success: false, error: 'Invalid Token' }, { status: 401 });
    }

    // Cek body untuk action (like/unlike)
    const body = await req.json();
    const action = body.action || 'like'; // default 'like'

    let sql = '';
    if (action === 'unlike') {
      // Pastikan tidak minus
      sql = `UPDATE forum_comments SET likes = GREATEST(likes - 1, 0) WHERE id = ?`;
    } else {
      sql = `UPDATE forum_comments SET likes = likes + 1 WHERE id = ?`;
    }

    await pool.execute(sql, [commentId]);

    // Ambil data terbaru
    const [rows]: any = await pool.execute(
      `SELECT likes FROM forum_comments WHERE id = ?`,
      [commentId]
    );

    const newLikeCount = rows[0]?.likes || 0;

    return NextResponse.json({
      success: true,
      like_count: newLikeCount,
      message: action === 'unlike' ? 'Unliked' : 'Liked'
    });

  } catch (error: any) {
    console.error('Like comment error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}