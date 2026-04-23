
// ============================================================================
// DATA TRANSFORMATION (Snake_case <-> CamelCase)
// ============================================================================

/**
 * Ubah snake_case (dari DB) -> camelCase (untuk Frontend)
 */
export function keysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(keysToCamelCase);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Regex ubah 'user_id' jadi 'userId'
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = keysToCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

/**
 * Ubah camelCase (dari Frontend) -> snake_case (untuk DB)
 */
export function keysToSnakeCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(keysToSnakeCase);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      // Regex ubah 'userId' jadi 'user_id'
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = keysToSnakeCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

// ============================================================================
// FORMATTING (Currency, Date, Number)
// ============================================================================

/**
 * Format angka menjadi format mata uang Rupiah
 * @param amount - Jumlah dalam angka
 * @returns String format Rupiah (contoh: "Rp 50.000")
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rp 0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format tanggal ke format Indonesia (AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format tanggal Indonesia (contoh: "7 Januari 2026") atau "-" jika invalid
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    // Cek apakah date valid
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(d);
  } catch (error) {
    console.warn('Error formatting date:', date);
    return '-';
  }
}

/**
 * Format tanggal pendek (AMAN DARI ERROR)
 * @param date - String atau Date object
 * @returns String format tanggal pendek (contoh: "07/01/2026") atau "-" jika invalid
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (error) {
    return '-';
  }
}

/**
 * Format waktu relatif (contoh: "2 jam yang lalu")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Baru saja';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} menit yang lalu`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} jam yang lalu`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} hari yang lalu`;
  
  return formatDateShort(date);
}

/**
 * Format angka dengan separator ribuan
 */
export function formatNumber(number: number | string | null | undefined): string {
  if (number === null || number === undefined) return '0';
  const num = typeof number === 'string' ? parseFloat(number) : number;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('id-ID').format(num);
}

// ============================================================================
// TEXT & STRING UTILS
// ============================================================================

/**
 * Potong teks jika terlalu panjang
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Get initial dari nama (contoh: "John Doe" -> "JD")
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Slugify string untuk URL
 */
export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validasi email
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validasi nomor telepon Indonesia
 */
export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Validasi URL (untuk gambar produk/forum)
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Cek apakah value null atau undefined
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Cek apakah object kosong
 */
export function isEmpty(obj: object): boolean {
  if (!obj) return true;
  return Object.keys(obj).length === 0;
}

// ============================================================================
// MATH & CALCULATION
// ============================================================================

/**
 * Hitung diskon
 */
export function calculateDiscount(originalPrice: number, discountPercent: number): number {
  return originalPrice - (originalPrice * discountPercent / 100);
}

/**
 * Hitung persentase diskon
 */
export function calculateDiscountPercent(originalPrice: number, discountedPrice: number): number {
  if (originalPrice === 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

/**
 * Generate random string untuk ID
 */
export function generateId(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

// ============================================================================
// ASYNC & PERFORMANCE
// ============================================================================

/**
 * Sleep/delay untuk async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function untuk search/input
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============================================================================
// FILE & MEDIA
// ============================================================================

/**
 * Format ukuran file (bytes ke KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================================
// QUERY STRING
// ============================================================================

/**
 * Parse query string dari URL
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!queryString) return params;
  
  const search = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  
  search.split('&').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  
  return params;
}

/**
 * Build query string dari object
 */
export function buildQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}