import { useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Button, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { useInviteMember } from '@/mutations/useInviteMember';
import type { RoleT } from '@/insforge/schemas';

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

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
  }

  async function handleShare() {
    if (!code) return;
    try {
      await Share.share({ message: `Join our team. Invite code: ${code}` });
    } catch {
      // user-cancelled share — ignore
    }
  }

  return (
    <View style={styles.backdrop}>
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
            <View style={styles.codeBox}>
              <Text
                align="center"
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  letterSpacing: 4,
                  color: color.textPrimary,
                }}
              >
                {code}
              </Text>
            </View>
            <Button
              label="Copy code"
              variant="secondary"
              onPress={handleCopy}
              leadingIcon={
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color={color.textPrimary}
                />
              }
            />
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
    </View>
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
    padding: space.lg,
    borderRadius: radius.md,
    marginVertical: space.lg,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
