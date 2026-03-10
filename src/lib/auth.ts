// src/lib/auth.ts
import { jwtDecode } from 'jwt-decode';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ============================================
// JWT CONFIG
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const ACCESS_TOKEN_EXPIRES = '15m';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface JwtPayload {
  sub: string;
  email?: string;
  role: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ============================================
// PASSWORD HASHING
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// ============================================
// JWT TOKEN GENERATION
// ============================================

export function generateTokens(userId: string, role: string): TokenPair {
  const payload = { sub: userId, role };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });
}

export function generateRefreshToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// ============================================
// JWT TOKEN VERIFICATION
// ============================================

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    if (!token) {
      console.log('[verifyAccessToken] No token provided');
      return null;
    }

    // ✅ Check token format (should be 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[verifyAccessToken] Invalid token format:', token.substring(0, 50) + '...');
      return null;
    }

    // ✅ Decode token
    const decoded = jwtDecode<JwtPayload>(token);
    
    console.log('[verifyAccessToken] Decoded token:', {
      sub: decoded.sub,
      role: decoded.role,
      exp: decoded.exp,
    });

    const now = Date.now() / 1000;
    
    // ✅ Check if token is expired
    if (decoded.exp < now) {
      console.log('[verifyAccessToken] Token expired. Exp:', decoded.exp, 'Now:', now);
      return null;
    }
    
    return decoded;
  } catch (error: any) {
    console.error('[verifyAccessToken] Token verification error:', error.message);
    console.error('[verifyAccessToken] Token:', token ? token.substring(0, 50) + '...' : 'MISSING');
    return null;
  }
}

export function verifyAccessTokenServer(token: string): JwtPayload | null {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    console.error('Server token verification error:', error);
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    if (!token) return null;
    
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    console.error('Refresh token verification error:', error);
    return null;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getUserIdFromToken(token: string): string | null {
  const decoded = verifyAccessToken(token);
  return decoded?.sub || null;
}

export function isTokenValid(token: string): boolean {
  return verifyAccessToken(token) !== null;
}

export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}

// ============================================
// COOKIE HELPERS
// ============================================

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function setCookie(name: string, value: string, days: number = 7) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}