import type { ResolvedAddress } from './resolveAddress';

// The three dropdown fields a confirmed pin overwrites — as a partial so
// each form spreads it into its own state shape. Undefined address (a
// typed edit) or null address (pin outside every barangay) changes nothing.
export function addressPatch(address: ResolvedAddress | null | undefined): {
  province?: string;
  city?: string;
  barangay?: string;
} {
  if (!address) return {};
  return { province: address.province, city: address.city, barangay: address.barangay };
}
