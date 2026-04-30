import { Button, Text } from '@/components/ui';
import type { RoleT } from '@/insforge/schemas';
import { useInviteMember } from '@/mutations/useInviteMember';
import { color, radius, space } from '@/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

const ROLES: RoleT[] = ['admin', 'cashier', 'waiter', 'cook'];

type Props = {
  orgId: string;
  onClose: () => void;
};

export function InviteSheet({ orgId, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleT>('waiter');
  const [code, setCode] = useState<string | null>(null);
  const invite = useInviteMember(orgId);

  function handleGenerate() {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', 'Please enter an email to invite.');
      return;
    }
    invite.mutate(
      { email: trimmed, role },
      {
        onSuccess: (row) => setCode(row.token),
        onError: (e) =>
          Alert.alert('Could not create invite', String((e as Error).message)),
      },
    );
  }

  async function handleShare() {
    if (!code) return;
    // Send only the code so Copy/Messages/etc. paste exactly the code with no
    // surrounding text. The accept-invite screen takes a raw code; any extra
    // chars would force the recipient to clean it up before pasting.
    try {
      await Share.share({ message: code });
    } catch {
      // user-cancelled share — ignore
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {code === null ? (
          <>
            <Text variant="h2">Invite teammate</Text>
            <Text variant="bodySm">
              Generate a one-time code they can redeem in the app.
            </Text>

            <View style={{ gap: space.xs }}>
              <Text variant="label">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={color.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
            </View>

            <View style={{ gap: space.xs }}>
              <Text variant="label">Role</Text>
              <View style={styles.segment}>
                {ROLES.map((r) => {
                  const active = r === role;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      style={[
                        styles.segmentItem,
                        active && styles.segmentActive,
                      ]}
                    >
                      <Text
                        variant="bodySm"
                        style={{
                          color: active ? color.primaryOn : color.textPrimary,
                          textTransform: 'capitalize',
                        }}
                      >
                        {r}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button
              label="Generate invite code"
              onPress={handleGenerate}
              loading={invite.isPending}
              disabled={invite.isPending}
              leadingIcon={
                <Ionicons name="key-outline" size={18} color={color.primaryOn} />
              }
            />
            <Pressable onPress={onClose} style={styles.dismiss}>
              <Text variant="bodySm" align="center">
                Cancel
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text variant="h2">Invite ready</Text>
            <Text variant="bodySm">
              Share this code with your teammate. It expires in 7 days.
            </Text>
            <Pressable onPress={handleShare} style={styles.codeBox}>
              <Text selectable align="center" style={styles.codeText}>
                {code}
              </Text>
              <Text variant="caption" align="center" style={{ marginTop: space.xs }}>
                Tap to share · long-press to select
              </Text>
            </Pressable>
            <Button
              label="Share"
              variant="secondary"
              onPress={handleShare}
              leadingIcon={
                <Ionicons
                  name="share-outline"
                  size={18}
                  color={color.textPrimary}
                />
              }
            />
            <Button label="Done" onPress={onClose} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 16,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: color.primary,
  },
  codeBox: {
    backgroundColor: color.surfaceAlt,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    marginVertical: space.lg,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    lineHeight: 40,
    includeFontPadding: false,
    color: color.textPrimary,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
