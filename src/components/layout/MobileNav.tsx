// src/components/layout/MobileNav.tsx
'use client';

import { usePathname } from 'next/navigation';
import { Home, Sprout, MessageSquare, Heart, User, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';

const navItems = [
  { href: '/', icon: Home, label: 'Home', page: 'home' },
  { href: '/katalog', icon: Sprout, label: 'Katalog', page: 'catalog' },
  { href: '/forum', icon: MessageSquare, label: 'Forum', page: 'forum' },
  { href: '/cart', icon: ShoppingCart, label: 'Cart', page: 'cart' },
  { href: '/akun', icon: User, label: 'Akun', page: 'account' },
];

export function MobileNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border md:hidden z-50">
      <div className="flex justify-around items-center py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'text-primary bg-background'
                  : 'text-text-secondary hover:text-primary'
              }`}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.page === 'cart' && totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {totalItems > 9 ? '9+' : totalItems}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}