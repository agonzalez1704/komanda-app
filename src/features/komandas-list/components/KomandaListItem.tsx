import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { KomandaCard } from '@/components/KomandaCard';
import { Button, SwipeAction, Text, swipeActionsWrapStyle } from '@/components/ui';
import {
  blockReasonMessage,
  canCancelKomanda,
  canTransitionStatus,
  effectiveStatus,
  transitionBlockedReason,
  type ManualStatus,
} from '@/domain/komandaStatus';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import { useCancelKomanda } from '@/mutations/useCancelKomanda';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { color, fontWeight, radius, space } from '@/theme/tokens';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from '../hooks/useKomandasData';

/**
 * Wraps KomandaCard with swipe gestures.
 *   Left-to-right (renderLeftActions): "Cancelar" — opens a note sheet.
 *   Right-to-left (renderRightActions): status transitions.
 */
export function KomandaListItem({
  komanda,
  stats,
  onOpen,
}: {
  komanda: KomandaRowT;
  stats: KomandaStats;
  onOpen: (k: KomandaRowT) => void;
}) {
  const running =
    komanda.status === 'closed'
      ? komanda.total_cents ?? stats.total
      : stats.total;

  const swipeRef = useRef<SwipeableMethods>(null);
  const router = useRouter();
  const updateStatus = useUpdateStatus();
  const cancelKomanda = useCancelKomanda();
  const me = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState('');

  const status = effectiveStatus(komanda.status);
  const cancellable = canCancelKomanda(komanda.status);
  const actions: { key: ManualStatus; label: string; icon: 'checkmark-circle-outline' | 'time-outline' | 'card-outline'; tone: 'success' | 'info' | 'primary' }[] = [];
  if (canTransitionStatus(komanda.status, 'served')) {
    actions.push({ key: 'served', label: 'Servir', icon: 'checkmark-circle-outline', tone: 'success' });
  }
  if (canTransitionStatus(komanda.status, 'pending')) {
    actions.push({ key: 'pending', label: 'Más', icon: 'time-outline', tone: 'info' });
  }
  if (canTransitionStatus(komanda.status, 'closed')) {
    actions.push({ key: 'closed', label: 'Cobrar', icon: 'card-outline', tone: 'primary' });
  }

  function go(next: ManualStatus) {
    const blocked = transitionBlockedReason(komanda.status, next, {
      itemCount: stats.count,
    });
    if (blocked) {
      swipeRef.current?.close();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {},
      );
      Alert.alert('No se puede', blockReasonMessage(blocked), [
        { text: 'Entendido' },
      ]);
      return;
    }
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (next === 'closed') {
      router.push(`/(app)/komandas/${komanda.id}/close` as const);
      return;
    }
    updateStatus.mutate({ komanda_id: komanda.id, status: next });
  }

  function openCancelSheet() {
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setNote('');
    setCancelOpen(true);
  }

  function closeCancelSheet() {
    setCancelOpen(false);
    setNote('');
  }

  async function confirmCancel() {
    const trimmed = note.trim();
    if (trimmed.length === 0) return;
    const uid = me.data?.auth_user_id;
    if (!uid) {
      Alert.alert('No se puede', 'No se pudo identificar al usuario.', [
        { text: 'Entendido' },
      ]);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    await cancelKomanda.mutateAsync({
      komanda_id: komanda.id,
      cancelled_by_auth_user_id: uid,
      cancellation_note: trimmed,
    });
    closeCancelSheet();
  }

  return (
    <>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={2}
        rightThreshold={40}
        leftThreshold={40}
        overshootRight={false}
        overshootLeft={false}
        enableTrackpadTwoFingerGesture
        enabled={
          (actions.length > 0 && status !== 'closed' && status !== 'cancelled') ||
          cancellable
        }
        renderRightActions={(progress) => (
          <View style={swipeActionsWrapStyle}>
            {actions.map((a, i) => (
              <SwipeAction
                key={a.key}
                progress={progress}
                order={i}
                onPress={() => go(a.key)}
                label={a.label}
                icon={a.icon}
                tone={a.tone}
                accessibilityLabel={`Mark komanda ${komanda.number ?? ''} as ${a.label}`}
              />
            ))}
          </View>
        )}
        renderLeftActions={
          cancellable
            ? (progress) => (
                <View style={swipeActionsWrapStyle}>
                  <SwipeAction
                    progress={progress}
                    order={0}
                    onPress={openCancelSheet}
                    label="Cancelar"
                    icon="trash-outline"
                    tone="danger"
                    accessibilityLabel={`Cancelar komanda ${komanda.number ?? ''}`}
                  />
                </View>
              )
            : undefined
        }
      >
        <KomandaCard
          k={komanda}
          itemCount={stats.count}
          runningTotalCents={running}
          syncedServerSide={komanda.number !== null}
          onPress={() => {
            onOpen(komanda);
          }}
        />
      </ReanimatedSwipeable>

      <CancelKomandaSheet
        visible={cancelOpen}
        komandaLabel={komanda.display_name ?? komanda.number ?? ''}
        note={note}
        onNoteChange={setNote}
        onCancel={closeCancelSheet}
        onConfirm={confirmCancel}
        submitting={cancelKomanda.isPending}
      />
    </>
  );
}

function CancelKomandaSheet({
  visible,
  komandaLabel,
  note,
  onNoteChange,
  onCancel,
  onConfirm,
  submitting,
}: {
  visible: boolean;
  komandaLabel: string;
  note: string;
  onNoteChange: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const canSubmit = note.trim().length > 0 && !submitting;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={sheetStyles.scrim}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={sheetStyles.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={sheetStyles.sheet} accessibilityViewIsModal>
          <View style={sheetStyles.handle} />
          <Text variant="h3">Cancelar komanda</Text>
          {komandaLabel ? (
            <Text variant="footnote" numberOfLines={1}>
              {komandaLabel}
            </Text>
          ) : null}
          <Text variant="bodySm" style={{ marginTop: space.sm }}>
            Escribe el motivo de la cancelación. Esta nota queda en auditoría.
          </Text>
          <TextInput
            value={note}
            onChangeText={onNoteChange}
            placeholder="Ej. cliente cambió de opinión, error al tomar la orden…"
            placeholderTextColor={color.textTertiary}
            multiline
            autoFocus
            numberOfLines={4}
            style={sheetStyles.input}
            textAlignVertical="top"
          />
          <View style={sheetStyles.footer}>
            <Button
              label="Volver"
              variant="ghost"
              haptic={false}
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label="Cancelar komanda"
              variant="destructive"
              disabled={!canSubmit}
              loading={submitting}
              onPress={onConfirm}
              style={{ flex: 2 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.scrim,
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.xs,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: color.borderStrong,
    marginBottom: space.md,
  },
  input: {
    minHeight: 96,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    fontSize: 15,
    color: color.textPrimary,
    fontWeight: fontWeight.medium as any,
  } as any,
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.md,
  },
});
