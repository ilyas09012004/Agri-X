// src/app/api/forum/posts/route.ts
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
    const userId = searchParams.get('userId');

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
    let statusCondition = 'p.status = \'approved\'';
    const statusParams: any[] = [];
    
    if (currentUser) {
      if (currentUser.role === 'admin') {
        statusCondition = 'p.is_deleted = FALSE';
      } else if (userId && userId === currentUser.id) {
        statusCondition = '(p.status = \'approved\' OR p.user_id = ?)';
        statusParams.push(currentUser.id);
      } else {
        statusCondition = 'p.status = \'approved\'';
      }
    }

    // ✅ ✅ FIX: BUILD MAIN QUERY dengan normalisasi is_pinned
    // ✅ Gunakan CASE WHEN atau COALESCE untuk pastikan boolean
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
        -- ✅ NORMALISASI: Pastikan is_pinned selalu boolean (0/1 → false/true)
        CASE WHEN p.is_pinned = 1 THEN TRUE ELSE FALSE END as is_pinned,
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

    // ✅ FILTER BY SEARCH
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

    // ✅ ✅ FIX: FETCH IMAGES dari tabel forum_post_images
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
        
        // ✅ DOUBLE GUARANTEE: Pastikan is_pinned boolean di JS level juga
        return {
          ...post,
          is_pinned: Boolean(post.is_pinned),  // ✅ Convert 0/1/null → false/true
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
// POST: Create new forum post (dengan multiple images support)
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.sub;
    const { title, content, categoryId, images } = await req.json();

    // ✅ Validasi required fields
    if (!title?.trim() || !content?.trim() || !categoryId) {
      return NextResponse.json(
        { success: false, error: 'Title, content, dan category wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ Validasi images jika ada (max 5)
    if (images && Array.isArray(images)) {
      if (images.length > 5) {
        return NextResponse.json(
          { success: false, error: 'Maksimal 5 gambar per post' },
          { status: 400 }
        );
      }
      for (const img of images) {
        if (!img.url || typeof img.url !== 'string' || !img.url.trim()) {
          return NextResponse.json(
            { success: false, error: 'Setiap gambar harus memiliki URL yang valid' },
            { status: 400 }
          );
        }
      }
    }

    // ✅ Insert post ke forum_posts
    const [result] = await pool.execute(
      `INSERT INTO forum_posts (
        user_id, category_id, title, content,
        status, is_pinned, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'pending', FALSE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
      [userId, categoryId, title.trim(), content.trim()]
    );

    const postId = (result as any).insertId;

    // ✅ Insert images ke tabel forum_post_images
    if (images && Array.isArray(images) && images.length > 0) {
      const imageValues = images.map((img: any, index: number) => [
        postId,
        img.url?.trim(),
        img.alt?.trim() || null,
        img.source || 'google',
        null,  // file_size
        null,  // mime_type
        index, // display_order
        index === 0, // is_primary
      ]);
      
      await pool.execute(
        `INSERT INTO forum_post_images (
          post_id, image_url, image_alt, image_source,
          file_size, mime_type, display_order, is_primary
        ) VALUES ?`,
        [imageValues]
      );
    }

    // ✅ Update category post count
    await pool.execute(
      'UPDATE forum_categories SET post_count = post_count + 1 WHERE id = ?',
      [categoryId]
    );

    return NextResponse.json({
      success: true,
      postId,
      message: 'Diskusi berhasil dibuat dan menunggu persetujuan admin',
    });

  } catch (error: any) {
    console.error('Error creating post:', error);
    return handleAPIError(error, 'POST /api/forum/posts');
  }
}