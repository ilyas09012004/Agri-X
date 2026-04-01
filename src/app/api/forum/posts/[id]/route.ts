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

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [posts] = await pool.execute(`
      SELECT 
        p.*,
        u.name as author_name,
        u.avatar as author_avatar,
        c.name as category_name,
        c.slug as category_slug,
        c.icon as category_icon
      FROM forum_posts p
      INNER JOIN users u ON p.user_id = u.id
      INNER JOIN forum_categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.is_deleted = FALSE
    `, [id]);

    if ((posts as any[]).length === 0) {
      throw new Error('Post tidak ditemukan');
    }

    const post = (posts as any[])[0];

    // Get images
    const [images] = await pool.execute(
      'SELECT id, image_url FROM forum_post_images WHERE post_id = ?',
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
        images: Array.isArray(images) ? images : [],
        comments: Array.isArray(comments) ? comments : [],
      },
    });
  } catch (error: any) {
    console.error('Error fetching post:', error);
    return handleAPIError(error, 'GET /api/forum/posts/[id]');
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
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
    const { title, content, categoryId, images } = await req.json();

    if (!title || !content) {
      throw new Error('Title and content are required');
    }

    // Check ownership
    const [posts] = await pool.execute(
      'SELECT user_id, category_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if ((posts as any[]).length === 0) {
      throw new Error('Post tidak ditemukan');
    }

    const post = (posts as any[])[0];
    if (post.user_id !== parseInt(userId)) {
      throw new Error('Anda tidak memiliki izin untuk mengedit post ini');
    }

    // Update post basic fields
    await pool.execute(
      `UPDATE forum_posts 
       SET title = ?, content = ?, category_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [title, content, categoryId || post.category_id, id]
    );

    // ✅ Handle images update - FIXED SQL SYNTAX
    if (images !== undefined && Array.isArray(images)) {
      // Get current images from DB
      const [currentImages] = await pool.execute(
        'SELECT id, image_url FROM forum_post_images WHERE post_id = ?',
        [id]
      );

      const currentImageUrls = (currentImages as any[]).map((img: any) => img.image_url);
      
      // Find images to delete (in DB but not in new array)
      const imagesToDelete = currentImageUrls.filter((url: string) => !images.includes(url));
      
      // Find images to add (in new array but not in DB)
      const imagesToAdd = images.filter((url: string) => !currentImageUrls.includes(url));

      // ✅ Delete removed images from DB (one by one or with IN clause)
      if (imagesToDelete.length > 0) {
        // Option 1: Delete one by one (safest)
        for (const imageUrl of imagesToDelete) {
          await pool.execute(
            'DELETE FROM forum_post_images WHERE post_id = ? AND image_url = ?',
            [id, imageUrl]
          );
          
          // Optional: Delete file from disk
          try {
            const filename = imageUrl.split('/').pop();
            if (filename) {
              const filepath = join(process.cwd(), 'public', 'uploads', 'forum', filename);
              if (existsSync(filepath)) {
                await unlink(filepath);
              }
            }
          } catch (err) {
            console.error('Error deleting image file:', err);
          }
        }
      }

      // ✅ Insert new images - FIXED: Use loop instead of bulk insert
      if (imagesToAdd.length > 0) {
        for (const imageUrl of imagesToAdd) {
          await pool.execute(
            'INSERT INTO forum_post_images (post_id, image_url) VALUES (?, ?)',
            [id, imageUrl]
          );
        }
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

export async function DELETE(req: NextRequest, { params }: Params) {
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

    // Check ownership
    const [posts] = await pool.execute(
      'SELECT user_id FROM forum_posts WHERE id = ? AND is_deleted = FALSE',
      [id]
    );

    if ((posts as any[]).length === 0) {
      throw new Error('Post tidak ditemukan');
    }

    const post = (posts as any[])[0];
    if (post.user_id !== parseInt(userId)) {
      throw new Error('Anda tidak memiliki izin untuk menghapus post ini');
    }

    // Get images before deleting (to delete files from disk)
    const [images] = await pool.execute(
      'SELECT image_url FROM forum_post_images WHERE post_id = ?',
      [id]
    );

    // Soft delete post (images will be cascade deleted)
    await pool.execute(
      'UPDATE forum_posts SET is_deleted = TRUE WHERE id = ?',
      [id]
    );

    // Optional: Delete image files from disk
    try {
      for (const img of (images as any[])) {
        const filename = img.image_url.split('/').pop();
        if (filename) {
          const filepath = join(process.cwd(), 'public', 'uploads', 'forum', filename);
          if (existsSync(filepath)) {
            await unlink(filepath);
          }
        }
      }
    } catch (err) {
      console.error('Error deleting image files:', err);
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