import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Radius } from '../design/radius';
import { Spacing } from '../design/spacing';
import { showPrompt, type PromptVariant } from '../services/prompt/promptService';

export interface RowAction {
  id: string;
  label: string;
  variant?: PromptVariant;
  onSelect: () => void;
}

interface RowActionsButtonProps {
  // Names the menu, so an inspector can see which row they opened it on.
  title: string;
  // Callers pass only the actions this user may take on this row; an empty
  // list renders no control at all rather than an empty menu.
  actions: RowAction[];
}

// The overflow control on a list row. It replaced swipe-to-reveal, which
// was invisible until discovered and fought the home screen's horizontal
// tab pager for the same drags.
export const RowActionsButton: React.FC<RowActionsButtonProps> = ({ title, actions }) => {
  const open = useCallback(async () => {
    const choice = await showPrompt({
      title,
      layout: 'list',
      actions: [
        ...actions.map(({ id, label, variant }) => ({ id, label, variant })),
        { id: 'cancel', label: 'Cancel', variant: 'cancel' as const },
      ],
    });
    // Dismissing resolves null, and Cancel matches no row action, so both
    // fall through to doing nothing.
    actions.find(action => action.id === choice)?.onSelect();
  }, [actions, title]);

  if (actions.length === 0) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={open}
      activeOpacity={0.7}
      // The row itself is the surrounding touch target, so this needs room
      // of its own to be hit reliably without opening the record.
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="More actions">
      <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
});
