// src/app/api/rajaongkir/estimate/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin_village_code, destination_village_code, weight } = body;

    if (!origin_village_code || !destination_village_code || !weight) {
      return NextResponse.json(
        { success: false, error: 'Data tidak lengkap.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.API_CO_ID_KEY;
    if (!apiKey) {
      console.error('❌ API Key Missing');
      return NextResponse.json(
        { success: false, error: 'Konfigurasi server salah (API Key hilang).' },
        { status: 500 }
      );
    }

    // Request ke API Eksternal
    const url = `https://use.api.co.id/expedition/shipping-cost?origin_village_code=${origin_village_code}&destination_village_code=${destination_village_code}&weight=${weight}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-co-id': apiKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`External API Error: ${response.status} - ${errText}`);
    }

    const rawData = await response.json();
    
    // ✅ DEBUG: Lihat struktur asli di console terminal server
    // console.log('RAW API RESPONSE:', JSON.stringify(rawData, null, 2));

    // Validasi struktur response (sesuaikan dengan dokumentasi api.co.id)
    // Biasanya: { is_success: true, data: { couriers: [...] } }
    if (!rawData.is_success || !rawData.data || !rawData.data.couriers) {
       // Fallback jika struktur beda, coba cek array langsung di data
       if (Array.isArray(rawData.data)) {
          // Handle jika data langsung array
       } else {
          throw new Error('Format response API tidak dikenali.');
       }
    }

    const couriers = rawData.data.couriers;

    // Format ulang agar konsisten dengan frontend
    const formattedData = couriers.map((item: any) => ({
      code: item.courier_code || item.code || 'unknown',
      service: item.courier_name || item.service || 'Layanan Tidak Dikenal',
      value: item.price || 0,
      etd: item.estimation || '-',
      description: `${item.courier_name} (${item.estimation})`
    }));

    return NextResponse.json({
      success: true,
      formattedData
    });

  } catch (error: any) {
    console.error('❌ Ongkir Error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghitung ongkir' },
      { status: 500 }
    );
  }
}