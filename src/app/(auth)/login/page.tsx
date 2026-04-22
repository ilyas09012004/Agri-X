'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setCookie } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  // ✅ FIX: Gunakan state untuk tracking focus, jangan pakai document.activeElement
  const [isFocused, setIsFocused] = useState<{
    email: boolean;
    password: boolean;
  }>({ email: false, password: false });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const rawResponse = await res.text();
      let data;
      try {
        data = JSON.parse(rawResponse);
      } catch (parseError) {
        throw new Error('Response bukan JSON valid.');
      }

      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          throw new Error(`Terlalu banyak percobaan. Tunggu ${data.resetIn || 60} detik.`);
        }
        throw new Error(data.error || 'Login gagal');
      }

      const token = data.token || data.user?.token;
      
      if (!token) {
        console.error('Token missing in response:', data);
        throw new Error('Token tidak ditemukan. Cek backend endpoint.');
      }

      const userData = {
        id: data.user?.id || '1',
        name: data.user?.name || 'User',
        email: data.user?.email || formData.email,
        role: data.user?.role || 'buyer',
        avatar: data.user?.avatar || null,
        phone: data.user?.phone || null,
      };

      setCookie('accessToken', token, 7);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(userData));

      login(token, userData);
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10 py-8">
      <div className="w-full max-w-500 px-4"> {/* Fix: max-w-md instead of max-w-500 */}
        
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Agri X</h1>
          <p className="text-text-secondary mt-2 text-sm">Masuk ke akun Anda</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-border/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <div className="relative">
                {/* ✅ FIX: Gunakan state isFocused.email */}
                <Mail 
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                    formData.email || isFocused.email 
                      ? 'opacity-0 pointer-events-none -translate-x-2' 
                      : 'opacity-100 translate-x-0'
                  }`} 
                />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onFocus={() => setIsFocused(prev => ({ ...prev, email: true }))}
                  onBlur={() => setIsFocused(prev => ({ ...prev, email: false }))}
                  placeholder="      nama@email.com"
                  required
                  className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                    formData.email || isFocused.email ? 'pl-4 pr-4' : 'pl-12 pr-4'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                {/* ✅ FIX: Gunakan state isFocused.password */}
                <Lock 
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary transition-all duration-200 ${
                    formData.password || isFocused.password 
                      ? 'opacity-0 pointer-events-none -translate-x-2' 
                      : 'opacity-100 translate-x-0'
                  }`} 
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setIsFocused(prev => ({ ...prev, password: true }))}
                  onBlur={() => setIsFocused(prev => ({ ...prev, password: false }))}
                  placeholder="      ••••••••"
                  required
                  className={`w-full input py-3 rounded-xl border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 ${
                    formData.password || isFocused.password ? 'pl-4 pr-12' : 'pl-12 pr-12'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors p-1"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="text-sm text-primary hover:underline transition-colors"
              >
                Lupa password?
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm animate-fade-in dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-4 text-base font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memuat...</span>
                </div>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface text-text-secondary">atau</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-text-secondary text-sm">
              Belum punya akun?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-primary font-semibold hover:underline transition-colors"
              >
                Daftar sekarang
              </button>
            </p>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-surface/50 rounded-2xl border border-border/50">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Produk Segar</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-surface/50 rounded-2xl border border-border/50">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Transaksi Aman</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-surface/50 rounded-2xl border border-border/50">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Support 24/7</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-text-secondary/70">
            © 2025 Agri X. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}