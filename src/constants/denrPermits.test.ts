import { ENVIRONMENTAL_LAWS, getPermitTypeOptions } from './denrPermits';
import { permitRowFor } from '../features/export/mappers/common';

describe('ENVIRONMENTAL_LAWS', () => {
  it('lists the four laws EMB issues establishment permits under', () => {
    expect(ENVIRONMENTAL_LAWS).toEqual(['PD 1586', 'RA 8749', 'RA 9275', 'RA 6969']);
  });
});

describe('getPermitTypeOptions', () => {
  it('returns the permits issued under the given law', () => {
    expect(getPermitTypeOptions('RA 9275')).toEqual(['Discharge Permit']);
    expect(getPermitTypeOptions('RA 8749')).toEqual(['Permit to Operate']);
  });

  it('returns several options for a law with more than one permit', () => {
    expect(getPermitTypeOptions('PD 1586')).toContain('ECC');
    expect(getPermitTypeOptions('RA 6969')).toContain('Permit to Transport');
  });

  it('returns nothing when no law is chosen yet, so the field stays empty', () => {
    expect(getPermitTypeOptions('')).toEqual([]);
  });

  it('returns nothing for a law it does not know', () => {
    expect(getPermitTypeOptions('RA 9003')).toEqual([]);
  });
});

// The DOCX export pins each permit to a printed row by regex-matching its
// type and law (see PERMIT_MATCHERS in features/export/mappers/common.ts).
// A permit that matches no row is silently dropped from the exported form,
// so every option these dropdowns offer must land on a row. This is what
// makes a curated list safer than the free text it replaces.
describe('every offered permit reaches a printed export row', () => {
  it.each(
    ENVIRONMENTAL_LAWS.flatMap(law =>
      getPermitTypeOptions(law).map(permitType => [law, permitType] as const),
    ),
  )('%s / %s', (envi_law, permit_type) => {
    expect(
      permitRowFor({ envi_law, permit_type, permit_serial: '', issued_date: '', expiry_date: '' }),
    ).not.toBeNull();
  });
});
