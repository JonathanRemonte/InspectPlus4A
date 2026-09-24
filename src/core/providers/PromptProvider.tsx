import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../design/colors';
import { Radius } from '../../design/radius';
import { Spacing } from '../../design/spacing';
import { Type } from '../../design/typography';
import {
  registerPromptHandler,
  type PromptAction,
  type PromptRequest,
  type PromptVariant,
} from '../../services/prompt/promptService';

// A notice with no actions still needs a way out.
const DISMISS_ACTION: PromptAction = { id: 'ok', label: 'OK', variant: 'default' };

interface Pending {
  request: PromptRequest;
  resolve: (id: string | null) => void;
}

// Mounts the app's single prompt surface and wires it to showPrompt. The
// chrome matches SyncOptionsModal - navy header, green rule, close button,
// footer buttons - so a confirm reads like the rest of the app instead of
// like an OS alert.
export const PromptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    registerPromptHandler((request, resolve) => setPending({ request, resolve }));
    return () => registerPromptHandler(null);
  }, []);

  // Every exit routes through here so the promise always settles exactly
  // once and the modal always closes.
  const answer = useCallback((id: string | null) => {
    setPending(current => {
      current?.resolve(id);
      return null;
    });
  }, []);

  const request = pending?.request;
  const actions = request?.actions?.length ? request.actions : [DISMISS_ACTION];
  const danger = request?.tone === 'danger';

  return (
    <>
      {children}
      {request && (
        <Modal visible transparent animationType="fade" onRequestClose={() => answer(null)}>
          {/* Backdrop dismisses, matching SyncOptionsModal; the inner
              no-op claims taps on the card itself. */}
          <TouchableWithoutFeedback onPress={() => answer(null)}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.card}>
                  <View style={[styles.header, danger && styles.headerDanger]}>
                    <View style={styles.headerTitleRow}>
                      <Ionicons
                        name={danger ? 'alert-circle-outline' : 'information-circle-outline'}
                        size={16}
                        color={Colors.textWhite}
                      />
                      <Text style={styles.headerTitle}>{request.title}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => answer(null)}
                      style={styles.closeBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Close">
                      <Ionicons name="close" size={16} color={Colors.textWhite} />
                    </TouchableOpacity>
                  </View>

                  {request.message && (
                    <View style={styles.body}>
                      <Text style={styles.message}>{request.message}</Text>
                    </View>
                  )}

                  <View style={styles.footer}>
                    {actions.map(action => {
                      const variant = BUTTON_STYLE[action.variant ?? 'default'];
                      return (
                        <TouchableOpacity
                          key={action.id}
                          style={[styles.btn, variant.button]}
                          onPress={() => answer(action.id)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={action.label}>
                          <Text style={[styles.btnText, variant.label]}>{action.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.navy,
    borderBottomWidth: 3,
    borderBottomColor: Colors.green,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerDanger: {
    borderBottomColor: Colors.conflict,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: Type.subheading.fontSize,
    lineHeight: Type.subheading.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
    flexShrink: 1,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: Colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.lg,
  },
  message: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  btn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  btnText: {
    fontSize: Type.bodySm.fontSize,
    lineHeight: Type.bodySm.lineHeight,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: Colors.bgLight,
  },
  cancelText: {
    color: Colors.navy,
  },
  defaultBtn: {
    backgroundColor: Colors.green,
  },
  defaultText: {
    color: Colors.textWhite,
  },
  dangerBtn: {
    backgroundColor: Colors.conflict,
  },
  dangerText: {
    color: Colors.textWhite,
  },
});

// Declared after `styles` because it reads from it; only ever dereferenced
// during render, which runs later still.
const BUTTON_STYLE: Record<PromptVariant, { button: object; label: object }> = {
  cancel: { button: styles.cancelBtn, label: styles.cancelText },
  default: { button: styles.defaultBtn, label: styles.defaultText },
  danger: { button: styles.dangerBtn, label: styles.dangerText },
};
