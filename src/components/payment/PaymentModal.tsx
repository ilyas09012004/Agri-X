// src/components/payment/PaymentModal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: (result?: any) => void;
  snapToken: string;
  orderId: string;
}

export default function PaymentModal({ 
  isOpen, 
  onClose, 
  snapToken,
  orderId 
}: PaymentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [snapLoaded, setSnapLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      
      // ✅ Load Snap.js if not already loaded
      if (!(window as any).snap) {
        const script = document.createElement('script');
        script.src = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || 
                     'https://app.sandbox.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '');
        script.async = true;
        script.onload = () => {
          console.log('✅ Snap.js loaded');
          setSnapLoaded(true);
          setIsLoading(false);
        };
        script.onerror = () => {
          console.error('❌ Failed to load Snap.js');
          setIsLoading(false);
        };
        document.body.appendChild(script);
      } else {
        setSnapLoaded(true);
        setIsLoading(false);
      }
    }

    // ✅ Close modal on Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose({ eventType: 'modal_closed' });
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // ✅ Initialize Snap.js when loaded
  useEffect(() => {
    if (isOpen && snapLoaded && (window as any).snap && snapToken) {
      // ✅ Pay with Snap.js
      (window as any).snap.pay(snapToken, {
        // ✅ Payment success
        onSuccess: (result: any) => {
          console.log('✅ Payment success:', result);
          onClose({
            eventType: 'success',
            paymentType: result.payment_type,
            transactionId: result.transaction_id,
            grossAmount: result.gross_amount,
            transactionTime: result.transaction_time,
          });
        },
        
        // ✅ Payment pending (VA/bank transfer selected)
        onPending: (result: any) => {
          console.log('⏳ Payment pending:', result);
          onClose({
            eventType: 'pending',
            paymentType: result.payment_type,
            vaNumber: result.va_numbers?.[0]?.va_number,
            bank: result.va_numbers?.[0]?.bank,
            transactionTime: result.transaction_time,
            grossAmount: result.gross_amount,
          });
        },
        
        // ✅ Payment error
        onError: (result: any) => {
          console.error('❌ Payment error:', result);
          onClose({
            eventType: 'error',
            error: result,
          });
        },
        
        // ✅ Modal closed by user
        onClose: () => {
          console.log('❌ Modal closed');
          onClose({ eventType: 'modal_closed' });
        },
      });
    }
  }, [isOpen, snapLoaded, snapToken, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose({ eventType: 'modal_closed' });
        }
      }}
    >
      {/* Modal Container */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-4xl h-[90vh] bg-white dark:bg-background-dark rounded-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface flex-shrink-0">
          <div>
            <h3 className="font-bold text-text-primary">Pembayaran Pesanan</h3>
            <p className="text-sm text-text-secondary">Order ID: <span className="font-mono">{orderId}</span></p>
          </div>
          <button
            onClick={() => onClose({ eventType: 'modal_closed' })}
            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
            aria-label="Tutup"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-background">
          {isLoading ? (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                <p className="text-text-primary font-medium">Memuat halaman pembayaran...</p>
                <p className="text-xs text-text-secondary/70 mt-2 max-w-xs">
                  Jika tidak muncul, pastikan popup tidak diblokir dan JavaScript diaktifkan
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <p className="text-text-primary">Halaman pembayaran sedang dimuat...</p>
                <p className="text-xs text-text-secondary mt-2">
                  Jika Midtrans tidak muncul, silakan refresh halaman
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-border bg-surface/50 flex-shrink-0">
          <p className="text-xs text-text-secondary text-center">
            💡 Pilih metode pembayaran yang tersedia. Status pesanan akan terupdate otomatis setelah pembayaran berhasil.
          </p>
        </div>
      </div>
    </div>
  );
}