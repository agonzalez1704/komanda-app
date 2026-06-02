import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { color, fontSize, fontWeight, radius, space } from '@/theme/tokens';
import { type OrgBilling } from '@/billing';
import { openCheckoutSession } from '@/billing/openCheckout';
import type { SubscriptionStatusT } from '@/insforge/schemas';

/**
 * Full-screen takeover when the org has lost access (trial expired,
 * subscription canceled, or payment failed beyond grace period).
 *
 * Tapping the primary CTA opens the web billing page in an in-app browser.
 * On dismiss we invalidate the membership query so a successful Stripe flow
 * shows up immediately after the user returns to the app.
 */
export function BillingPaywall({
  org,
  status,
}: {
  org: OrgBilling;
  status: SubscriptionStatusT;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  // The layout's membership query uses `staleTime: Infinity` + persisted
  // cache, so without help it never notices the webhook flipping
  // subscription_status to 'active'. Poll every 10s while the paywall is
  // mounted, and refetch on app foreground — both invalidate the same
  // ['membership'] key the layout reads from.
  useEffect(() => {
    const refresh = () => qc.invalidateQueries({ queryKey: ['membership'] });
    refresh();
    const interval = setInterval(refresh, 10_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [qc]);

  const headline =
    status === 'expired'
      ? 'Tu prueba terminó'
      : status === 'past_due'
        ? 'No pudimos cobrar tu suscripción'
        : status === 'canceled'
          ? 'Tu suscripción está cancelada'
          : 'Reactiva Komanda';

  const body =
    status === 'expired'
      ? 'Para seguir tomando komandas, agrega un método de pago. Te tomamos solo $500 MXN al mes — cancela cuando quieras.'
      : status === 'past_due'
        ? 'La última factura no se pudo cobrar. Actualiza tu tarjeta para seguir trabajando.'
        : 'Tu plan está pausado. Reactívalo para que tu equipo siga tomando órdenes.';

  async function open() {
    setBusy(true);
    try {
      const result = await openCheckoutSession();
      if (!result.ok) {
        Alert.alert('Pago no disponible', 'No pudimos abrir el pago. Intenta de nuevo en un momento.');
        return;
      }
      // Refresh membership when the sheet closes — Stripe webhook may have
      // updated subscription_status while the user was paying.
      await qc.invalidateQueries({ queryKey: ['membership'] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🔒</Text>
        </View>
        <Text style={styles.brand}>{org.name}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.body}>{body}</Text>

        <Pressable
          onPress={open}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Agregar método de pago"
          style={({ pressed }) => [
            styles.primary,
            (pressed || busy) && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={color.primaryOn} />
          ) : (
            <Text style={styles.primaryLabel}>
              {status === 'past_due'
                ? 'Actualizar tarjeta'
                : 'Agregar método de pago'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.fineprint}>
          Se abre en el navegador para completar el pago seguro vía Stripe.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg,
    paddingHorizontal: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: color.bgElevated,
    borderRadius: radius.xxl,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  brand: {
    fontSize: fontSize.caption,
    color: color.textTertiary,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: color.textSecondary,
    textAlign: 'center',
  },
  primary: {
    marginTop: space.md,
    backgroundColor: color.primary,
    borderRadius: radius.full,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryLabel: {
    color: color.primaryOn,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  fineprint: {
    fontSize: 11,
    color: color.textTertiary,
    textAlign: 'center',
    marginTop: space.xs,
  },
});
