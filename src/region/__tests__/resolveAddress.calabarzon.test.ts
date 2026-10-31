import { region } from '..';
import { formatResolvedAddress, resolveAddress } from '../../features/location/resolveAddress';

// One point per province, inside each named city.
describe('resolveAddress in CALABARZON', () => {
  it.each([
    [14.2117, 121.1653, 'Laguna'], // Calamba City hall area
    [13.7565, 121.0583, 'Batangas'], // Batangas City
    [14.4791, 120.8970, 'Cavite'], // Cavite City
    [13.9373, 121.6170, 'Quezon'], // Lucena City
    [14.5865, 121.1753, 'Rizal'], // Antipolo City
  ])('places %f, %f in %s', (lat, lng, province) => {
    const address = resolveAddress(lat, lng);
    expect(address?.province).toBe(province);
    expect(region.locations.locations[province][address!.city]).toContain(address!.barangay);
  });

  it('labels a point in the sea as outside CALABARZON', () => {
    expect(resolveAddress(13.0, 120.0)).toBeNull();
    expect(formatResolvedAddress(null)).toBe('Outside CALABARZON barangay boundaries');
  });
});
