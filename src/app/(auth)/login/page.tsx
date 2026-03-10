// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Leaf, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext'; // ✅ FIX: contexts (dengan 's')
import { setCookie } from '@/lib/auth'; // ✅ ADD: Import setCookie

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
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

      console.log('=== PARSED DATA ===');
      console.log('Data:', data);
      console.log('Token at root:', !!data.token);
      console.log('Token in user:', !!data.user?.token);
      console.log('====================');

      if (!res.ok) {
        if (data.code === 'RATE_LIMITED') {
          throw new Error(`Terlalu banyak percobaan. Tunggu ${data.resetIn || 60} detik.`);
        }
        throw new Error(data.error || 'Login gagal');
      }

      // ✅ CHECK BOTH LOCATIONS
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

      console.log('=== CALLING LOGIN FUNCTION ===');
      console.log('Token:', token.substring(0, 50) + '...');
      console.log('UserData:', userData);
      console.log('==============================');

      // ✅ SIMPAN TOKEN DI COOKIE DAN LOCALSTORAGE
      setCookie('accessToken', token, 7); // ✅ ADD: Set cookie
      localStorage.setItem('accessToken', token); // ✅ ADD: Set localStorage
      localStorage.setItem('user', JSON.stringify(userData)); // ✅ ADD: Set user data

      // ✅ USE CORRECT TOKEN
      login(token, userData);
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="w-full"> {/* ✅ FIX: max-w-200 → max-w-md */}
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary">Agri X</h1>
          <p className="text-text-secondary mt-2">Masuk ke akun Anda</p>
        </div>

        {/* Login Form */}
        <div className="bg-surface rounded-3xl p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <div className="relative"> {/* ✅ FIX: Remove pl-15 */}
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="nama@email.com"
                  required
                  className="input pl-12"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative"> {/* ✅ FIX: Remove pl-15 */}
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="input pl-12 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 text-lg disabled:opacity-50"
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

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-text-secondary">
              Belum punya akun?{' '}
              <button
                onClick={() => router.push('/register')}
                className="text-primary font-semibold hover:underline"
              >
                Daftar sekarang
              </button>
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Produk Segar</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Transaksi Aman</p>
          </div>
          <div>
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs text-text-secondary">Support 24/7</p>
          </div>
        </div>
      </div>
    </div>
  );
}