import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db'; // Sesuaikan path database Anda
import { verifyAccessToken } from '@/utils/jwt.util'; // Sesuaikan path auth Anda

export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi Token Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = verifyAccessToken(token);
    
    if (!decoded || !decoded.sub) { // Asumsi 'sub' adalah user_id dari JWT
       return NextResponse.json({ success: false, error: 'Invalid Token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { content, post_id, parent_id } = await req.json();

    // Validasi Input
    if (!content || !content.trim()) {
      return NextResponse.json({ success: false, error: 'Konten komentar tidak boleh kosong' }, { status: 400 });
    }
    if (!post_id) {
      return NextResponse.json({ success: false, error: 'Post ID diperlukan' }, { status: 400 });
    }

    // 2. Insert ke Database
    // Status default 'approved', likes default 0, is_deleted default 0
    const [result]: any = await pool.execute(
      `INSERT INTO forum_comments 
       (post_id, user_id, parent_id, content, status, likes, is_deleted, created_at)
       VALUES (?, ?, ?, ?, 'approved', 0, 0, NOW())`,
      [post_id, userId, parent_id || null, content]
    );

    // 3. Ambil data komentar yang baru dibuat untuk direturn (opsional tapi bagus untuk UI)
    const [newCommentRows]: any = await pool.execute(`
      SELECT 
        c.id, c.content, c.created_at, c.parent_id, c.likes as like_count,
        u.name as user_name, u.avatar as user_avatar
      FROM forum_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.insertId]);

    const newComment = newCommentRows[0];

    return NextResponse.json({
      success: true,
      comment: newComment,
      message: 'Komentar berhasil dikirim'
    }, { status: 201 });

  } catch (error: any) {
    console.error('Post comment error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}