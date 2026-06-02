import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchMarginAssumptions } from '@/insforge/queries/margins';
import { useUpsertMarginAssumptions } from '@/mutations/useUpsertMarginAssumptions';

export default function AssumptionsScreen() {
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const orgId = me?.org_id ?? '';

  const q = useQuery({
    queryKey: ['margin-assumptions', orgId],
    queryFn: () => fetchMarginAssumptions(orgId),
    enabled: !!orgId,
  });
  const upsert = useUpsertMarginAssumptions(orgId);

  const [commission, setCommission] = useState('');
  const [iva, setIva] = useState('');
  const [markupA, setMarkupA] = useState('');
  const [markupB, setMarkupB] = useState('');

  useEffect(() => {
    if (q.data) {
      setCommission(asPercentString(q.data.uber_commission_pct));
      setIva(asPercentString(q.data.uber_iva_retention_pct));
      setMarkupA(String(q.data.markup_a));
      setMarkupB(String(q.data.markup_b));
    }
  }, [q.data]);

  if (me && me.role !== 'admin') {
    return (
      <Screen>
        <ScreenHeader showBack title="Assumptions" />
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={32} color={color.textTertiary} />
          <Text variant="bodyStrong" align="center">Permission denied</Text>
        </View>
      </Screen>
    );
  }

  function handleSave() {
    const comm = parsePercent(commission);
    const ivaR = parsePercent(iva);
    const a = Number(markupA.replace(',', '.'));
    const b = Number(markupB.replace(',', '.'));
    if (comm == null || ivaR == null || !Number.isFinite(a) || !Number.isFinite(b)) {
      Alert.alert('Invalid', 'Percentages must be 0–100 and markups numeric.');
      return;
    }
    if (a <= 1 || b <= 1) {
      Alert.alert('Invalid', 'Markup factors must be > 1.');
      return;
    }
    upsert.mutate(
      {
        uberCommissionPct: comm,
        uberIvaRetentionPct: ivaR,
        markupA: a,
        markupB: b,
      },
      {
        onError: (e) => Alert.alert('Could not save', String((e as Error).message)),
        onSuccess: () => Alert.alert('Saved', 'Assumptions updated.'),
      }
    );
  }

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Assumptions" />
      </View>

      {q.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <Card style={styles.card}>
          <Text variant="bodySm">
            Uber Eats deductions and markup factors. Defaults match the
            spreadsheet baseline (34.64% commission + 9.51% IVA retention;
            Option A ×1.53, Option B ×1.79).
          </Text>
          <TextField
            label="Uber commission %"
            hint="Commission + IVA on the commission. Default 34.64."
            keyboardType="decimal-pad"
            value={commission}
            onChangeText={setCommission}
            placeholder="34.64"
          />
          <TextField
            label="IVA retention %"
            hint="IVA Uber retains on the sale. Default 9.51."
            keyboardType="decimal-pad"
            value={iva}
            onChangeText={setIva}
            placeholder="9.51"
          />
          <TextField
            label="Markup A (cover Uber fee only)"
            hint="Multiplier applied to in-store price. > 1."
            keyboardType="decimal-pad"
            value={markupA}
            onChangeText={setMarkupA}
            placeholder="1.53"
          />
          <TextField
            label="Markup B (cover Uber fee + IVA retention)"
            keyboardType="decimal-pad"
            value={markupB}
            onChangeText={setMarkupB}
            placeholder="1.79"
          />
          <Button
            label="Save"
            onPress={handleSave}
            loading={upsert.isPending}
            disabled={upsert.isPending}
          />
        </Card>
      )}
    </Screen>
  );
}

function asPercentString(pct: number): string {
  // 0.3464 → "34.64"
  return (Math.round(pct * 10000) / 100).toString();
}

function parsePercent(s: string): number | null {
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n / 100;
}

const styles = StyleSheet.create({
  loading: { padding: space.xxl, alignItems: 'center' },
  card: { marginHorizontal: space.lg, gap: space.sm },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.xxl,
  },
});
