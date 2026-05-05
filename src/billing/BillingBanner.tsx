import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, fontWeight, radius, space } from '@/theme/tokens';
import {
  BILLING_URL,
  daysRemaining,
  type OrgBilling,
  shouldShowTrialBanner,
} from '@/billing';

/**
 * Thin top-bar shown over the app stack when the trial is winding down or
 * a payment failed. Tap → opens komanda.app/billing in an in-app browser
 * so admin can add a card without losing app state.
 */
export function BillingBanner({ org }: { org: OrgBilling }) {
  const insets = useSafeAreaInsets();
  const status = org.subscription_status;
  const isPastDue = status === 'past_due';
  const showTrial = shouldShowTrialBanner(org);
  if (!isPastDue && !showTrial) return null;

  const days = daysRemaining(org.trial_ends_at);
  const palette = isPastDue ? warningStyles : trialStyles;

  const headline = isPastDue
    ? 'Pago pendiente'
    : days === 0
      ? 'Tu prueba termina hoy'
      : days === 1
        ? '1 día de prueba restante'
        : `${days} días de prueba restantes`;

  const cta = isPastDue ? 'Actualizar tarjeta' : 'Agregar pago';

  async function open() {
    try {
      await WebBrowser.openBrowserAsync(BILLING_URL, {
        presentationStyle:
          WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch {
      // Non-fatal — user can retry.
    }
  }

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${cta}`}
      style={({ pressed }) => [
        styles.bar,
        palette.bar,
        { paddingTop: space.sm + insets.top },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.barInner}>
        <View style={[styles.dot, palette.dot]} />
        <Text style={[styles.label, palette.label]} numberOfLines={1}>
          {headline}
        </Text>
        <Text style={[styles.cta, palette.cta]}>{cta} →</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontWeight: fontWeight.semibold,
  },
  cta: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },
});

const trialStyles = StyleSheet.create({
  bar: {
    backgroundColor: color.infoBg,
    borderBottomColor: color.info,
  },
  dot: { backgroundColor: color.info },
  label: { color: color.infoText },
  cta: { color: color.info },
});

const warningStyles = StyleSheet.create({
  bar: {
    backgroundColor: color.warningBg,
    borderBottomColor: color.warning,
  },
  dot: { backgroundColor: color.warning },
  label: { color: color.warningText },
  cta: { color: color.warning },
});
