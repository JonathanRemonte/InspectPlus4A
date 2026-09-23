import React from 'react';
import TestRenderer from 'react-test-renderer';
import { DenrPermitsFormSection } from './DenrPermitsFormSection';
import { SelectField } from '../../../components/form';
import { ENVIRONMENTAL_LAWS, getPermitTypeOptions } from '../../../constants/denrPermits';
import type { PermitSnapshotItem } from '../../../services/sync/syncTypes';

// FormSection -> useScrollToInput -> react-native-keyboard-controller's
// native binding, absent under Jest.
jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

type Renderer = TestRenderer.ReactTestRenderer;

// Async act: @expo/vector-icons' Icon sets state when its font resolves,
// which lands after a synchronous act() and warns.
const render = async (element: React.ReactElement) => {
  let r!: Renderer;
  await TestRenderer.act(async () => { r = TestRenderer.create(element); });
  return r;
};

const selectByLabel = (r: Renderer, label: string) => {
  const matches = r.root.findAllByType(SelectField).filter(n => n.props.label === label);
  if (matches.length !== 1) throw new Error(`Expected 1 "${label}" SelectField, found ${matches.length}`);
  return matches[0];
};

const permit = (over: Partial<PermitSnapshotItem> = {}): PermitSnapshotItem => ({
  envi_law: '',
  permit_type: '',
  permit_serial: '',
  issued_date: '',
  expiry_date: '',
  ...over,
});

describe('DenrPermitsFormSection law/permit cascade', () => {
  it('offers the environmental laws as a picker rather than free text', async () => {
    const r = await render(<DenrPermitsFormSection value={[permit()]} onChange={jest.fn()} />);
    expect(selectByLabel(r, 'Environmental Law').props.options).toEqual([...ENVIRONMENTAL_LAWS]);
  });

  it('locks Permit Type until a law is chosen', async () => {
    const r = await render(<DenrPermitsFormSection value={[permit()]} onChange={jest.fn()} />);
    const permitType = selectByLabel(r, 'Permit Type');
    expect(permitType.props.disabled).toBe(true);
    expect(permitType.props.options).toEqual([]);
  });

  it('offers only the permits issued under the chosen law', async () => {
    const r = await render(<DenrPermitsFormSection value={[permit({ envi_law: 'RA 6969' })]} onChange={jest.fn()} />);
    const permitType = selectByLabel(r, 'Permit Type');
    expect(permitType.props.disabled).toBeFalsy();
    expect(permitType.props.options).toEqual(getPermitTypeOptions('RA 6969'));
  });

  it('clears a permit type that belonged to the previous law', async () => {
    const onChange = jest.fn();
    const r = await render(
      <DenrPermitsFormSection
        value={[permit({ envi_law: 'RA 8749', permit_type: 'Permit to Operate' })]}
        onChange={onChange}
      />,
    );
    TestRenderer.act(() => selectByLabel(r, 'Environmental Law').props.onSelect('RA 9275'));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ envi_law: 'RA 9275', permit_type: '' })]);
  });

  it('keeps the chosen permit type when the law is unchanged', async () => {
    const onChange = jest.fn();
    const r = await render(
      <DenrPermitsFormSection
        value={[permit({ envi_law: 'RA 8749', permit_type: 'Permit to Operate' })]}
        onChange={onChange}
      />,
    );
    TestRenderer.act(() => selectByLabel(r, 'Permit Type').props.onSelect('Permit to Operate'));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ envi_law: 'RA 8749', permit_type: 'Permit to Operate' }),
    ]);
  });
});
