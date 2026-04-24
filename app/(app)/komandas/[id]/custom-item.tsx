import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchModifiers } from '@/insforge/queries/menu';
import { QuantityStepper } from '@/components/QuantityStepper';
import { formatMXN } from '@/domain/money';
import { useAddItem } from '@/mutations/useAddItem';
import { announce } from '@/hooks/useReduceMotion';
import type { ModifierRowT } from '@/insforge/schemas';
import {
  Button,
  Card,
  Chip,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import {
  color,
  fontWeight,
  palette,
  radius,
  space,
} from '@/theme/tokens';

/**
 * Ad-hoc "custom item" flow.
 *
 * Adds a one-off line to the current komanda without creating a product in
 * the menu — useful for specials, off-menu requests, or quick one-time
 * additions. The line is stored with `product_id = null` but retains its
 * `product_name_snapshot` so receipts and totals read correctly.
 *
 * Entry points:
 *   - Footer CTA on the add-item grid
 *   - Empty-search state ("Add '<term>' as a one-off")
 */
export default function CustomItem() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    price?: string;
  }>();
  const komandaId = params.id;

  const modifiers = useQuery({
    queryKey: ['modifiers'],
    queryFn: fetchModifiers,
  });
  const addItem = useAddItem();

  const [name, setName] = useState(params.name ?? '');
  const [priceInput, setPriceInput] = useState(params.price ?? '');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [toggledMods, setToggledMods] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const priceCents = useMemo(() => parsePrice(priceInput), [priceInput]);
  const canSave =
    name.trim().length > 0 && priceCents !== null && priceCents > 0;
  const lineTotal = (priceCents ?? 0) * quantity;

  function toggleMod(id: string) {
    setToggledMods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!canSave || !komandaId || priceCents === null) {
      if (priceCents === null || priceCents <= 0) {
        setError('Enter a price, e.g. 45 or 45.50');
      }
      return;
    }
    setError(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    const chosenMods: ModifierRowT[] = (modifiers.data ?? []).filter((m) =>
      toggledMods.has(m.id),
    );
    await addItem.mutateAsync({
      komanda_id: komandaId,
      product_id: null,
      variant_id: null,
      quantity,
      unit_price_cents: priceCents,
      product_name_snapshot: name.trim(),
      variant_name_snapshot: null,
      note_text: note.trim() || null,
      modifiers: chosenMods.map((m) => ({
        modifier_id: m.id,
        name_snapshot: m.name,
      })),
    });
    announce(`Added ${quantity} ${name.trim()}.`);
    router.back();
  }

  const activeMods = (modifiers.data ?? []).filter((m) => m.active);

  return (
    <Screen
      scrollable
      padded={false}
      avoidKeyboard
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
            label={
              canSave
                ? `Add · ${formatMXN(lineTotal)}`
                : 'Fill in name and price'
            }
            disabled={!canSave}
            loading={addItem.isPending}
            onPress={save}
            leadingIcon={
              canSave ? (
                <Ionicons name="add" size={20} color={color.primaryOn} />
              ) : undefined
            }
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
              One-off item
            </Text>
            <Text variant="h3" numberOfLines={1}>
              Add a custom line
            </Text>
          </View>
        </GlassSurface>
      </View>

      {/* Ambient hero — saffron eyebrow badge + oversized title sit directly
          on the warm canvas so the halos and gradient read through. */}
      <View style={styles.heroPad}>
        <View style={styles.heroBadge}>
          <Ionicons
            name="sparkles-outline"
            size={14}
            color={palette.saffron600}
          />
          <Text style={styles.heroBadgeText}>Just this komanda</Text>
        </View>
        <Text style={styles.heroTitle}>
          A{' '}
          <Text style={styles.heroTitleAccent}>one-off</Text>
          {'\n'}line item.
        </Text>
        <Text style={styles.heroSubtitle}>
          Something not on the menu? Add it here just for this komanda. It
          won&rsquo;t be saved to your products.
        </Text>
      </View>

      {/* Solid form cards — CONTENT, kept flat and quiet so the inputs
          do the talking. */}
      <View style={styles.body}>
        <Card>
          <Text variant="label" style={styles.cardLabel}>
            Details
          </Text>
          <View style={{ gap: space.md }}>
            <TextField
              label="Item name"
              placeholder="e.g. Especial de la casa"
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              returnKeyType="next"
              required
            />

            <TextField
              label="Price"
              placeholder="0.00"
              value={priceInput}
              onChangeText={(v) => {
                setPriceInput(v.replace(/[^0-9.]/g, ''));
                if (error) setError(null);
              }}
              keyboardType="decimal-pad"
              leading="$"
              trailing={
                <Text
                  variant="footnote"
                  style={{ color: color.textTertiary }}
                >
                  MXN
                </Text>
              }
              error={error}
              required
            />
          </View>
        </Card>

        <Card>
          <Text variant="label" style={styles.cardLabel}>
            Quantity
          </Text>
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <Text variant="caption" style={styles.lineTotalHint}>
            Line total{' '}
            <Text
              mono
              style={{
                color: color.textPrimary,
                fontWeight: fontWeight.bold,
              }}
            >
              {formatMXN(lineTotal)}
            </Text>
          </Text>
        </Card>

        {activeMods.length > 0 ? (
          <Card>
            <Text variant="label" style={styles.cardLabel}>
              Modifiers (optional)
            </Text>
            <ScrollView
              horizontal={false}
              contentContainerStyle={styles.modRow}
            >
              <View style={styles.modRow}>
                {activeMods.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.name}
                    selected={toggledMods.has(m.id)}
                    onPress={() => toggleMod(m.id)}
                  />
                ))}
              </View>
            </ScrollView>
          </Card>
        ) : null}

        <Card>
          <Text variant="label" style={styles.cardLabel}>
            Note (optional)
          </Text>
          <TextField
            placeholder="e.g. sin cebolla, extra picante"
            value={note}
            onChangeText={setNote}
            returnKeyType="done"
          />
        </Card>
      </View>
    </Screen>
  );
}

function parsePrice(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
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

  // Solid form surfaces — CONTENT, not chrome.
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
  },
  cardLabel: {
    marginBottom: space.md,
  },
  modRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  lineTotalHint: {
    marginTop: space.md,
    color: color.textSecondary,
  },

  // Glass footer action bar — paired Cancel / Add CTA.
  actionBar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
});
