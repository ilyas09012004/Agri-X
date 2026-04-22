// src/app/(main)/checkout/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Truck, Receipt, CreditCard, Building,
  Smartphone, QrCode, Wallet, Plus, Loader2, CheckCircle,
  AlertCircle, Edit2, Trash2, Check, X
} from 'lucide-react';
import PaymentModal from '@/components/payment/PaymentModal';

// Fungsi bantu untuk membaca cookie
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Payment Methods Config
const paymentMethods = [
  {
    id: 'va_bca',
    name: 'BCA Virtual Account',
    icon: Building,
    type: 'bank_transfer',
    bank: 'bca',
    fee: 0,
    description: 'Transfer via ATM, Mobile Banking',
  },
  {
    id: 'va_mandiri',
    name: 'Mandiri Virtual Account',
    icon: Building,
    type: 'bank_transfer',
    bank: 'mandiri',
    fee: 0,
    description: 'Transfer via ATM, Livin Mandiri',
  },
  {
    id: 'va_bri',
    name: 'BRI Virtual Account',
    icon: Building,
    type: 'bank_transfer',
    bank: 'bri',
    fee: 0,
    description: 'Transfer via ATM, BRImo',
  },
  {
    id: 'va_bni',
    name: 'BNI Virtual Account',
    icon: Building,
    type: 'bank_transfer',
    bank: 'bni',
    fee: 0,
    description: 'Transfer via Mobile Banking',
  },
  {
    id: 'gopay',
    name: 'GoPay',
    icon: Smartphone,
    type: 'ewallet',
    fee: 2000,
    description: 'Bayar menggunakan GoPay',
  },
  {
    id: 'ovo',
    name: 'OVO',
    icon: Smartphone,
    type: 'ewallet',
    fee: 2000,
    description: 'Bayar menggunakan OVO',
  },
  {
    id: 'dana',
    name: 'DANA',
    icon: Smartphone,
    type: 'ewallet',
    fee: 2000,
    description: 'Bayar menggunakan DANA',
  },
  {
    id: 'qris',
    name: 'QRIS',
    icon: QrCode,
    type: 'qris',
    fee: 1500,
    description: 'Scan QR Code semua e-wallet',
  },
  {
    id: 'cod',
    name: 'Cash on Delivery (COD)',
    icon: Wallet,
    type: 'cod',
    fee: 5000,
    description: 'Bayar tunai saat diterima',
  },
];

export default function CheckoutPage() {
  const router = useRouter();
  
  // Cart & Pricing State
  const [items, setItems] = useState<any[]>([]);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [paymentFee, setPaymentFee] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  
  // Address State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddressData, setSelectedAddressData] = useState<any>(null);
  const [originVillageCode, setOriginVillageCode] = useState('');
  
  // Shipping State
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  
  // Payment State
  const [selectedPayment, setSelectedPayment] = useState('');
  
  // Loading & UI State
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [autoEstimating, setAutoEstimating] = useState(false);
  const [hasEstimated, setHasEstimated] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // ✅ Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [snapToken, setSnapToken] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState('');

  // Location State
  const [provinces, setProvinces] = useState<any[]>([]);
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [parsedLocations, setParsedLocations] = useState<Map<string, string>>(new Map());

  // Address Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState({
    detail: '',
    province: '',
    city: '',
    district: '',
    villageCode: '',
    zipCode: '',
    recipientName: '',
    recipientPhone: '',
  });
  const [loadingAddAddress, setLoadingAddAddress] = useState(false);

  // Dropdown States
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedRegency, setSelectedRegency] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  useEffect(() => {
    loadCheckoutData();
  }, [router]);

  const loadCheckoutData = async () => {
    try {
      setError(null);
      setLoading(true);

      const token = getCookie('accessToken');
      if (!token) {
        throw new Error('Sesi tidak ditemukan. Silakan login kembali.');
      }

      await loadAllLocations(token);

      const cartRes = await fetch('/api/cart', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!cartRes.ok) {
        throw new Error(`API Cart Error: ${cartRes.status}`);
      }

      const cartData = await cartRes.json();
      if (!cartData.success) {
        throw new Error(cartData.error || 'API Cart returned error');
      }

      setItems(Array.isArray(cartData.formattedCartItems) ? cartData.formattedCartItems : []);
      setTotalWeight(cartData.totalWeight || 0);

      const calculatedTotal = cartData.formattedCartItems.reduce((sum: number, item: any) => {
        return sum + (item.product.price * item.quantity);
      }, 0);
      setTotalPrice(calculatedTotal);

      if (Array.isArray(cartData.formattedCartItems) && cartData.formattedCartItems.length > 0) {
        setOriginVillageCode(cartData.formattedCartItems[0].product.originVillageCode || '');
      } else {
        setOriginVillageCode('');
        setTotalPrice(0);
      }

      await fetchAddresses();

    } catch (err: any) {
      console.error('Error loading checkout:', err);
      setError(err.message);
      if (err.message.includes('Unauthorized')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAllLocations = async (token: string) => {
    try {
      const provRes = await fetch('/api/locations/provinces', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const provData = await provRes.json();
      if (provData.success) {
        const formattedProvinces = (provData.data || []).map((p: any) => ({
          code: p.code || p.id,
          name: p.name,
        }));
        setProvinces(formattedProvinces);
        const locationMap = new Map<string, string>();
        formattedProvinces.forEach((p: any) => locationMap.set(p.code, p.name));
        setParsedLocations(locationMap);
      }
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  };

  const fetchAddresses = async () => {
    try {
      const token = getCookie('accessToken');
      if (!token) return;

      const addrRes = await fetch('/api/address', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (addrRes.ok) {
        const addrData = await addrRes.json();
        if (addrData.success) {
          const addrList = Array.isArray(addrData.addresses) ? addrData.addresses : [];
          setAddresses(addrList);
          if (addrList.length > 0) {
            setSelectedAddressId(addrList[0].id);
            setSelectedAddressData(addrList[0]);
            await loadAddressLocationNames(addrList[0], token);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching addresses:', err);
    }
  };

  const loadAddressLocationNames = async (address: any, token: string) => {
    try {
      const locationMap = new Map<string, string>(parsedLocations);
      
      if (address.province) {
        const regRes = await fetch(`/api/locations/regencies/${address.province}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const regData = await regRes.json();
        if (regData.success) {
          const formattedRegencies = (regData.data || []).map((r: any) => ({
            code: r.code || r.id,
            name: r.name,
          }));
          setRegencies(formattedRegencies);
          formattedRegencies.forEach((r: any) => locationMap.set(r.code, r.name));
        }
      }
      
      if (address.city) {
        const distRes = await fetch(`/api/locations/districts/${address.city}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const distData = await distRes.json();
        if (distData.success) {
          const formattedDistricts = (distData.data || []).map((d: any) => ({
            code: d.code || d.id,
            name: d.name,
          }));
          setDistricts(formattedDistricts);
          formattedDistricts.forEach((d: any) => locationMap.set(d.code, d.name));
        }
      }
      
      if (address.district) {
        const villRes = await fetch(`/api/locations/villages/${address.district}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const villData = await villRes.json();
        if (villData.success) {
          const formattedVillages = (villData.data || []).map((v: any) => ({
            code: v.code || v.id,
            name: v.name,
          }));
          setVillages(formattedVillages);
          formattedVillages.forEach((v: any) => locationMap.set(v.code, v.name));
        }
      }
      
      setParsedLocations(locationMap);
    } catch (err) {
      console.error('Error loading address location names:', err);
    }
  };

  const clearLocations = () => {
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
  };

  const parseAddressToText = (address: any): string => {
    if (!address) return 'Alamat tidak tersedia';
    const provinceName = parsedLocations.get(address.province) || address.province;
    const cityName = parsedLocations.get(address.city) || address.city;
    const districtName = parsedLocations.get(address.district) || address.district;
    const villageName = parsedLocations.get(address.villageCode) || address.villageCode;
    return `${address.detail}, ${villageName}, ${districtName}, ${cityName}, ${provinceName} ${address.zipCode}`;
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const addrId = e.target.value;
    setSelectedAddressId(addrId ? Number(addrId) : null);
    const addr = addresses.find(a => a.id.toString() === addrId);
    if (addr) {
      setSelectedAddressData(addr);
      const token = getCookie('accessToken');
      if (token) loadAddressLocationNames(addr, token);
    }
  };

  const openAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      detail: '',
      province: '',
      city: '',
      district: '',
      villageCode: '',
      zipCode: '',
      recipientName: '',
      recipientPhone: '',
    });
    setSelectedProvince('');
    setSelectedRegency('');
    setSelectedDistrict('');
    clearLocations();
    setShowAddressForm(true);
  };

  const openEditAddress = (address: any) => {
    setEditingAddressId(address.id);
    setAddressForm({
      detail: address.detail || '',
      province: address.province || '',
      city: address.city || '',
      district: address.district || '',
      villageCode: address.villageCode || '',
      zipCode: address.zipCode || '',
      recipientName: address.recipientName || '',
      recipientPhone: address.recipientPhone || '',
    });
    setSelectedProvince(address.province || '');
    setSelectedRegency(address.city || '');
    setSelectedDistrict(address.district || '');
    setShowAddressForm(true);
  };

  const handleSaveAddress = async () => {
    if (!addressForm.detail || !addressForm.villageCode) {
      setError('Lengkapi alamat terlebih dahulu');
      return;
    }

    if (!/^\d{10}$/.test(addressForm.villageCode)) {
      setError('Kode desa harus 10 digit angka');
      return;
    }

    if (!addressForm.recipientName?.trim() || !addressForm.recipientPhone?.trim()) {
      setError('Nama penerima dan no. telepon wajib diisi');
      return;
    }

    setLoadingAddAddress(true);
    try {
      const token = getCookie('accessToken');
      const url = editingAddressId ? `/api/address/${editingAddressId}` : '/api/address';
      const method = editingAddressId ? 'PUT' : 'POST';
      
      const payload = {
        detail: addressForm.detail || '',
        province: selectedProvince || '',
        city: selectedRegency || '',
        district: selectedDistrict || '',
        villageCode: addressForm.villageCode || '',
        zipCode: addressForm.zipCode || '',
        recipientName: addressForm.recipientName || '',
        recipientPhone: addressForm.recipientPhone || '',
        isDefault: editingAddressId === null,
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan alamat');
      }

      setSuccess(`✅ Alamat berhasil ${editingAddressId ? 'diedit' : 'ditambahkan'}!`);
      setShowAddressForm(false);
      setAddressForm({
        detail: '',
        province: '',
        city: '',
        district: '',
        villageCode: '',
        zipCode: '',
        recipientName: '',
        recipientPhone: '',
      });
      setSelectedProvince('');
      setSelectedRegency('');
      setSelectedDistrict('');
      clearLocations();
      await fetchAddresses();
    } catch (error: any) {
      console.error('Save address error:', error);
      setError(error.message);
    } finally {
      setLoadingAddAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    if (!confirm('Hapus alamat ini?')) return;
    try {
      const token = getCookie('accessToken');
      
      const res = await fetch(`/api/address/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus alamat');
      }

      setSuccess('✅ Alamat berhasil dihapus!');
      if (selectedAddressId === addressId) {
        setSelectedAddressId(null);
        setSelectedAddressData(null);
      }
      await fetchAddresses();
    } catch (error: any) {
      console.error('Delete address error:', error);
      setError(error.message);
    }
  };

  const handleEstimateShipping = async () => {
    if (!selectedAddressId || !selectedAddressData) {
      setError('Silakan pilih alamat terlebih dahulu.');
      return;
    }
    if (items.length === 0 || totalWeight <= 0) {
      setError('Keranjang kosong atau total berat tidak valid.');
      return;
    }
    if (!originVillageCode) {
      setError('Origin village code produk tidak ditemukan.');
      return;
    }
    if (!selectedAddressData.villageCode || selectedAddressData.villageCode.length !== 10) {
      setError('Alamat tidak memiliki kode desa yang valid untuk cek ongkir');
      return;
    }

    try {
      setError(null);
      setEstimating(true);

      const token = getCookie('accessToken');
      if (!token) throw new Error('Sesi tidak ditemukan.');

      const res = await fetch('/api/rajaongkir/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          origin_village_code: originVillageCode,
          destination_village_code: selectedAddressData.villageCode,
          weight: totalWeight,
        })
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'API returned error');
      }

      const formattedOptions = data.formattedData.map((opt: any) => ({
        id: opt.service,
        name: opt.service,
        price: opt.value,
        etd: opt.etd,
      }));

      setCouriers(formattedOptions);
      
      if (formattedOptions.length > 0 && !selectedCourier) {
        setSelectedCourier(formattedOptions[0].id);
        setShippingCost(formattedOptions[0].price);
        updateGrandTotal(formattedOptions[0].price, paymentFee);
      }
      
      setHasEstimated(true);
      setSuccess('✅ Opsi pengiriman berhasil dimuat!');

    } catch (err: any) {
      console.error('Error estimating shipping:', err);
      setError(err.message);
    } finally {
      setEstimating(false);
      setAutoEstimating(false);
    }
  };

  useEffect(() => {
    if (
      hasEstimated || 
      estimating || 
      autoEstimating ||
      !selectedAddressId || 
      !originVillageCode || 
      totalWeight <= 0 ||
      loading
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setAutoEstimating(true);
      handleEstimateShipping();
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedAddressId, originVillageCode, totalWeight, loading]);

  const handleShippingChange = (courierId: string, price: number) => {
    setSelectedCourier(courierId);
    setShippingCost(price);
    updateGrandTotal(price, paymentFee);
  };

  const handlePaymentChange = (paymentId: string) => {
    setSelectedPayment(paymentId);
    const method = paymentMethods.find(p => p.id === paymentId);
    const fee = method?.fee || 0;
    setPaymentFee(fee);
    updateGrandTotal(shippingCost, fee);
  };

  const updateGrandTotal = (shipping: number, fee: number) => {
    const total = (totalPrice || 0) + (shipping || 0) + (fee || 0);
    setGrandTotal(total);
  };

  // ✅ HELPER: Update payment method in backend
  const updatePaymentMethod = async (orderId: string, paymentType: string, extraData?: any) => {
    try {
      const token = getCookie('accessToken');
      await fetch('/api/payment/method', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          paymentType,
          ...extraData,
        }),
      });
    } catch (error) {
      console.error('Failed to update payment method:', error);
    }
  };

  // ✅ HELPER: Save payment state to database
  const savePaymentState = async (orderId: string, data: any, event: string) => {
    try {
      const token = getCookie('accessToken');
      
      await fetch('/api/payment/state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          event,
          timestamp: new Date().toISOString(),
          ...data,
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Failed to save payment state:', error);
    }
  };

  // ✅ MAIN: Place order dengan Modal Popup
  const handlePlaceOrder = async () => {
    if (!selectedAddressId || !selectedAddressData) {
      setError('Pilih alamat pengiriman terlebih dahulu.');
      return;
    }
    if (!selectedCourier) {
      setError('Pilih opsi pengiriman terlebih dahulu.');
      return;
    }
    if (!selectedPayment) {
      setError('Pilih metode pembayaran terlebih dahulu.');
      return; 
    }
    if (grandTotal <= 0) {
      setError('Total pembayaran tidak valid.');
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);

      const token = getCookie('accessToken');
      if (!token) throw new Error('Sesi tidak ditemukan.');

      const paymentMethod = paymentMethods.find(p => p.id === selectedPayment);
      const orderId = `AGR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // ✅ Simpan order ID untuk modal
      setCurrentOrderId(orderId);

      // 1. Create order in database
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId, 
          addressId: selectedAddressId,
          shippingCost: shippingCost,
          totalAmount: grandTotal,
          paymentMethod: paymentMethod?.type || 'cod',
          paymentGateway: selectedPayment,
          paymentFee: paymentFee,
          items: items.map((item: any) => ({
            productId: item.productId,
            price: item.product.price,
            quantity: item.quantity,
          })),
        })
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error || 'Gagal membuat pesanan');
      }

      // 2. Handle payment
      if (paymentMethod?.type !== 'cod') {
        // Call Midtrans to get snap token
        const midtransRes = await fetch('/api/payment/midtrans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: orderId,
            grossAmount: grandTotal,
            paymentType: selectedPayment,
          }),
        });

        const midtransData = await midtransRes.json();
        if (!midtransRes.ok) {
          throw new Error(midtransData.error || 'Gagal membuat pembayaran');
        }

        setSuccess('✅ Pesanan berhasil dibuat! Membuka halaman pembayaran...');
        
        // ✅ SET SNAP TOKEN & SHOW MODAL
        setSnapToken(midtransData.snapToken);
        setShowPaymentModal(true);
        
        // ✅ Snap.js callbacks akan di-handle di PaymentModal component
        return;
      }

      // 3. COD: redirect directly
      router.push(`/orders/${orderId}?payment=cod`);

    } catch (err: any) {
      console.error('Checkout failed:', err);
      setError(err.message);
      setIsProcessing(false);
    }
  };

  // ✅ CALLBACK: Handle payment modal close
  const handlePaymentModalClose = async (result?: any) => {
    setShowPaymentModal(false);
    
    if (result?.eventType === 'success') {
      // Payment successful
      await updatePaymentMethod(currentOrderId, result.paymentType, {
        transactionId: result.transactionId,
      });
      await savePaymentState(currentOrderId, result, 'success');
      router.push(`/orders/${currentOrderId}?payment=success`);
    } else if (result?.eventType === 'pending') {
      // Payment pending (VA selected)
      await updatePaymentMethod(currentOrderId, result.paymentType, {
        vaNumber: result.vaNumber,
        bank: result.bank,
      });
      await savePaymentState(currentOrderId, result, 'pending');
      router.push(`/orders/${currentOrderId}?payment=pending`);
    } else if (result?.eventType === 'error') {
      // Payment error
      await savePaymentState(currentOrderId, result, 'error');
      setError('Pembayaran gagal. Silakan coba lagi.');
    } else {
      // Modal closed without completing
      await savePaymentState(currentOrderId, {}, 'modal_closed');
      router.push(`/orders/${currentOrderId}`);
    }
  };

  // Location dropdown handlers
  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceId = e.target.value;
    setSelectedProvince(provinceId);
    setAddressForm(prev => ({ ...prev, province: provinceId, city: '', district: '', villageCode: '' }));
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    
    if (provinceId) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/regencies/${provinceId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const formattedRegencies = (data.data || []).map((r: any) => ({
            code: r.code || r.id,
            name: r.name,
          }));
          setRegencies(formattedRegencies);
          const locationMap = new Map<string, string>(parsedLocations);
          formattedRegencies.forEach((r: any) => locationMap.set(r.code, r.name));
          setParsedLocations(locationMap);
        }
      } catch (err) {
        console.error('Error fetching regencies:', err);
      }
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    if (city && !/^\d{2,6}$/.test(city)) return;
    
    setSelectedRegency(city);
    setAddressForm(prev => ({ ...prev, city, district: '', villageCode: '' }));
    setDistricts([]);
    setVillages([]);
    
    if (city) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/districts/${city}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const formattedDistricts = (data.data || []).map((d: any) => ({
            code: d.code || d.id,
            name: d.name,
          }));
          setDistricts(formattedDistricts);
          const locationMap = new Map<string, string>(parsedLocations);
          formattedDistricts.forEach((d: any) => locationMap.set(d.code, d.name));
          setParsedLocations(locationMap);
        }
      } catch (err) {
        console.error('Error fetching districts:', err);
      }
    }
  };

  const handleDistrictChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const district = e.target.value;
    if (district && !/^\d{2,8}$/.test(district)) return;
    
    setSelectedDistrict(district);
    setAddressForm(prev => ({ ...prev, district, villageCode: '' }));
    setVillages([]);
    
    if (district) {
      try {
        const token = getCookie('accessToken');
        const res = await fetch(`/api/locations/villages/${district}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const formattedVillages = (data.data || []).map((v: any) => ({
            code: v.code || v.id,
            name: v.name,
          }));
          setVillages(formattedVillages);
          const locationMap = new Map<string, string>(parsedLocations);
          formattedVillages.forEach((v: any) => locationMap.set(v.code, v.name));
          setParsedLocations(locationMap);
        }
      } catch (err) {
        console.error('Error fetching villages:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-text-primary">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Memuat checkout...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-text-secondary hover:text-primary mb-6 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Kembali</span>
      </button>

      <h1 className="text-3xl font-bold text-text-primary mb-6">Checkout</h1>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Address Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold text-text-primary">Alamat Pengiriman</h2>
              </div>
              <button onClick={openAddAddress} className="btn-primary text-sm py-2 px-4">
                <Plus className="w-4 h-4 inline mr-1" /> Tambah Alamat
              </button>
            </div>

            {showAddressForm && (
              <div className="bg-surface rounded-xl p-4 mb-4 space-y-4 animate-fade-in dark:bg-surface/50">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-text-primary">{editingAddressId ? 'Edit Alamat' : 'Tambah Alamat Baru'}</h3>
                  <button onClick={() => setShowAddressForm(false)} className="text-text-secondary hover:text-primary">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Nama Penerima <span className="text-red-500">*</span></label>
                    <input type="text" value={addressForm.recipientName} onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })} placeholder="Nama lengkap" className="input" required />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">No. Telepon <span className="text-red-500">*</span></label>
                    <input type="tel" value={addressForm.recipientPhone} onChange={(e) => setAddressForm({ ...addressForm, recipientPhone: e.target.value })} placeholder="081234567890" className="input" required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Alamat Lengkap <span className="text-red-500">*</span></label>
                  <textarea value={addressForm.detail} onChange={(e) => setAddressForm({ ...addressForm, detail: e.target.value })} placeholder="Jl. Nama Jalan No. 123" rows={3} className="input" required />
                </div>

                <div>
                  <label className="block text-sm text-text-secondary mb-2">Provinsi <span className="text-red-500">*</span></label>
                  <select value={selectedProvince} onChange={handleProvinceChange} className="input" required>
                    <option value="" key="prov-default">Pilih Provinsi</option>
                    {provinces.map((prov: any) => <option key={prov.code} value={prov.code}>{prov.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Kota/Kabupaten <span className="text-red-500">*</span></label>
                    <select value={selectedRegency} onChange={handleCityChange} className="input" disabled={!selectedProvince} required>
                      <option value="" key="city-default">Pilih Kota</option>
                      {regencies.map((reg: any) => <option key={reg.code} value={reg.code}>{reg.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Kecamatan <span className="text-red-500">*</span></label>
                    <select value={selectedDistrict} onChange={handleDistrictChange} className="input" disabled={!selectedRegency} required>
                      <option value="" key="dist-default">Pilih Kecamatan</option>
                      {districts.map((dist: any) => <option key={dist.code} value={dist.code}>{dist.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Desa/Kelurahan <span className="text-red-500">*</span></label>
                    <select value={addressForm.villageCode} onChange={(e) => setAddressForm({ ...addressForm, villageCode: e.target.value })} className="input" disabled={!selectedDistrict} required>
                      <option value="" key="village-default">Pilih Desa</option>
                      {villages.map((village: any) => <option key={village.code} value={village.code}>{village.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Kode Pos <span className="text-red-500">*</span></label>
                    <input type="text" value={addressForm.zipCode} onChange={(e) => setAddressForm({ ...addressForm, zipCode: e.target.value })} placeholder="65111" className="input" required />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveAddress} className="btn-primary flex-1" disabled={loadingAddAddress}>
                    {loadingAddAddress ? <><Loader2 className="w-4 h-4 inline mr-1 animate-spin" />Menyimpan...</> : <><Check className="w-4 h-4 inline mr-1" />Simpan</>}
                  </button>
                  <button onClick={() => setShowAddressForm(false)} className="btn-outline flex-1" disabled={loadingAddAddress}>Batal</button>
                </div>
              </div>
            )}

            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((address: any) => (
                  <div key={address.id} className={`border-2 rounded-xl p-4 transition-all ${selectedAddressId === address.id ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10' : 'border-border hover:border-primary/50 dark:border-border-dark'}`}>
                    <div className="flex items-start gap-3">
                      <div onClick={() => { setSelectedAddressId(address.id); setSelectedAddressData(address); }} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer mt-1 ${selectedAddressId === address.id ? 'border-primary bg-primary' : 'border-border dark:border-border-dark'}`}>
                        {selectedAddressId === address.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary">{address.recipientName || address.detail}</p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{parseAddressToText(address)}</p>
                        {address.recipientPhone && <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">📞 {address.recipientPhone}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEditAddress(address)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-blue-900/20" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteAddress(address.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-text-secondary dark:text-text-secondary-dark">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada alamat tersimpan</p>
                <button onClick={openAddAddress} className="btn-primary mt-4">Tambah Alamat Pertama</button>
              </div>
            )}
          </div>

          {/* Shipping Card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Pilih Pengiriman</h2>
            </div>

            {(autoEstimating || estimating) && couriers.length === 0 && (
              <div className="flex items-center justify-center gap-3 py-6 text-text-secondary">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Menghitung ongkos kirim...</span>
              </div>
            )}

            {couriers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">Pilih Layanan Pengiriman</h3>
                {couriers.map((courier: any) => (
                  <div key={courier.id} onClick={() => handleShippingChange(courier.id, courier.price)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedCourier === courier.id ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10' : 'border-border hover:border-primary/50 dark:border-border-dark'}`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-text-primary">{courier.name}</p>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Estimasi: {courier.etd}</p>
                      </div>
                      <p className="font-bold text-primary">{formatCurrency(courier.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(!selectedAddressId || totalWeight <= 0) && couriers.length === 0 && !estimating && !autoEstimating && (
              <p className="text-sm text-text-secondary dark:text-text-secondary-dark text-center py-4">Pilih alamat untuk menghitung ongkos kirim</p>
            )}
          </div>

          {/* Payment Methods */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Metode Pembayaran</h2>
            </div>
          
            <div className="space-y-4">
              {/* Bank Transfer */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">Virtual Account</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.filter(p => p.type === 'bank_transfer').map((method) => {
                    const Icon = method.icon;
                    return (
                      <div key={method.id} onClick={() => handlePaymentChange(method.id)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPayment === method.id ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10' : 'border-border hover:border-primary/50 dark:border-border-dark'}`}>
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-primary" />
                          <div>
                            <p className="font-semibold text-text-primary text-sm">{method.name}</p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{method.fee === 0 ? 'Gratis' : formatCurrency(method.fee)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* E-Wallet */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">E-Wallet</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.filter(p => p.type === 'ewallet').map((method) => {
                    const Icon = method.icon;
                    return (
                      <div key={method.id} onClick={() => handlePaymentChange(method.id)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPayment === method.id ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10' : 'border-border hover:border-primary/50 dark:border-border-dark'}`}>
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-primary" />
                          <div>
                            <p className="font-semibold text-text-primary text-sm">{method.name}</p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{formatCurrency(method.fee)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QRIS & COD */}
              <div>
                <h3 className="text-sm font-semibold text-text-secondary dark:text-text-secondary-dark mb-2">Lainnya</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.filter(p => p.type === 'qris' || p.type === 'cod').map((method) => {
                    const Icon = method.icon;
                    return (
                      <div key={method.id} onClick={() => handlePaymentChange(method.id)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedPayment === method.id ? 'border-primary bg-primary/5 dark:border-primary dark:bg-primary/10' : 'border-border hover:border-primary/50 dark:border-border-dark'}`}>
                        <div className="flex items-center gap-3">
                          <Icon className="w-6 h-6 text-primary" />
                          <div>
                            <p className="font-semibold text-text-primary text-sm">{method.name}</p>
                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{formatCurrency(method.fee)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedPayment && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-blue-800 dark:text-blue-200">⏰ <strong>Batas Pembayaran:</strong> 24 jam dari sekarang.</p>
                {paymentMethods.find(p => p.id === selectedPayment)?.type !== 'cod' && (
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">💡 Pembayaran akan dibuka di popup.</p>
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-bold text-text-primary">Ringkasan Pesanan</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-text-secondary dark:text-text-secondary-dark">
                <span>Total Produk</span>
                <span>{formatCurrency(totalPrice || 0)}</span>
              </div>
              <div className="flex justify-between text-text-secondary dark:text-text-secondary-dark">
                <span>Ongkos Kirim</span>
                <span>{shippingCost > 0 ? formatCurrency(shippingCost) : '-'}</span>
              </div>
              <div className="flex justify-between text-text-secondary dark:text-text-secondary-dark">
                <span>Biaya Pembayaran</span>
                <span>{paymentFee > 0 ? formatCurrency(paymentFee) : 'Gratis'}</span>
              </div>
              <div className="border-t border-border dark:border-border-dark pt-3">
                <div className="flex justify-between text-lg font-bold text-text-primary">
                  <span>Total Bayar</span>
                  <span className="text-primary">{formatCurrency(grandTotal || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20">
            <h3 className="font-bold text-text-primary mb-4">Produk ({items.length})</h3>
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {items.map((item: any) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 bg-surface rounded-lg flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden dark:bg-surface/50">
                    {item.product.image ? (
                      <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>🌾</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-text-primary text-sm line-clamp-1">{item.product.name}</p>
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark">{item.quantity} {item.product.unit}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(item.product.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={isProcessing || !selectedCourier || !selectedAddressId || !selectedPayment}
              className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 animate-spin" /><span>Memproses...</span></>
              ) : (
                `Buat Pesanan (${formatCurrency(grandTotal || 0)})`
              )}
            </button>
            {!selectedPayment && <p className="text-xs text-red-500 text-center mt-2 dark:text-red-400">⚠️ Pilih metode pembayaran</p>}
          </div>
        </div>
      </div>

      {/* ✅ PAYMENT MODAL */}
      {showPaymentModal && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={(result) => handlePaymentModalClose(result)}
          snapToken={snapToken}
          orderId={currentOrderId}
        />
      )}
    </div>
  );
}