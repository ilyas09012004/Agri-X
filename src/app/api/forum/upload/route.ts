import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/utils/jwt.util';
import { handleAPIError } from '@/lib/middleware';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: any) {
      if (err.message === 'ACCESS_TOKEN_EXPIRED') {
        return NextResponse.json(
          { success: false, error: 'Token expired', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    // 2. Parse FormData
    const formData = await req.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // 3. Validasi File Type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Format gambar tidak didukung. Gunakan JPG, PNG, WebP, atau GIF',
          code: 'INVALID_FORMAT'
        },
        { status: 400 }
      );
    }

    // 4. Validasi File Size (Max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Ukuran gambar maksimal 5MB',
          code: 'FILE_TOO_LARGE',
          details: { size: file.size, maxSize }
        },
        { status: 400 }
      );
    }

    // 5. Create Upload Directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'forum');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 6. Generate Unique Filename
    const timestamp = Date.now();
    const randomStr = randomUUID().split('-')[0];
    const extension = file.name.split('.').pop() || 'jpg';
    const filename = `forum_${timestamp}_${randomStr}.${extension}`;
    const filepath = join(uploadDir, filename);

    // 7. Save File
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // 8. Generate Public URL
    const imageUrl = `/uploads/forum/${filename}`;

    // 9. Return Response
    return NextResponse.json({
      success: true,
      imageUrl,
      filename,
      size: file.size,
      type: file.type,
      message: 'Image uploaded successfully',
    });

  } catch (error: any) {
    console.error('Error uploading image:', error);
    return handleAPIError(error, 'POST /api/forum/upload');
  }
}

// ✅ Optional: Support multiple file upload
export const config = {
  api: {
    bodyParser: false, // Disable default body parser for FormData
  },
};