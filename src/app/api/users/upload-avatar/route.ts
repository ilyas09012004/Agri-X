import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('avatar') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validasi file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only JPG, PNG, WEBP allowed' },
        { status: 400 }
      );
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size must be less than 2MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `avatar_${decoded.sub}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${fileExtension}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    const filePath = join(uploadDir, fileName);

    // Create directory if not exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Update database
    const avatarUrl = `/uploads/avatars/${fileName}`;
    await pool.execute(
      'UPDATE users SET avatar = ?, updatedAt = NOW() WHERE id = ?',
      [avatarUrl, decoded.sub]
    );

    return NextResponse.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarUrl,
    });

  } catch (error: any) {
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}