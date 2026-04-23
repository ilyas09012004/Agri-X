// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth';
import crypto from 'crypto';
import pool from '@/lib/db';
import { generateTokens } from '@/lib/jwt';
import { serialize } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Ambil user
    const [rows] = await pool.execute(
      'SELECT id, email, password, name, role FROM users WHERE email = ?',
      [email]
    ) as [any[], any];

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(String(user.id), user.role);

    // Hash refresh token untuk disimpan
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Ambil metadata client
    const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Simpan session di DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 hari

    await pool.execute(
      `INSERT INTO user_sessions 
        (user_id, refresh_token_hash, ip_address, user_agent, expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [user.id, refreshToken, ip, userAgent, expiresAt]
    );

    // Set cookies (HANYA accessToken di body, refreshToken HANYA di cookie HttpOnly)
    const headers = new Headers();

    // AccessToken → non-HttpOnly (boleh diakses JS untuk attach ke header API)
    headers.append('Set-Cookie', serialize('accessToken', accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 menit
      path: '/',
    }));

    // RefreshToken → HttpOnly (tidak bisa diakses JS, aman dari XSS)
    headers.append('Set-Cookie', serialize('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
      path: '/api/auth/refresh', // batasi path untuk keamanan (opsional)
    }));

    // Response: hanya kirim accessToken di body jika benar-benar perlu
    // Tapi best practice: jangan kirim sama sekali — baca dari cookie
    return new NextResponse(JSON.stringify({
      success: true,
      user: {
        id: String(user.id),
        email: user.email,
        name: user.name,
        role: user.role,
         token: accessToken // ❌ HAPUS INI. Tidak perlu.
      }
    }), {
      status: 200,
      headers,
      // Tambahkan header keamanan
    });

  } catch (err: any) {
    console.error('🔐 Login error:', err);
    return NextResponse.json(
      { success: false, error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}