import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../design/colors';
import { Elevation } from '../design/elevation';
import { Radius } from '../design/radius';
import { Spacing } from '../design/spacing';
import { Type } from '../design/typography';
import { popoverPosition, type AnchorRect } from './popoverPosition';

export type RowActionVariant = 'default' | 'danger';

export interface RowAction {
  id: string;
  label: string;
  variant?: RowActionVariant;
  onSelect: () => void;
}

interface RowActionsButtonProps {
  // Kept for the control's accessibility label, so a screen reader says
  // which row's actions these are. The popover itself shows no title - an
  // anchored menu is already tied to its row visually.
  title: string;
  // Callers pass only the actions this user may take on this row; an empty
  // list renders no control at all rather than an empty menu.
  actions: RowAction[];
}

// The menu is sized from its content rather than measured, so it can be
// placed in the same frame it opens - one measure pass, no flicker.
const MENU_WIDTH = 180;
const ROW_HEIGHT = 44;

// The overflow control on a list row. It replaced swipe-to-reveal, which was
// invisible until discovered and fought the home screen's horizontal tab
// pager for the same drags.
export const RowActionsButton: React.FC<RowActionsButtonProps> = ({ title, actions }) => {
  const buttonRef = useRef<View>(null);
  // Opening and placing are separate: the menu opens on the press, and
  // moves to the button once the measurement arrives. Tying the two
  // together would mean a platform that declines to measure - or measures
  // late - shows nothing at all.
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const openMenu = useCallback(() => {
    setOpen(true);
    buttonRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const choose = useCallback((action: RowAction) => {
    // Close first: the action often opens a confirm prompt, and the popover
    // should be gone rather than stacked underneath it.
    setOpen(false);
    setAnchor(null);
    action.onSelect();
  }, []);

  if (actions.length === 0) return null;

  const screen = Dimensions.get('window');
  const menu = { width: MENU_WIDTH, height: actions.length * ROW_HEIGHT + Spacing.xs * 2 };
  // Until the button reports where it is, sit against the top-right corner -
  // the corner these buttons live nearest - rather than not rendering.
  const fallbackAnchor: AnchorRect = { x: screen.width, y: 0, width: 0, height: 0 };
  const placement = open ? popoverPosition({ anchor: anchor ?? fallbackAnchor, menu, screen }) : null;

  return (
    <View ref={buttonRef} collapsable={false}>
      <TouchableOpacity
        style={styles.button}
        onPress={openMenu}
        activeOpacity={0.7}
        // The row itself is the surrounding touch target, so this needs room
        // of its own to be hit reliably without opening the record.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="More actions">
        <Ionicons name="ellipsis-vertical" size={18} color={Colors.textMuted} />
      </TouchableOpacity>

      {placement && (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
          {/* Tapping outside is how an anchored menu is dismissed, which is
              why there is no Cancel row inside it. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
          />
          <View style={[styles.menu, { width: menu.width, top: placement.top, left: placement.left }]}>
            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={styles.menuRow}
                onPress={() => choose(action)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={action.label}>
                <Text style={[styles.menuLabel, action.variant === 'danger' && styles.menuLabelDanger]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  menu: {
    position: 'absolute',
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Elevation.overlay,
  },
  menuRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  menuLabel: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  menuLabelDanger: {
    color: Colors.conflict,
  },
});
