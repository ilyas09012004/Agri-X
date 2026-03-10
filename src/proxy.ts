// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// CONFIG - MORE LENIENT FOR DEVELOPMENT
// ============================================

const WINDOW_MS = 5 * 60 * 1000; // 5 menit
const MAX_REQUESTS = 100; // ✅ INCREASED: 100 requests per window (was 10)
const AUTH_WINDOW_MS = 1 * 60 * 1000; // 1 menit untuk auth endpoints
const AUTH_MAX_REQUESTS = 20; // ✅ INCREASED: 20 login attempts (was 5)

// ============================================
// RATE LIMITER STORAGE
// ============================================

const requestCounts = new Map<string, { count: number; resetTime: number }>();

// ============================================
// RATE LIMIT FUNCTION
// ============================================

function rateLimit(identifier: string, isAuthEndpoint: boolean = false): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const windowMs = isAuthEndpoint ? AUTH_WINDOW_MS : WINDOW_MS;
  const maxRequests = isAuthEndpoint ? AUTH_MAX_REQUESTS : MAX_REQUESTS;
  
  const record = requestCounts.get(identifier) || { 
    count: 0, 
    resetTime: now + windowMs 
  };

  // Reset window if expired
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  const remaining = Math.max(0, maxRequests - record.count);

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count++;
  requestCounts.set(identifier, record);

  return { allowed: true, remaining, resetTime: record.resetTime };
}

// ============================================
// SECURITY HEADERS
// ============================================

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ============================================
// CORS CONFIG
// ============================================

const allowedOrigins = [
  'http://localhost:3000',
  'https://agri-x.com',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean);

function getCorsHeaders(origin: string | null) {
  if (origin && allowedOrigins.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'false',
  };
}

// ============================================
// PROXY MIDDLEWARE
// ============================================

export function proxy(req: NextRequest) {
  const { pathname, method } = req.nextUrl;
  
  // Get client IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('x-real-ip') || 
             '127.0.0.1';

  // ============================================
  // 1. RATE LIMITING FOR AUTH ENDPOINTS
  // ============================================
  
  if (pathname.startsWith('/api/auth/login') || 
      pathname.startsWith('/api/auth/register') ||
      pathname.startsWith('/api/auth/forgot-password')) {
    
    const rateLimitResult = rateLimit(ip, true);
    
    // ✅ FIX: Changed "TERATE_LIMITED" to "RATE_LIMITED"
    if (!rateLimitResult.allowed) {
      const resetIn = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'RATE_LIMITED', // ✅ FIXED TYPO
          message: `Terlalu banyak percobaan. Silakan coba lagi dalam ${resetIn} detik.`,
          resetIn 
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': resetIn.toString(),
          } 
        }
      );
    }
  }

  // ============================================
  // 2. RATE LIMITING FOR API ENDPOINTS
  // ============================================
  
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = rateLimit(ip, false);
    
    // ✅ FIX: Changed "TERATE_LIMITED" to "RATE_LIMITED"
    if (!rateLimitResult.allowed) {
      const resetIn = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: 'RATE_LIMITED', // ✅ FIXED TYPO
          message: `Terlalu banyak request. Silakan coba lagi dalam ${resetIn} detik.`,
          resetIn 
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': resetIn.toString(),
          } 
        }
      );
    }
  }

  // ============================================
  // 3. CREATE RESPONSE
  // ============================================
  
  const response = NextResponse.next();

  // ============================================
  // 4. ADD SECURITY HEADERS
  // ============================================
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ============================================
  // 5. ADD CORS HEADERS
  // ============================================
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ============================================
  // 6. ALLOWED METHODS
  // ============================================
  
  response.headers.set(
    'Access-Control-Allow-Methods', 
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers', 
    'Content-Type, Authorization, X-Requested-With'
  );

  // ============================================
  // 7. HANDLE PREFLIGHT
  // ============================================
  
  if (method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  // ============================================
  // 8. ADD RATE LIMIT HEADERS
  // ============================================
  
  if (pathname.startsWith('/api/')) {
    const rateLimitResult = rateLimit(ip, pathname.startsWith('/api/auth/'));
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());
  }

  return response;
}

// ============================================
// CONFIG
// ============================================

export const config = {
  matcher: ['/api/:path*', '/((?!_next/static|_next/image|favicon.ico).*)'],
};