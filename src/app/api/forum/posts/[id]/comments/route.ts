import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db'; // Pastikan path ini benar

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const resolvedParams = await params;
    const postId = resolvedParams.id;

    if (!postId || isNaN(Number(postId))) {
      return NextResponse.json({ success: false, error: 'Invalid Post ID' }, { status: 400 });
    }

    let comments = [];

    try {
      // ✅ QUERY DISesuaikan dengan Struktur Tabel Kamu
      // JOIN ke tabel 'users' untuk ambil nama & avatar
      // Filter status = 'approved' dan is_deleted = 0
      const [rows]: any = await pool.execute(`
        SELECT 
          c.id,
          c.content,
          c.created_at,
          c.parent_id,
          c.likes as like_count, -- Map kolom 'likes' jadi 'like_count' agar konsisten di frontend
          u.name as user_name,    -- Ambil dari tabel users
          u.avatar as user_avatar -- Ambil dari tabel users
        FROM forum_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? 
          AND c.status = 'approved' 
          AND c.is_deleted = 0
        ORDER BY c.created_at ASC
      `, [postId]);

      // Transform flat data to nested tree structure (untuk reply bertingkat)
      const commentsMap = new Map();
      const rootComments = [];

      rows.forEach((row: any) => {
        // Format tanggal jika perlu, atau biarkan ISO string
        commentsMap.set(row.id, { 
          ...row, 
          replies: [],
          // Default value jika avatar null
          user_avatar: row.user_avatar || null 
        });
      });

      rows.forEach((row: any) => {
        if (row.parent_id) {
          const parent = commentsMap.get(row.parent_id);
          if (parent) {
            parent.replies.push(commentsMap.get(row.id));
          }
        } else {
          rootComments.push(commentsMap.get(row.id));
        }
      });

      comments = rootComments;

    } catch (dbError: any) {
      console.error('Database Error:', dbError.message);
      // Jika tabel users tidak ada atau kolom berbeda, handle errornya
      if (dbError.code === 'ER_NO_SUCH_TABLE' || dbError.code === 'ER_BAD_FIELD_ERROR') {
         // Fallback: Return empty array agar UI tidak crash, tapi log error
         console.warn('Schema mismatch or missing table. Returning empty comments.');
         comments = [];
      } else {
        throw dbError;
      }
    }

    return NextResponse.json({
      success: true,
      comments: comments,
    });

  } catch (error: any) {
    console.error('Get comments API Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}