import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { EstablishmentInfoSections } from './EstablishmentInfoSections';
import { FormSection, SelectField } from '../../../components/form';
import { LocationPickerModal } from '../../location/components/LocationPickerModal';
import { patchEstablishmentRecord } from '../../inspections/establishmentPersistence';
import type { EstablishmentDTO } from '../types';

// EstablishmentInfoSections pulls in components/form's index, which pulls in
// useScrollToInput -> react-native-keyboard-controller's native binding.
// react-native-keyboard-controller ships its own jest mock for exactly this
// situation — see node_modules/react-native-keyboard-controller/jest/index.js
// — same as ReportFilterSheet.test.tsx / ExportReportsTab.test.tsx.
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

// patchEstablishmentRecord opens a real WatermelonDB write, which constructs
// a native adapter at import time — not present under Jest. Mocking the
// whole module keeps the section components' own logic (validation, field
// mapping) under real test while never loading db/database at all.
jest.mock('../../inspections/establishmentPersistence', () => ({
  patchEstablishmentRecord: jest.fn().mockResolvedValue(undefined),
}));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => { r = TestRenderer.create(element); });
  return r;
};

// Every editable section renders its own "Edit"/"Save"/"Cancel" via
// SectionEditActions, so once more than one section can render at once a
// bare findButtonByLabel is no longer unique — this scopes a lookup to one
// FormSection by its title, the same way a caller would visually locate it.
const findSection = (r: Renderer, title: string) => {
  const matches = r.root.findAllByType(FormSection).filter((n) => n.props.title === title);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly 1 FormSection titled "${title}" but found ${matches.length}`);
  }
  return matches[0];
};

const findButtonByLabelWithin = (scope: TestRenderer.ReactTestInstance, label: string) => {
  const matches = scope.findAll(
    (n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === label,
  );
  if (matches.length !== 1) {
    throw new Error(`Expected 1 "${label}" button within the section but found ${matches.length}`);
  }
  return matches[0];
};

const DETAILS_TITLE = 'Establishment Details';

const baseEstablishment: EstablishmentDTO = {
  id: 'row-1',
  estabId: 'estab-1',
  inspectorUid: 'uid-1',
  name: 'Test Facility',
  formerName: null,
  addressLine: '123 Main St',
  barangay: 'Barangay 1',
  city: 'Puerto Princesa',
  province: 'Palawan',
  geoLat: null,
  geoLng: null,
  natureOfBusiness: 'Manufacturing',
  psicCode: null,
  product: null,
  yearEstablished: null,
  operatingStatus: 'Operational',
  operatingHoursDay: null,
  operatingDaysWeek: null,
  operatingDaysYear: null,
  operatingStatusSince: null,
  productLines: [],
  ownerName: 'Owner',
  managingHeadName: 'Manager',
  pcoName: null,
  pcoAccreditationNo: null,
  pcoEffectivity: null,
  phoneFax: '',
  email: '',
  contactPersonName: '',
  contactPersonPosition: '',
  denrPermits: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncStatus: 'synced',
  deviceId: 'device-1',
  isArchived: false,
  complianceTags: [],
  dueReports: null,
};

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EstablishmentInfoSections canEdit gating', () => {
  it('renders an Edit control on every content section when canEdit is true', () => {
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit onSaved={noop} />);
    // Details, Key Personnel, Pollution Control Officer, Product Lines and
    // DENR Permits - permits became the fifth editable section when it
    // stopped being read-only behind a stub.
    expect(
      r.root.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Edit'),
    ).toHaveLength(5);
  });

  it('renders no Edit control on any content section when canEdit is false', () => {
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit={false} onSaved={noop} />);
    expect(
      r.root.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Edit'),
    ).toHaveLength(0);
  });
});

// The Establishment Details section is the one that used to gate its save on
// name/barangay/city/province all being non-empty (EditEstablishmentScreen.
// handleSave, before this convergence). That validation had to move into
// this section's own onSave — nothing else enforces it — so it's exercised
// here against the real component, not a mocked hook, to prove the actual
// wiring blocks (or allows) the write.
describe('EstablishmentInfoSections Establishment Details validation', () => {
  const startEditingDetails = (r: Renderer) => {
    const section = findSection(r, DETAILS_TITLE);
    TestRenderer.act(() => {
      findButtonByLabelWithin(section, 'Edit').props.onPress();
    });
    return findSection(r, DETAILS_TITLE);
  };

  const findNameInput = (section: TestRenderer.ReactTestInstance) => {
    const matches = section.findAll(
      (n) => n.type === TextInput && n.props.value === baseEstablishment.name,
    );
    if (matches.length !== 1) {
      throw new Error(`Expected exactly 1 name TextInput but found ${matches.length}`);
    }
    return matches[0];
  };

  it('blocks the save and shows an error when the name is cleared, without writing', async () => {
    const onSaved = jest.fn();
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit onSaved={onSaved} />);
    let section = startEditingDetails(r);

    TestRenderer.act(() => {
      findNameInput(section).props.onChangeText('');
    });
    section = findSection(r, DETAILS_TITLE);
    // save() is async even on the validation-failure path (it's an async
    // onSave that throws), so the sync act() above would return before the
    // catch handler's setError has actually run — await the async act
    // instead, matching the successful-save test below.
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });

    expect(patchEstablishmentRecord).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    const errorText = section
      .findAll((n) => n.type === Text)
      .find((n) => typeof n.props.children === 'string' && n.props.children.includes('are required'));
    expect(errorText).toBeDefined();
  });

  it('patches only the Details fields and calls onSaved once validation passes', async () => {
    const onSaved = jest.fn();
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit onSaved={onSaved} />);
    let section = startEditingDetails(r);

    TestRenderer.act(() => {
      findNameInput(section).props.onChangeText('RENAMED FACILITY');
    });
    section = findSection(r, DETAILS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });

    expect(patchEstablishmentRecord).toHaveBeenCalledTimes(1);
    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: expect.objectContaining({ name: 'RENAMED FACILITY', barangay: 'Barangay 1', city: 'Puerto Princesa', province: 'Palawan' }),
    });
    // Fields owned by other sections must not leak into a Details save.
    const [callArgs] = (patchEstablishmentRecord as jest.Mock).mock.calls[0];
    expect(callArgs.fields).not.toHaveProperty('ownerName');
    expect(callArgs.fields).not.toHaveProperty('pcoName');
    expect(callArgs.fields).not.toHaveProperty('productLines');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows the coordinates read-only with no Pin on map button until editing starts', () => {
    const r = render(
      <EstablishmentInfoSections establishment={{ ...baseEstablishment, geoLat: 11.144, geoLng: 119.395 }} canEdit onSaved={jest.fn()} />,
    );
    const section = findSection(r, DETAILS_TITLE);
    const values = section.findAll((n) => n.type === Text).map((n) => n.props.children);
    expect(values).toEqual(expect.arrayContaining(['11.144', '119.395']));
    expect(section.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map')).toHaveLength(0);
  });

  it('patches edited coordinates as numbers, and empty ones as null', async () => {
    const onSaved = jest.fn();
    const r = render(<EstablishmentInfoSections establishment={baseEstablishment} canEdit onSaved={onSaved} />);
    let section = startEditingDetails(r);
    expect(section.findAll((n) => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map')).toHaveLength(1);

    const latInput = section.findAll((n) => n.type === TextInput && n.props.placeholder === 'e.g. 11.144')[0];
    TestRenderer.act(() => {
      latInput.props.onChangeText('11.144988');
    });
    section = findSection(r, DETAILS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });

    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: expect.objectContaining({ geoLat: 11.144988, geoLng: null }),
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('fills Province, City and Barangay from a confirmed pin and leaves the address line alone', async () => {
    const onSaved = jest.fn();
    const r = render(
      <EstablishmentInfoSections
        establishment={{ ...baseEstablishment, addressLine: '2713 Zamora St.', province: 'Romblon', city: 'Odiongan', barangay: 'Dapawan' }}
        canEdit
        onSaved={onSaved}
      />,
    );
    let section = startEditingDetails(r);
    await TestRenderer.act(async () => {
      section.findByType(LocationPickerModal).props.onConfirm({
        lat: 9.45777,
        lng: 118.47504,
        address: { province: 'Palawan', city: 'Aborlan', barangay: 'Cabigaan' },
      });
    });
    section = findSection(r, DETAILS_TITLE);
    const selectValues = Object.fromEntries(section.findAllByType(SelectField).map(n => [n.props.label, n.props.value]));
    expect(selectValues).toMatchObject({ Province: 'Palawan', 'City / Municipality': 'Aborlan', Barangay: 'Cabigaan' });
    const addressInput = section.findAll(n => n.type === TextInput && n.props.placeholder === 'Street / building / lot no. (if known)')[0];
    expect(addressInput.props.value).toBe('2713 Zamora St.');

    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });
    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: expect.objectContaining({
        province: 'Palawan',
        city: 'Aborlan',
        barangay: 'Cabigaan',
        geoLat: 9.45777,
        geoLng: 118.47504,
        addressLine: '2713 Zamora St.',
      }),
    });
  });

  it('keeps the dropdowns when the confirmed pin has no barangay', async () => {
    const r = render(
      <EstablishmentInfoSections establishment={{ ...baseEstablishment, province: 'Romblon', city: 'Odiongan', barangay: 'Dapawan' }} canEdit onSaved={jest.fn()} />,
    );
    let section = startEditingDetails(r);
    await TestRenderer.act(async () => {
      section.findByType(LocationPickerModal).props.onConfirm({ lat: 12, lng: 120.5, address: null });
    });
    section = findSection(r, DETAILS_TITLE);
    const selectValues = Object.fromEntries(section.findAllByType(SelectField).map(n => [n.props.label, n.props.value]));
    expect(selectValues).toMatchObject({ Province: 'Romblon', 'City / Municipality': 'Odiongan', Barangay: 'Dapawan' });
  });
});

// Permits were the one section the 2026-09-05 convergence left read-only,
// behind a stubbed Edit. They now edit in place like the other four,
// writing the establishment's own denrPermits - which feeds reports created
// afterwards, while reports already filed keep the permits they recorded.
describe('EstablishmentInfoSections DENR permits editing', () => {
  const PERMITS_TITLE = 'DENR Permits, Licenses & Clearances';

  const withPermits = {
    ...baseEstablishment,
    denrPermits: [
      {
        envi_law: 'RA 9275',
        permit_type: 'Discharge Permit',
        permit_serial: 'DP-1',
        issued_date: '2026-01-01',
        expiry_date: '2027-01-01',
      },
    ],
  };

  it('offers an Edit control on the permits section when the viewer can edit', () => {
    const r = render(<EstablishmentInfoSections establishment={withPermits} canEdit onSaved={jest.fn()} />);
    expect(findButtonByLabelWithin(findSection(r, PERMITS_TITLE), 'Edit')).toBeDefined();
  });

  it('saves the permits onto the establishment, not onto any report', async () => {
    const onSaved = jest.fn();
    const r = render(<EstablishmentInfoSections establishment={withPermits} canEdit onSaved={onSaved} />);
    let section = findSection(r, PERMITS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Edit').props.onPress();
    });
    section = findSection(r, PERMITS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });

    expect(patchEstablishmentRecord).toHaveBeenCalledWith({
      estabId: 'estab-1',
      fields: { denrPermits: withPermits.denrPermits },
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('adds a blank permit to the draft without saving it', async () => {
    const r = render(<EstablishmentInfoSections establishment={withPermits} canEdit onSaved={jest.fn()} />);
    let section = findSection(r, PERMITS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Edit').props.onPress();
    });
    section = findSection(r, PERMITS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Add Permit').props.onPress();
    });
    expect(patchEstablishmentRecord).not.toHaveBeenCalled();
    section = findSection(r, PERMITS_TITLE);
    await TestRenderer.act(async () => {
      findButtonByLabelWithin(section, 'Save').props.onPress();
    });
    const [call] = (patchEstablishmentRecord as jest.Mock).mock.calls[0];
    expect(call.fields.denrPermits).toHaveLength(2);
  });
});
