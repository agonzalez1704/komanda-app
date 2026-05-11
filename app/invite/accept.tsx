import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Screen,
  ScreenHeader,
  Text,
  TextField,
} from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';
import {
  lookupInvitation,
  type InvitationPreview,
} from '@/insforge/queries/invitations';
import { useAcceptInvitation } from '@/mutations/useAcceptInvitation';
import { useSession } from '@/insforge/session';
import { insforge, persistSession, clearToken } from '@/insforge/client';
import { resetCreateKomandaContext } from '@/offline/handlers/createKomanda';

/**
 * Single-pipe invite acceptance. Reachable only via deep link
 * (komanda://invite/accept?code=…) or via the "Have an invite code?"
 * link on sign-in. All other entry points (sign-up "Accept invite" tab,
 * no-org "Accept invite" tab) were removed; this screen is the funnel.
 *
 * Flow:
 *   1. URL has ?code= → auto-verify (no manual paste step).
 *   2. URL bare → manual code entry, then verify.
 *   3. Verified preview branches on session state:
 *        signed-out      → inline sign-up (email locked from invitation)
 *        signed-in match → 1-tap join
 *        signed-in mismatch → "Sign out and switch account"
 *   4. Error states (invalid / revoked / used / expired) each get a
 *      recovery CTA: retry or mailto the inviter.
 */

type Phase =
  | { kind: 'manual_entry' }
  | { kind: 'verifying' }
  | { kind: 'error'; reason: ErrorReason; preview: InvitationPreview | null }
  | { kind: 'ready'; preview: InvitationPreview }
  | { kind: 'joining' };

type ErrorReason =
  | 'invalid'
  | 'revoked'
  | 'used'
  | 'expired'
  | 'unknown';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const session = useSession();
  const qc = useQueryClient();
  const accept = useAcceptInvitation();

  const initialCode = (params.code ?? '').toUpperCase();
  const [code, setCode] = useState(initialCode);
  const [phase, setPhase] = useState<Phase>(
    initialCode ? { kind: 'verifying' } : { kind: 'manual_entry' },
  );

  const verify = useCallback(async (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed) {
      setPhase({ kind: 'manual_entry' });
      return;
    }
    setPhase({ kind: 'verifying' });
    try {
      const p = await lookupInvitation(trimmed);
      if (!p) {
        setPhase({ kind: 'error', reason: 'invalid', preview: null });
        return;
      }
      if (p.status === 'revoked') {
        setPhase({ kind: 'error', reason: 'revoked', preview: p });
        return;
      }
      if (p.status === 'accepted') {
        setPhase({ kind: 'error', reason: 'used', preview: p });
        return;
      }
      if (new Date(p.expires_at).getTime() < Date.now()) {
        setPhase({ kind: 'error', reason: 'expired', preview: p });
        return;
      }
      setPhase({ kind: 'ready', preview: p });
    } catch {
      setPhase({ kind: 'error', reason: 'unknown', preview: null });
    }
  }, []);

  useEffect(() => {
    if (initialCode) void verify(initialCode);
  }, [initialCode, verify]);

  function manualVerify() {
    void verify(code);
  }

  function tryAnother() {
    setCode('');
    setPhase({ kind: 'manual_entry' });
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader title="Aceptar invitación" showBack />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {phase.kind === 'manual_entry' ? (
          <ManualEntry
            code={code}
            onChange={setCode}
            onSubmit={manualVerify}
          />
        ) : null}
        {phase.kind === 'verifying' ? <VerifyingCard /> : null}
        {phase.kind === 'error' ? (
          <ErrorCard
            reason={phase.reason}
            preview={phase.preview}
            onTryAnother={tryAnother}
          />
        ) : null}
        {phase.kind === 'ready' || phase.kind === 'joining' ? (
          <ReadyCard
            preview={(phase as Extract<Phase, { kind: 'ready' }>).preview}
            code={code.trim().toUpperCase()}
            joining={phase.kind === 'joining' || accept.isPending}
            onJoinDone={() => {
              setPhase({ kind: 'joining' });
              qc.invalidateQueries({ queryKey: ['membership'] });
              router.replace('/(app)/komandas');
            }}
            onSetJoining={() => setPhase({ kind: 'joining' })}
            sessionStatus={session.status}
            sessionEmail={
              session.status === 'signed-in' ? session.session.email : null
            }
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ManualEntry({
  code,
  onChange,
  onSubmit,
}: {
  code: string;
  onChange: (s: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card padded>
      <Text variant="h3">Pega tu código</Text>
      <Text variant="bodySm" style={{ marginTop: space.xs }}>
        Si recibiste un enlace, ábrelo desde el mensaje y caerás aquí
        directamente. Si solo tienes el código, pégalo abajo.
      </Text>
      <View style={{ marginTop: space.lg, gap: space.sm }}>
        <TextField
          label="Código de invitación"
          placeholder="XXXX-XXXX"
          value={code}
          onChangeText={(t) => onChange(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </View>
      <Button
        label="Verificar código"
        onPress={onSubmit}
        disabled={!code.trim()}
        style={{ marginTop: space.md }}
      />
    </Card>
  );
}

function VerifyingCard() {
  return (
    <Card padded>
      <View style={styles.centerRow}>
        <ActivityIndicator color={color.primary} />
        <Text variant="bodySm" style={{ marginLeft: space.sm }}>
          Verificando código…
        </Text>
      </View>
    </Card>
  );
}

const ERROR_COPY: Record<
  ErrorReason,
  { title: string; subtitle: string; icon: 'alert-circle' | 'time-outline' | 'close-circle' | 'help-circle' }
> = {
  invalid: {
    title: 'Código no válido',
    subtitle: 'Revisa que esté completo y vuelve a intentar.',
    icon: 'alert-circle',
  },
  revoked: {
    title: 'Invitación revocada',
    subtitle: 'El admin canceló esta invitación. Pídele una nueva.',
    icon: 'close-circle',
  },
  used: {
    title: 'Invitación ya usada',
    subtitle: 'Este código ya fue redimido. Pide uno nuevo si necesitas acceso.',
    icon: 'close-circle',
  },
  expired: {
    title: 'Invitación expirada',
    subtitle: 'Pide al admin que te genere un código nuevo.',
    icon: 'time-outline',
  },
  unknown: {
    title: 'Algo salió mal',
    subtitle: 'No pudimos validar el código. Intenta de nuevo.',
    icon: 'help-circle',
  },
};

function ErrorCard({
  reason,
  preview,
  onTryAnother,
}: {
  reason: ErrorReason;
  preview: InvitationPreview | null;
  onTryAnother: () => void;
}) {
  const copy = ERROR_COPY[reason];
  const inviter = preview?.inviter_email ?? null;
  const orgName = preview?.org_name ?? '';
  const showContactCta = inviter && (reason === 'revoked' || reason === 'used' || reason === 'expired');

  function contactInviter() {
    if (!inviter) return;
    const subject =
      reason === 'expired'
        ? `Necesito un código nuevo para ${orgName}`
        : `Necesito una nueva invitación para ${orgName}`;
    const body =
      reason === 'expired'
        ? 'Mi invitación expiró. ¿Me puedes generar una nueva?'
        : 'Mi invitación ya no es válida. ¿Me puedes generar otra?';
    Linking.openURL(
      `mailto:${inviter}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    ).catch(() => {});
  }

  return (
    <Card padded>
      <View style={styles.errorHero}>
        <View style={styles.errorIcon}>
          <Ionicons name={copy.icon} size={32} color={color.danger} />
        </View>
        <Text variant="h3" align="center">
          {copy.title}
        </Text>
        <Text variant="bodySm" align="center" style={{ marginTop: space.xs }}>
          {copy.subtitle}
        </Text>
      </View>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {showContactCta ? (
          <Button
            label={
              reason === 'expired'
                ? 'Pedir código nuevo'
                : `Contactar a ${inviter}`
            }
            onPress={contactInviter}
            leadingIcon={
              <Ionicons name="mail-outline" size={18} color={color.primaryOn} />
            }
          />
        ) : null}
        <Button
          label="Probar otro código"
          variant={showContactCta ? 'secondary' : 'primary'}
          onPress={onTryAnother}
        />
      </View>
    </Card>
  );
}

function ReadyCard({
  preview,
  code,
  joining,
  sessionStatus,
  sessionEmail,
  onJoinDone,
  onSetJoining,
}: {
  preview: InvitationPreview;
  code: string;
  joining: boolean;
  sessionStatus: 'loading' | 'signed-in' | 'signed-out';
  sessionEmail: string | null;
  onJoinDone: () => void;
  onSetJoining: () => void;
}) {
  const accept = useAcceptInvitation();
  const qc = useQueryClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  const matches =
    sessionStatus === 'signed-in' &&
    sessionEmail !== null &&
    sessionEmail.trim().toLowerCase() === preview.email.trim().toLowerCase();

  async function joinSignedIn() {
    onSetJoining();
    accept.mutate(
      { token: code, displayName: displayName.trim() || undefined },
      {
        onSuccess: onJoinDone,
        onError: (e) => Alert.alert('No se pudo unir', mapRedeemError(e)),
      },
    );
  }

  async function signOutAndSwitch() {
    try {
      await clearToken();
      resetCreateKomandaContext();
      await insforge.auth.signOut();
    } catch {
      // best-effort
    }
    qc.clear();
    // Re-enter the same screen with the same code so signup flow runs.
    router.replace(`/invite/accept?code=${encodeURIComponent(code)}`);
  }

  async function signUpAndJoin() {
    if (!password || password.length < 8 || !displayName.trim()) return;
    setSigningUp(true);
    try {
      const { data, error } = await insforge.auth.signUp({
        email: preview.email,
        password,
        name: displayName.trim() || undefined,
      });
      if (error) throw new Error(error.message);

      if (data?.accessToken) {
        const u = (data as any)?.user;
        await persistSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          user:
            u?.id && (u?.email ?? preview.email)
              ? { id: u.id, email: u.email ?? preview.email }
              : null,
        });
      } else {
        const { data: sess, error: siErr } = await insforge.auth.signInWithPassword({
          email: preview.email,
          password,
        });
        if (siErr) throw new Error(siErr.message);
        if (sess?.accessToken) {
          const u = (sess as any)?.user;
          await persistSession({
            accessToken: sess.accessToken,
            refreshToken: sess.refreshToken ?? null,
            user:
              u?.id && (u?.email ?? preview.email)
                ? { id: u.id, email: u.email ?? preview.email }
                : null,
          });
        }
      }

      await accept.mutateAsync({
        token: code,
        displayName: displayName.trim() || undefined,
      });
      onJoinDone();
    } catch (e) {
      Alert.alert('No se pudo crear la cuenta', mapRedeemError(e));
    } finally {
      setSigningUp(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Card padded>
        <View style={styles.orgHeader}>
          <View style={styles.orgIconWrap}>
            <Ionicons name="business" size={26} color={palette.terracotta600} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={2}>
              {preview.org_name}
            </Text>
            <Text variant="caption" style={{ textTransform: 'capitalize' }}>
              Te uniras como {preview.role}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={{ gap: space.xs }}>
          <Text variant="caption">Invitación dirigida a</Text>
          <Text variant="bodyStrong">{preview.email}</Text>
        </View>
      </Card>

      {sessionStatus === 'signed-in' && matches ? (
        <Card padded>
          <Text variant="bodySm" style={{ marginBottom: space.sm }}>
            Confirma tu nombre y entra al equipo.
          </Text>
          <TextField
            label="Tu nombre"
            placeholder="Nombre y apellido"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
            textContentType="name"
          />
          <Button
            label={joining ? 'Uniéndote…' : `Unirme a ${preview.org_name}`}
            onPress={joinSignedIn}
            loading={joining}
            disabled={joining || !displayName.trim()}
            style={{ marginTop: space.lg }}
            leadingIcon={
              <Ionicons name="checkmark" size={18} color={color.primaryOn} />
            }
          />
        </Card>
      ) : null}

      {sessionStatus === 'signed-in' && !matches ? (
        <Card padded>
          <View style={styles.warnHero}>
            <Ionicons
              name="warning-outline"
              size={28}
              color={color.warningText}
            />
            <Text variant="h3" align="center" style={{ marginTop: space.sm }}>
              Cuenta diferente
            </Text>
            <Text variant="bodySm" align="center" style={{ marginTop: space.xs }}>
              Estás conectado como{' '}
              <Text variant="bodyStrong">{sessionEmail ?? '—'}</Text> pero la
              invitación es para{' '}
              <Text variant="bodyStrong">{preview.email}</Text>. Sal y vuelve a
              entrar con esa cuenta.
            </Text>
          </View>
          <Button
            label={`Salir y entrar como ${preview.email}`}
            variant="destructive"
            onPress={signOutAndSwitch}
            style={{ marginTop: space.lg }}
            leadingIcon={
              <Ionicons name="swap-horizontal" size={18} color={color.primaryOn} />
            }
          />
        </Card>
      ) : null}

      {sessionStatus === 'signed-out' ? (
        <Card padded>
          <Text variant="bodySm" style={{ marginBottom: space.sm }}>
            Crea tu cuenta con el correo invitado y entra al equipo.
          </Text>
          <View style={{ gap: space.md }}>
            <TextField
              label="Correo (invitado)"
              value={preview.email}
              editable={false}
              onChangeText={() => {}}
            />
            <TextField
              label="Tu nombre"
              placeholder="Nombre y apellido"
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
              textContentType="name"
            />
            <View>
              <TextField
                label="Contraseña"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="password-new"
                textContentType="newPassword"
              />
              <Text
                variant="caption"
                style={styles.pwHint}
                onPress={() => setShowPw((v) => !v)}
                accessibilityRole="button"
              >
                {showPw ? 'Ocultar' : 'Mostrar'} contraseña
              </Text>
            </View>
          </View>
          <Button
            label={
              signingUp
                ? 'Creando cuenta…'
                : `Crear cuenta y unirme a ${preview.org_name}`
            }
            onPress={signUpAndJoin}
            loading={signingUp}
            disabled={
              signingUp ||
              password.length < 8 ||
              !displayName.trim()
            }
            style={{ marginTop: space.lg }}
          />
        </Card>
      ) : null}

      {sessionStatus === 'loading' ? (
        <Card padded>
          <View style={styles.centerRow}>
            <ActivityIndicator color={color.primary} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function mapRedeemError(e: unknown): string {
  const msg = String((e as Error)?.message ?? e ?? '').toLowerCase();
  if (msg.includes('invitation_email_mismatch')) {
    return 'El correo de tu cuenta no coincide con la invitación.';
  }
  if (msg.includes('invitation_expired')) {
    return 'La invitación expiró. Pide una nueva al admin.';
  }
  if (msg.includes('invitation_not_pending')) {
    return 'La invitación ya no es válida.';
  }
  if (msg.includes('invitation_not_found')) {
    return 'No encontramos esa invitación.';
  }
  if (msg.includes('already_member')) {
    return 'Ya eres miembro de este equipo.';
  }
  return String((e as Error)?.message ?? 'Algo salió mal.');
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.lg,
    gap: space.md,
    paddingBottom: space.xxl,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  orgIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: palette.terracotta50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.border,
    marginVertical: space.md,
  },
  errorHero: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
  },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  warnHero: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  pwHint: {
    color: color.primary,
    marginTop: space.xs,
    fontWeight: fontWeight.semibold as any,
  },
});
