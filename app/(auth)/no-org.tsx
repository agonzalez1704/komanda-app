import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insforge, clearToken } from '@/insforge/client';
import { createOrganizationAndMember } from '@/insforge/queries/organizations';
import { redeemInvitation } from '@/insforge/queries/invitations';
import { resetCreateKomandaContext } from '@/offline/handlers/createKomanda';
import { Button, Chip, Screen, Text, TextField } from '@/components/ui';
import { color, palette, radius, shadow, space } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';

type Mode = 'create' | 'invite';

export default function NoOrg() {
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('create');
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    await clearToken();
    resetCreateKomandaContext();
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        await createOrganizationAndMember(orgName, displayName);
      } else {
        await redeemInvitation(token);
      }
      await qc.invalidateQueries({ queryKey: ['membership'] });
      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  const createDisabled = submitting || !orgName || !displayName;
  const inviteDisabled = submitting || !token;
  const disabled = mode === 'create' ? createDisabled : inviteDisabled;

  return (
    <Screen avoidKeyboard scrollable contentContainerStyle={{ paddingVertical: space.xxl, gap: space.lg }}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="people-outline" size={36} color={palette.terracotta500} />
        </View>
        <Text variant="h1" align="center">
          No organization yet
        </Text>
        <Text variant="bodySm" align="center" style={styles.body}>
          Create one now, or accept an invite to join an existing organization.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.segmented}>
          <Chip
            block
            label="Create new"
            tone="neutral"
            selected={mode === 'create'}
            onPress={() => setMode('create')}
          />
          <Chip
            block
            label="Accept invite"
            tone="neutral"
            selected={mode === 'invite'}
            onPress={() => setMode('invite')}
          />
        </View>

        <View style={{ gap: space.md }}>
          {mode === 'create' ? (
            <>
              <TextField
                label="Organization name"
                placeholder="e.g. Tacos El Güero"
                value={orgName}
                onChangeText={setOrgName}
              />
              <TextField
                label="Your name"
                placeholder="First and last name"
                value={displayName}
                onChangeText={setDisplayName}
                autoComplete="name"
                textContentType="name"
                error={error}
              />
            </>
          ) : (
            <TextField
              label="Invite token"
              placeholder="Paste or enter token"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              error={error}
            />
          )}
        </View>

        <Button
          label={mode === 'create' ? 'Create organization' : 'Accept invite'}
          onPress={onSubmit}
          disabled={disabled}
          loading={submitting}
        />
      </View>

      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: palette.terracotta50,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  body: {
    maxWidth: 320,
    color: color.textSecondary,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: space.xl,
    marginHorizontal: space.lg,
    gap: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    ...shadow.md,
  },
  segmented: {
    flexDirection: 'row',
    gap: space.sm,
  },
});
