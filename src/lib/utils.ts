/**
 * Format angka menjadi format mata uang Rupiah
 * @param amount - Jumlah dalam angka
 * @returns String format Rupiah (contoh: "Rp 50.000")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format tanggal ke format Indonesia
 * @param date - String atau Date object
 * @returns String format tanggal Indonesia (contoh: "7 Januari 2026")
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Format tanggal pendek
 * @param date - String atau Date object
 * @returns String format tanggal pendek (contoh: "07/01/2026")
 */
export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

/**
 * Potong teks jika terlalu panjang
 * @param text - Teks yang akan dipotong
 * @param maxLength - Panjang maksimal
 * @returns Teks yang sudah dipotong dengan "..." jika perlu
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Generate random string untuk ID
 * @param length - Panjang string
 * @returns Random string
 */
export function generateId(length: number = 10): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Validasi email
 * @param email - Email yang akan divalidasi
 * @returns Boolean (true jika valid)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validasi nomor telepon Indonesia
 * @param phone - Nomor telepon
 * @returns Boolean (true jika valid)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Format nomor telepon Indonesia
 * @param phone - Nomor telepon
 * @returns Format nomor telepon (contoh: "0812-3456-7890")
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+62')) {
    return cleaned.replace('+62', '0').replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.startsWith('62')) {
    return cleaned.replace('62', '0').replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  if (cleaned.startsWith('0')) {
    return cleaned.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}

/**
 * Hitung diskon
 * @param originalPrice - Harga asli
 * @param discountPercent - Persen diskon
 * @returns Harga setelah diskon
 */
export function calculateDiscount(originalPrice: number, discountPercent: number): number {
  return originalPrice - (originalPrice * discountPercent / 100);
}

/**
 * Hitung persentase diskon
 * @param originalPrice - Harga asli
 * @param discountedPrice - Harga setelah diskon
 * @returns Persen diskon
 */
export function calculateDiscountPercent(originalPrice: number, discountedPrice: number): number {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

/**
 * Format angka dengan separator ribuan
 * @param number - Angka yang akan diformat
 * @returns String dengan separator ribuan (contoh: "1.000.000")
 */
export function formatNumber(number: number): string {
  return new Intl.NumberFormat('id-ID').format(number);
}

/**
 * Sleep/delay untuk async operations
 * @param ms - Milidetik
 * @returns Promise yang resolve setelah delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function untuk search/input
 * @param func - Fungsi yang akan di-debounce
 * @param wait - Waktu tunggu dalam ms
 * @returns Fungsi yang sudah di-debounce
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

/**
 * Cek apakah object kosong
 * @param obj - Object yang akan dicek
 * @returns Boolean (true jika kosong)
 */
export function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Deep clone object
 * @param obj - Object yang akan di-clone
 * @returns Object baru yang sudah di-clone
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get initial dari nama
 * @param name - Nama lengkap
 * @returns Initial (contoh: "John Doe" -> "JD")
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

/**
 * Slugify string untuk URL
 * @param text - Text yang akan di-slugify
 * @returns Slug string (contoh: "Hello World" -> "hello-world")
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitalize first letter
 * @param text - Text yang akan di-capitalized
 * @returns Text dengan huruf pertama kapital
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Format ukuran file (bytes ke KB, MB, GB)
 * @param bytes - Ukuran dalam bytes
 * @returns String format ukuran (contoh: "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Cek apakah value null atau undefined
 * @param value - Value yang akan dicek
 * @returns Boolean (true jika null/undefined)
 */
export function isNullOrUndefined(value: any): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Parse query string dari URL
 * @param queryString - Query string (contoh: "?name=john&age=25")
 * @returns Object dengan key-value pairs
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
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
 * @param params - Object dengan key-value pairs
 * @returns Query string (contoh: "name=john&age=25")
 */
export function buildQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}