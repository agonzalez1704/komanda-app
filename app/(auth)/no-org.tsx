import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insforge, clearToken } from '@/insforge/client';
import { createOrganizationAndMember } from '@/insforge/queries/organizations';
import { resetCreateKomandaContext } from '@/offline/handlers/createKomanda';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { color, palette, radius, shadow, space } from '@/theme/tokens';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Shown when a signed-in user has no membership. They can create a new
 * organization here. Invitees take the deep-link path (handled in
 * `app/invite/accept.tsx`); this screen surfaces a single link to that
 * funnel for the rare case where a user signed in before opening the
 * invite link.
 */
export default function NoOrg() {
  const router = useRouter();
  const qc = useQueryClient();
  const [orgName, setOrgName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    await clearToken();
    resetCreateKomandaContext();
    await insforge.auth.signOut();
    qc.clear();
    router.replace('/(auth)/sign-in');
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await createOrganizationAndMember(orgName, displayName);
      await qc.invalidateQueries({ queryKey: ['membership'] });
      router.replace('/(app)/komandas');
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo crear la organización');
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || !orgName || !displayName;

  return (
    <Screen avoidKeyboard scrollable contentContainerStyle={{ paddingVertical: space.xxl, gap: space.lg }}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="people-outline" size={36} color={palette.terracotta500} />
        </View>
        <Text variant="h1" align="center">
          Aún no tienes organización
        </Text>
        <Text variant="bodySm" align="center" style={styles.body}>
          Crea una nueva, o abre el enlace de invitación que te enviaron.
        </Text>
      </View>

      <View style={styles.card}>
        <Text variant="h3">Crear organización</Text>
        <View style={{ gap: space.md }}>
          <TextField
            label="Nombre de la organización"
            placeholder="Ej. Tacos El Güero"
            value={orgName}
            onChangeText={setOrgName}
          />
          <TextField
            label="Tu nombre"
            placeholder="Nombre y apellido"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
            textContentType="name"
            error={error}
          />
        </View>

        <Button
          label="Crear organización"
          onPress={onSubmit}
          disabled={disabled}
          loading={submitting}
        />

        <Link href="/invite/accept" asChild>
          <Pressable style={styles.link} accessibilityRole="link">
            <Text style={{ color: color.primary }}>
              ¿Tienes un código de invitación?
            </Text>
          </Pressable>
        </Link>
      </View>

      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
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
  link: {
    alignSelf: 'center',
    marginTop: space.xs,
  },
});
