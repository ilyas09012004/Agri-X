// src/app/api/forum/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

type Params = {
  params: Promise<{ id: string }>;
};

// ✅ Helper: Validasi URL gambar external
function isValidImageUrl(url: string | null): boolean {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const allowedDomains = [
      'images.unsplash.com',
      'images.pexels.com',
      'cdn.pixabay.com',
      'encrypted-tbn0.gstatic.com',
      'lh3.googleusercontent.com',
      'i.imgur.com',
      'i.ibb.co',
    ];
    return parsed.protocol === 'https:' && 
           allowedDomains.some(domain => parsed.hostname.includes(domain));
  } catch {
    return false;
  }
}

// ============================================================================
// GET: Fetch single forum post by ID
// ============================================================================
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // ✅ Query post data (TANPA kolom image - images diambil dari tabel terpisah)
    const [posts] = await pool.execute(`
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
      WHERE p.id = ? AND p.is_deleted = FALSE
    `, [id]);

    if ((posts as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Post tidak ditemukan' },
        { status: 404 }
      );
    }

    const post = (posts as any[])[0];

    // ✅ ✅ FIX: Fetch images dari tabel forum_post_images (multiple images support)
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
      [id]
    );

    // Get comments
    const [comments] = await pool.execute(`
      SELECT 
        c.*,
        u.name as author_name,
        u.avatar as author_avatar,
        (SELECT COUNT(*) FROM forum_likes WHERE comment_id = c.id) as like_count
      FROM forum_comments c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? AND c.is_deleted = FALSE
      ORDER BY c.created_at ASC
    `, [id]);

    // Increment view count
    await pool.execute(
      'UPDATE forum_posts SET views = views + 1 WHERE id = ?',
      [id]
    );

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        // ✅ Images array dari tabel forum_post_images
        images: Array.isArray(images) ? images : [],
        comments: Array.isArray(comments) ? comments : [],
      },
    });

  } catch (error: any) {
    console.error('Error fetching post:', error);
    return handleAPIError(error, 'GET /api/forum/posts/[id]');
  }
}

// ============================================================================
// PUT: Update forum post (dengan multiple images support)
// ============================================================================
export async function PUT(req: NextRequest, { params }: Params) {
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
    const { id } = await params;
    const { title, content, categoryId, images } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title dan content wajib diisi' },
        { status: 400 }
      );
    }

    // ✅ Validasi images jika ada (max 5, format object dengan url)
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
        if (img.url && !isValidImageUrl(img.url)) {
          return NextResponse.json(
            { success: false, error: 'URL gambar tidak valid. Gunakan link dari sumber terpercaya.' },
            { status: 400 }
          );
        }
      }
    }

    // Check ownership
    const [posts] = await pool.execute(
      'SELECT user_id, category_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if ((posts as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Post tidak ditemukan' },
        { status: 404 }
      );
    }

    const post = (posts as any[])[0];
    if (post.user_id !== parseInt(userId) && decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki izin untuk mengedit post ini' },
        { status: 403 }
      );
    }

    // ✅ Update post basic fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    if (title !== undefined) { updateFields.push('title = ?'); updateValues.push(title.trim()); }
    if (content !== undefined) { updateFields.push('content = ?'); updateValues.push(content.trim()); }
    if (categoryId !== undefined) { updateFields.push('category_id = ?'); updateValues.push(categoryId); }
    updateFields.push('updated_at = CURRENT_TIMESTAMP(3)');
    updateValues.push(id);

    const [result] = await pool.execute(
      `UPDATE forum_posts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Post not found or could not be updated' },
        { status: 404 }
      );
    }

    // ✅ ✅ FIX: Handle images update di tabel forum_post_images
    if (images !== undefined && Array.isArray(images)) {
      // 1. Hapus semua images lama untuk post ini (cascade delete)
      await pool.execute(
        'DELETE FROM forum_post_images WHERE post_id = ?',
        [id]
      );

      // 2. Insert images baru (jika ada)
      if (images.length > 0) {
        const imageValues = images.map((img: any, index: number) => [
          id,                                    // post_id
          img.url?.trim(),                      // image_url (wajib)
          img.alt?.trim() || null,              // image_alt (opsional)
          img.source || 'google',               // image_source (default: google)
          null,                                 // file_size (null untuk external URL)
          null,                                 // mime_type (null untuk external URL)
          index,                                // display_order (0, 1, 2...)
          index === 0 ? true : false,           // is_primary (gambar pertama = primary)
        ]);
        
        await pool.execute(
          `INSERT INTO forum_post_images (
            post_id, image_url, image_alt, image_source,
            file_size, mime_type, display_order, is_primary
          ) VALUES ?`,
          [imageValues]
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Post berhasil diupdate',
    });

  } catch (error: any) {
    console.error('Error updating post:', error);
    return handleAPIError(error, 'PUT /api/forum/posts/[id]');
  }
}

// ============================================================================
// DELETE: Soft delete forum post + cascade delete images
// ============================================================================
export async function DELETE(req: NextRequest, { params }: Params) {
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
    const { id } = await params;

    // Check ownership
    const [posts] = await pool.execute(
      'SELECT user_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if ((posts as any[]).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Post tidak ditemukan' },
        { status: 404 }
      );
    }

    const post = (posts as any[])[0];
    if (post.user_id !== parseInt(userId) && decoded.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Anda tidak memiliki izin untuk menghapus post ini' },
        { status: 403 }
      );
    }

    // ✅ Soft delete post (images akan terhapus otomatis via FOREIGN KEY CASCADE)
    await pool.execute(
      'UPDATE forum_posts SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
      [id]
    );

    // ✅ Optional: Jika ada gambar lokal (bukan external URL), hapus file dari server
    const [localImages] = await pool.execute(
      'SELECT image_url FROM forum_post_images WHERE post_id = ? AND image_source = \'upload\'',
      [id]
    );
    
    for (const img of (localImages as any[])) {
      try {
        const filename = img.image_url.split('/').pop();
        if (filename) {
          const filepath = join(process.cwd(), 'public', 'uploads', 'forum', filename);
          if (existsSync(filepath)) {
            await unlink(filepath);
          }
        }
      } catch (err) {
        console.error('Error deleting local image file:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Post berhasil dihapus',
    });

  } catch (error: any) {
    console.error('Error deleting post:', error);
    return handleAPIError(error, 'DELETE /api/forum/posts/[id]');
  }
}