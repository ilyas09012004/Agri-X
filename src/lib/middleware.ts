// src/app/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAccessTokenServer } from '@/lib/auth';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const { pathname } = request.nextUrl;

  // ============================================
  // 1. PROTECTED ROUTES (WAJIB LOGIN)
  // ============================================
  
  const protectedRoutes = ['/cart', '/checkout', '/akun', '/orders', '/forum'];
  
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify token validity
    const decoded = verifyAccessTokenServer(token);
    if (!decoded) {
      // Token invalid/expired
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      return response;
    }
  }

  // ============================================
  // 2. AUTH ROUTES (TIDAK BOLEH AKSES JIKA SUDAH LOGIN)
  // ============================================
  
  const authRoutes = ['/login', '/register'];

  if (authRoutes.some(route => pathname.startsWith(route))) {
    if (token) {
      const decoded = verifyAccessTokenServer(token);
      if (decoded) {
        // User sudah login, redirect ke home
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
  }

  // ============================================
  // 3. ADMIN ROUTES (HANYA ADMIN)
  // ============================================
  
  const adminRoutes = ['/admin', '/dashboard'];
  
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const decoded = verifyAccessTokenServer(token);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};


// ============================================
// AUTH REQUIREMENT
// ============================================

export const requireAuth = (token: string | undefined) => {
  if (!token) return null;
  try {
    const decoded = verifyAccessTokenServer(token);
    return decoded;
  } catch {
    return null;
  }
};

// ============================================
// ERROR HANDLER
// ============================================

export const handleAPIError = (error: any, context: string = 'API') => {
  console.error(`[${context}] Error:`, error);

  const errorResponses: Record<string, { message: string; status: number; code: string }> = {
    'Invalid JSON': { message: 'Invalid JSON in request body', status: 400, code: 'INVALID_JSON' },
    'Insufficient stock': { message: error.message, status: 400, code: 'INSUFFICIENT_STOCK' },
    'not found': { message: 'Resource not found', status: 404, code: 'NOT_FOUND' },
    'Product not found or deleted': { message: error.message, status: 404, code: 'PRODUCT_NOT_FOUND' },
    'Product is currently sold out': { message: error.message, status: 400, code: 'PRODUCT_SOLD_OUT' },
    'Quantity must be at least': { message: error.message, status: 400, code: 'QUANTITY_BELOW_MIN' },
    'Product not found in cart': { message: error.message, status: 404, code: 'CART_ITEM_NOT_FOUND' },
    'Product is currently unavailable': { message: error.message, status: 400, code: 'PRODUCT_UNAVAILABLE' },
    'Unauthorized': { message: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' },
    'Invalid token': { message: 'Invalid token', status: 401, code: 'INVALID_TOKEN' },
  };

  for (const [key, config] of Object.entries(errorResponses)) {
    if (error.message?.includes(key)) {
      return NextResponse.json(
        { success: false, error: config.message, code: config.code },
        { status: config.status }
      );
    }
  }

  return NextResponse.json(
    { success: false, error: 'Internal Server Error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
};

// ============================================
// API RESPONSE FORMATTER
// ============================================

export const apiResponse = {
  success: (data: any, message?: string, status: number = 200) => {
    return NextResponse.json(
      { success: true, data, message },
      { status }
    );
  },
  error: (error: string, code?: string, status: number = 400) => {
    return NextResponse.json(
      { success: false, error, code },
      { status }
    );
  },
};

// ============================================
// WRAPPER FOR AUTH + RATE LIMIT
// ============================================

export const withAuthAndRateLimit = (handler: Function) => {
  return async (req: NextRequest, { params }: { params?: any }) => {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;
    const user = requireAuth(token);

    if (!user) {
      return apiResponse.error('Unauthorized', 'UNAUTHORIZED', 401);
    }

    try {
      return await handler(req, { params, user });
    } catch (error) {
      return handleAPIError(error, 'API_WRAPPER');
    }
  };
};

// ============================================
// REQUEST VALIDATOR
// ============================================

export const validateRequest = (body: any, requiredFields: string[]) => {
  const missing = requiredFields.filter(field => !body[field]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `Field wajib diisi: ${missing.join(', ')}`,
      code: 'MISSING_FIELDS',
    };
  }

  return { valid: true };
};