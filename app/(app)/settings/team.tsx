import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Divider, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listMembers } from '@/insforge/queries/members';
import { listPendingInvitations } from '@/insforge/queries/invitations';
import { useChangeMemberRole } from '@/mutations/useChangeMemberRole';
import { useRemoveMember } from '@/mutations/useRemoveMember';
import { useRevokeInvitation } from '@/mutations/useRevokeInvitation';
import type {
  InvitationRowT,
  OrganizationMemberRowT,
  RoleT,
} from '@/insforge/schemas';
import { MemberRow } from '@/features/team/components/MemberRow';
import { InviteRow } from '@/features/team/components/InviteRow';
import { InviteSheet } from '@/features/team/components/InviteSheet';
import { RolePicker } from '@/features/team/components/RolePicker';

export default function TeamScreen() {
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = membership?.org_id ?? '';

  const members = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => listMembers(orgId),
    enabled: !!orgId,
  });

  const invitations = useQuery({
    queryKey: ['invitations', orgId],
    queryFn: () => listPendingInvitations(orgId),
    enabled: !!orgId,
  });

  const changeRole = useChangeMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const revokeInvitation = useRevokeInvitation(orgId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionMember, setActionMember] = useState<OrganizationMemberRowT | null>(
    null,
  );
  const [pickerMember, setPickerMember] = useState<OrganizationMemberRowT | null>(
    null,
  );

  if (membership && membership.role !== 'admin') {
    return (
      <Screen>
        <ScreenHeader showBack title="Team" />
        <View style={styles.deniedWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={32}
            color={color.textTertiary}
          />
          <Text variant="bodyStrong" align="center">
            Permission denied
          </Text>
          <Text variant="bodySm" align="center">
            Only admins can manage the team.
          </Text>
        </View>
      </Screen>
    );
  }

  function handleRevoke(inv: InvitationRowT) {
    Alert.alert('Revoke invite?', `Revoke invitation to ${inv.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () =>
          revokeInvitation.mutate(inv.id, {
            onError: (e) =>
              Alert.alert(
                'Could not revoke',
                String((e as Error).message),
              ),
          }),
      },
    ]);
  }

  async function handleCopy(inv: InvitationRowT) {
    // Share only the code so paste targets get a clean string ready for the
    // accept-invite screen.
    try {
      await Share.share({ message: inv.token });
    } catch {
      // user-cancelled share — ignore
    }
  }

  function handleRemove(member: OrganizationMemberRowT) {
    setActionMember(null);
    Alert.alert(
      'Remove from organization?',
      `Remove ${member.display_name} from the team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeMember.mutate(
              { memberId: member.id, role: member.role },
              {
                onError: (e) =>
                  Alert.alert(
                    'Could not remove',
                    String((e as Error).message),
                  ),
              },
            ),
        },
      ],
    );
  }

  function handlePickRole(nextRole: RoleT) {
    if (!pickerMember) return;
    const target = pickerMember;
    setPickerMember(null);
    if (target.role === nextRole) return;
    changeRole.mutate(
      {
        memberId: target.id,
        currentRole: target.role,
        nextRole,
      },
      {
        onError: (e) =>
          Alert.alert(
            'Could not change role',
            String((e as Error).message),
          ),
      },
    );
  }

  const memberList = members.data ?? [];
  const inviteList = invitations.data ?? [];
  const meId = membership?.id;

  return (
    <Screen padded={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Team" />
      </View>

      <ScrollView
        contentContainerStyle={{ gap: space.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text variant="label">Members</Text>
          <Card padded={false}>
            {memberList.length === 0 ? (
              <View style={styles.empty}>
                <Text variant="bodySm">No members yet.</Text>
              </View>
            ) : (
              memberList.map((m, idx) => (
                <View key={m.id}>
                  {idx > 0 ? (
                    <Divider style={{ marginLeft: 64 }} />
                  ) : null}
                  <MemberRow
                    member={m}
                    showOverflow={m.id !== meId}
                    onOverflow={() => setActionMember(m)}
                  />
                </View>
              ))
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text variant="label">Pending invites</Text>
          <Card padded={false}>
            {inviteList.length === 0 ? (
              <View style={styles.empty}>
                <Text variant="bodySm">No pending invites.</Text>
              </View>
            ) : (
              inviteList.map((inv, idx) => (
                <View key={inv.id}>
                  {idx > 0 ? (
                    <Divider style={{ marginLeft: space.lg }} />
                  ) : null}
                  <InviteRow
                    invitation={inv}
                    onCopy={() => handleCopy(inv)}
                    onRevoke={() => handleRevoke(inv)}
                  />
                </View>
              ))
            )}
          </Card>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => setInviteOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Invite teammate"
        style={({ pressed }) => [
          styles.fab,
          pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Ionicons name="add" size={28} color={color.primaryOn} />
      </Pressable>

      {inviteOpen && orgId ? (
        <InviteSheet orgId={orgId} onClose={() => setInviteOpen(false)} />
      ) : null}

      {actionMember ? (
        <View style={styles.actionBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActionMember(null)}
          />
          <View style={styles.actionSheet}>
            <View style={styles.handle} />
            <Pressable
              onPress={() => {
                const m = actionMember;
                setActionMember(null);
                setPickerMember(m);
              }}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name="swap-horizontal-outline"
                size={20}
                color={color.textPrimary}
              />
              <Text variant="bodyStrong">Change role</Text>
            </Pressable>
            <Divider />
            <Pressable
              onPress={() => handleRemove(actionMember)}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name="person-remove-outline"
                size={20}
                color={color.danger}
              />
              <Text variant="bodyStrong" style={{ color: color.danger }}>
                Remove from org
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActionMember(null)}
              style={styles.actionDismiss}
            >
              <Text variant="bodySm" align="center">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {pickerMember ? (
        <RolePicker
          current={pickerMember.role}
          onClose={() => setPickerMember(null)}
          onPick={handlePickRole}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  empty: {
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  actionBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  actionDismiss: {
    paddingVertical: space.md,
    marginTop: space.sm,
  },
});
