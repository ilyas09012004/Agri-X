// src/contexts/LocationContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Province {
  code: string;
  name: string;
}

interface Regency {
  code: string;
  name: string;
  province_code: string;
  province: string;
}

interface District {
  code: string;
  name: string;
  regency_code: string;
  regency: string;
  province_code: string;
  province: string;
}

interface Village {
  code: string;
  name: string;
  district_code: string;
  district: string;
  regency_code: string;
  regency: string;
  province_code: string;
  province: string;
  postal_codes?: string[];
}

interface LocationContextType {
  provinces: Province[];
  regencies: Regency[];
  districts: District[];
  villages: Village[];
  isLoading: boolean;
  error: string | null;
  fetchProvinces: () => Promise<void>;
  fetchRegencies: (provinceCode: string) => Promise<void>;
  fetchDistricts: (regencyCode: string) => Promise<void>;
  fetchVillages: (districtCode: string) => Promise<void>;
  clearLocations: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const API_BASE = 'https://use.api.co.id/regional/indonesia';
const API_KEY = process.env.NEXT_PUBLIC_API_CO_ID_KEY || '';

export function LocationProvider({ children }: { children: ReactNode }) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProvinces = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch(`${API_BASE}/provinces`, {
        headers: {
          'x-api-co-id': API_KEY,
        },
      });

      if (!res.ok) throw new Error('Gagal mengambil provinsi');
      
      const data = await res.json();
      setProvinces(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRegencies = useCallback(async (provinceCode: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setRegencies([]);
      setDistricts([]);
      setVillages([]);
      
      const res = await fetch(`${API_BASE}/provinces/${provinceCode}/regencies`, {
        headers: {
          'x-api-co-id': API_KEY,
        },
      });

      if (!res.ok) throw new Error('Gagal mengambil kabupaten/kota');
      
      const data = await res.json();
      setRegencies(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDistricts = useCallback(async (regencyCode: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setDistricts([]);
      setVillages([]);
      
      const res = await fetch(`${API_BASE}/regencies/${regencyCode}/districts`, {
        headers: {
          'x-api-co-id': API_KEY,
        },
      });

      if (!res.ok) throw new Error('Gagal mengambil kecamatan');
      
      const data = await res.json();
      setDistricts(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVillages = useCallback(async (districtCode: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const res = await fetch(`${API_BASE}/districts/${districtCode}/villages`, {
        headers: {
          'x-api-co-id': API_KEY,
        },
      });

      if (!res.ok) throw new Error('Gagal mengambil kelurahan');
      
      const data = await res.json();
      setVillages(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearLocations = useCallback(() => {
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    setError(null);
  }, []);

  return (
    <LocationContext.Provider
      value={{
        provinces,
        regencies,
        districts,
        villages,
        isLoading,
        error,
        fetchProvinces,
        fetchRegencies,
        fetchDistricts,
        fetchVillages,
        clearLocations,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocations() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocations must be used within a LocationProvider');
  }
  return context;
}