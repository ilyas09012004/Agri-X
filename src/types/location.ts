export interface Province {
  code: string;
  name: string;
}

export interface Regency {
  code: string;
  name: string;
  province_code: string;
  province: string;
}

export interface District {
  code: string;
  name: string;
  regency_code: string;
  regency: string;
  province_code: string;
  province: string;
}

export interface Village {
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

export interface LocationContextType {
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