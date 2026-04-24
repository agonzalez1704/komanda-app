import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateKomanda } from '@/mutations/useCreateKomanda';
import {
  Button,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { color, fontWeight, palette, radius, shadow, space } from '@/theme/tokens';

export default function NewKomanda() {
  const router = useRouter();
  const create = useCreateKomanda();
  const [name, setName] = useState('');

  async function go() {
    const row = await create.mutateAsync({ display_name: name.trim() || null });
    router.replace(`/(app)/komandas/${row.id}`);
  }

  return (
    <Screen
      avoidKeyboard
      scrollable
      padded={false}
      floatingFooter
      contentContainerStyle={{ paddingBottom: 140 }}
      footer={
        <GlassSurface radius={radius.xxl} contentStyle={styles.actionBar}>
          <Button
            label="Cancel"
            variant="ghost"
            haptic={false}
            onPress={() => router.back()}
            style={{ flex: 0.8 }}
          />
          <Button
            label="Open komanda"
            onPress={go}
            loading={create.isPending}
            leadingIcon={<Ionicons name="arrow-forward" size={18} color={color.primaryOn} />}
            style={{ flex: 1.4 }}
          />
        </GlassSurface>
      }
    >
      {/* Floating glass nav pill — back chevron + eyebrow/title block. */}
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton
            glass
            name="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              New order
            </Text>
            <Text variant="h3" numberOfLines={1}>
              Open a komanda
            </Text>
          </View>
        </GlassSurface>
      </View>

      {/* Ambient hero — the saffron eyebrow + oversized title sit directly on
          the warm canvas, letting the halos and gradient read through. No
          dark container fighting the glass aesthetic. */}
      <View style={styles.heroPad}>
        <View style={styles.heroBadge}>
          <Ionicons name="receipt-outline" size={14} color={palette.saffron600} />
          <Text style={styles.heroBadgeText}>Fresh komanda</Text>
        </View>
        <Text style={styles.heroTitle}>
          Open a{' '}
          <Text style={styles.heroTitleAccent}>fresh</Text>
          {'\n'}komanda.
        </Text>
        <Text style={styles.heroSubtitle}>
          A new number is assigned automatically. Add a table label if it helps
          you remember which party this is for.
        </Text>
      </View>

      {/* Solid form card — CONTENT, not chrome, so it stays flat and readable. */}
      <View style={styles.formPad}>
        <View style={styles.card}>
          <TextField
            label="Table label (optional)"
            placeholder={'e.g. "Table 5" or "Bar"'}
            value={name}
            onChangeText={setName}
            hint="Leave empty to use the auto-generated number only."
            returnKeyType="done"
            onSubmitEditing={go}
            leading={<Ionicons name="pricetag-outline" size={18} color={color.textTertiary} />}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Floating glass nav — inset from the edges so WarmCanvas wraps the corners.
  hdrPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },

  // Hero — transparent, sits directly on the warm canvas.
  heroPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: palette.saffron50,
    borderWidth: 1,
    borderColor: palette.saffron100,
  },
  heroBadgeText: {
    color: palette.saffron600,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: color.textPrimary,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: fontWeight.heavy,
    letterSpacing: -0.5,
    marginTop: space.xs,
  },
  heroTitleAccent: {
    color: palette.saffron600,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: fontWeight.heavy,
  },
  heroSubtitle: {
    color: color.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 340,
    marginTop: 2,
  },

  // Solid form surface — quiet so the TextField does the talking.
  formPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    ...shadow.sm,
  },

  // Glass footer action bar — houses the paired Cancel / Open CTA.
  actionBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
});
