import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';

// ============================================================================
// GET: Fetch forum posts dengan filter status & pagination
// ============================================================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'newest';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const userId = searchParams.get('userId'); // Untuk fetch post user tertentu

    // ✅ Ambil info user dari token untuk permission check
    const authHeader = req.headers.get('Authorization');
    let currentUser: { id: string; role: string } | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = verifyAccessToken(token);
      if (decoded) {
        currentUser = { id: decoded.sub, role: decoded.role };
      }
    }

    // ✅ BUILD STATUS CONDITION
    // - Public: hanya lihat post 'approved'
    // - Authenticated user: lihat approved + post sendiri (semua status)
    // - Admin: bisa lihat semua (opsional, untuk dashboard)
    let statusCondition = 'p.status = \'approved\'';
    const statusParams: any[] = [];
    
    if (currentUser) {
      if (currentUser.role === 'admin') {
        // Admin bisa lihat semua status (untuk moderation)
        statusCondition = 'p.is_deleted = FALSE';
      } else if (userId && userId === currentUser.id) {
        // User melihat post sendiri: approved + pending + rejected
        statusCondition = '(p.status = \'approved\' OR p.user_id = ?)';
        statusParams.push(currentUser.id);
      } else {
        // User melihat forum umum: hanya approved
        statusCondition = 'p.status = \'approved\'';
      }
    }

    // ✅ BUILD MAIN QUERY
    let query = `
      SELECT 
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
        p.created_at,
        p.updated_at,
        u.name as author_name,
        u.avatar as author_avatar,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id AND is_deleted = FALSE) as comment_count
      FROM forum_posts p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.is_deleted = FALSE AND ${statusCondition}
    `;

    const params: any[] = [...statusParams];

    // ✅ FILTER BY CATEGORY
    if (category && category !== 'all') {
      query += ' AND c.slug = ?';
      params.push(category);
    }

    // ✅ FILTER BY SEARCH (title or content)
    if (search) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // ✅ SORTING
    if (sort === 'popular') {
      query += ' ORDER BY p.likes DESC, p.created_at DESC';
    } else if (sort === 'comments') {
      query += ' ORDER BY p.comments_count DESC, p.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY p.created_at ASC';
    } else {
      // Default: newest, dengan pinned posts di atas
      query += ' ORDER BY p.is_pinned DESC, p.created_at DESC';
    }

    // ✅ PAGINATION
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // ✅ EXECUTE QUERY
    const [posts] = await pool.execute(query, params);

    // ✅ GET TOTAL COUNT FOR PAGINATION
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM forum_posts p
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.is_deleted = FALSE AND ${statusCondition}
    `;
    const countParams: any[] = [...statusParams];
    
    if (category && category !== 'all') {
      countQuery += ' AND c.slug = ?';
      countParams.push(category);
    }
    if (search) {
      countQuery += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = (countResult as any)[0]?.total || 0;

    // ✅ FETCH IMAGES FOR EACH POST (optimization: could use JOIN but keeping simple)
    const postsWithImages = await Promise.all(
      (Array.isArray(posts) ? posts : []).map(async (post: any) => {
        const [images] = await pool.execute(
          'SELECT id, image_url, file_name FROM forum_post_images WHERE post_id = ? ORDER BY id ASC',
          [post.id]
        );
        return {
          ...post,
          images: Array.isArray(images) ? images : [],
        };
      })
    );

    return NextResponse.json({
      success: true,
      posts: postsWithImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1,
      },
    });

  } catch (error: any) {
    console.error('Error fetching posts:', error);
    return handleAPIError(error, 'GET /api/forum/posts');
  }
}

// ============================================================================
// POST: Create new forum post (default status: pending)
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    // ... (auth dan validasi tetap sama)

    const userId = decoded.sub;
    const { title, content, categoryId, images } = await req.json();

    // ... (validasi title, content, categoryId tetap sama)

    // Insert post
    const [result] = await pool.execute(
      `INSERT INTO forum_posts (user_id, category_id, title, content)
       VALUES (?, ?, ?, ?)`,
      [userId, categoryId, title, content]
    );

    const postId = (result as any).insertId;

    // ✅ Insert images ke database
    if (images && Array.isArray(images) && images.length > 0) {
      const imageValues = images.map((imageUrl: string) => [postId, imageUrl]);
      
      await pool.execute(
        'INSERT INTO forum_post_images (post_id, image_url) VALUES ?',
        [imageValues]
      );
    }

    // Update category post count
    await pool.execute(
      'UPDATE forum_categories SET post_count = post_count + 1 WHERE id = ?',
      [categoryId]
    );

    return NextResponse.json({
      success: true,
      postId,
      message: 'Diskusi berhasil dibuat',
    });

  } catch (error: any) {
    console.error('Error creating post:', error);
    return handleAPIError(error, 'POST /api/forum/posts');
  }
}