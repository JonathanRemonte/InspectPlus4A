import type React from 'react';
import type { SvgProps } from 'react-native-svg';
import { REPORT_TYPES } from '../../constants/reportTypes';
import { DATA_KEY_TO_CREATE_KEY, type ReportDataKey } from '../../region';
import { Colors } from '../../constants/colors';

export interface ReportTypeMeta {
  label: string;
  law: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  // The Ionicons glyph the list card's tile uses for this type, so a report
  // can wear the same glyph on its own screen as it does in the list.
  iconName: string;
  iconAsset?: React.FC<SvgProps>;
}

export function getReportTypeMeta(reportType: string): ReportTypeMeta {
  const key = DATA_KEY_TO_CREATE_KEY[reportType as ReportDataKey];
  const found = key ? REPORT_TYPES.find(t => t.key === key) : undefined;
  if (found) {
    return {
      label: found.title,
      law: found.law,
      textColor: found.textColor,
      bgColor: found.bgColor,
      borderColor: found.borderColor,
      iconName: found.iconName,
      iconAsset: found.iconAsset,
    };
  }
  return {
    label: reportType,
    law: '',
    textColor: Colors.textMuted,
    bgColor: Colors.bgLight,
    borderColor: Colors.border,
    iconName: 'document-outline',
  };
}
