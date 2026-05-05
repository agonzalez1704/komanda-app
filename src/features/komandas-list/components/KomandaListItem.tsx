import { useRef } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { KomandaCard } from '@/components/KomandaCard';
import { SwipeAction, swipeActionsWrapStyle } from '@/components/ui';
import {
  blockReasonMessage,
  canTransitionStatus,
  effectiveStatus,
  transitionBlockedReason,
  type ManualStatus,
} from '@/domain/komandaStatus';
import { useUpdateStatus } from '@/mutations/useUpdateStatus';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from '../hooks/useKomandasData';

/**
 * Wraps KomandaCard with a left-swipe gesture revealing status-transition
 * actions for the waiter. Available actions follow the lifecycle in
 * `domain/komandaStatus.ts`:
 *   pending → "Servir"
 *   served  → "Pendiente" (re-order) and "Cobrar"
 *   closed  → none
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

  const status = effectiveStatus(komanda.status);
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
    // 'closed' is more than a status flip — it captures payment method and
    // emits the receipt. Route into the close screen instead of mutating
    // status directly so we never end up with a closed komanda missing
    // payment_method.
    if (next === 'closed') {
      router.push(`/(app)/komandas/${komanda.id}/close` as const);
      return;
    }
    updateStatus.mutate({ komanda_id: komanda.id, status: next });
  }

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      enableTrackpadTwoFingerGesture
      enabled={actions.length > 0 && status !== 'closed'}
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
    >
      <KomandaCard
        k={komanda}
        itemCount={stats.count}
        runningTotalCents={running}
        syncedServerSide={komanda.number !== null}
        onPress={() => {
          console.log('[KomandaListItem] open ->', komanda.id);
          onOpen(komanda);
        }}
      />
    </ReanimatedSwipeable>
  );
}
