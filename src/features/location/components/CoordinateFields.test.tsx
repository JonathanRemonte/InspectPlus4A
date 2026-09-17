import React from 'react';
import { TextInput, TouchableOpacity } from 'react-native';
import TestRenderer from 'react-test-renderer';
import { CoordinateFields } from './CoordinateFields';
import { LocationPickerModal } from './LocationPickerModal';

jest.mock('react-native-keyboard-controller', () => jest.requireActual('react-native-keyboard-controller/jest'));

type Renderer = TestRenderer.ReactTestRenderer;

const render = (element: React.ReactElement) => {
  let r!: Renderer;
  TestRenderer.act(() => {
    r = TestRenderer.create(element);
  });
  return r;
};

const pinButtons = (r: Renderer) =>
  r.root.findAll(n => n.type === TouchableOpacity && n.props?.accessibilityLabel === 'Pin on map');

describe('CoordinateFields', () => {
  it('renders both values as numeric inputs and a Pin on map button', () => {
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={jest.fn()} packName="estab:pending" />);
    const inputs = r.root.findAllByType(TextInput);
    expect(inputs.map(i => i.props.value)).toEqual(['11.144', '119.395']);
    expect(inputs.every(i => i.props.keyboardType === 'numeric')).toBe(true);
    expect(pinButtons(r)).toHaveLength(1);
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('forwards typed edits one field at a time', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={onChange} packName="estab:pending" />);
    const [latInput, lngInput] = r.root.findAllByType(TextInput);
    TestRenderer.act(() => latInput.props.onChangeText('12'));
    expect(onChange).toHaveBeenLastCalledWith({ lat: '12', lng: '119.395' });
    TestRenderer.act(() => lngInput.props.onChangeText('121'));
    expect(onChange).toHaveBeenLastCalledWith({ lat: '11.144', lng: '121' });
  });

  it('opens the picker with the current values and writes the confirmed pin back as strings', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={onChange} packName="estab:abc" />);
    TestRenderer.act(() => pinButtons(r)[0].props.onPress());
    const picker = r.root.findByType(LocationPickerModal);
    expect(picker.props.visible).toBe(true);
    expect(picker.props.initialLat).toBe('11.144');
    expect(picker.props.initialLng).toBe('119.395');
    expect(picker.props.packName).toBe('estab:abc');
    TestRenderer.act(() => picker.props.onConfirm({ lat: 11.144988, lng: 119.395123 }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ lat: '11.144988', lng: '119.395123' });
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('closes the picker on cancel without changing anything', () => {
    const onChange = jest.fn();
    const r = render(<CoordinateFields lat="" lng="" onChange={onChange} packName="estab:pending" />);
    TestRenderer.act(() => pinButtons(r)[0].props.onPress());
    TestRenderer.act(() => r.root.findByType(LocationPickerModal).props.onCancel());
    expect(onChange).not.toHaveBeenCalled();
    expect(r.root.findByType(LocationPickerModal).props.visible).toBe(false);
  });

  it('hides the button and renders display fields when read-only', () => {
    const r = render(<CoordinateFields lat="11.144" lng="119.395" onChange={jest.fn()} packName="estab:abc" readOnly />);
    expect(pinButtons(r)).toHaveLength(0);
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
    expect(r.root.findAllByType(LocationPickerModal)).toHaveLength(0);
  });

  it('shows an em dash for an empty read-only value', () => {
    const r = render(<CoordinateFields lat="" lng="" onChange={jest.fn()} packName="estab:abc" readOnly />);
    const dashes = r.root.findAll(n => typeof n.props.children === 'string' && n.props.children === '—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
