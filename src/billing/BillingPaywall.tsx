import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { color, fontSize, fontWeight, radius, space } from '@/theme/tokens';
import { BILLING_URL, type OrgBilling } from '@/billing';
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
      await WebBrowser.openBrowserAsync(BILLING_URL, {
        presentationStyle:
          WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
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
