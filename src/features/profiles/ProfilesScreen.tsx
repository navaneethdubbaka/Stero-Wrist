import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../shared/ui/Screen';
import { ListRow } from '../../shared/ui/ListRow';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useProfilesStore } from './profilesStore';
import type { RootStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Profiles'>;

export function ProfilesScreen({ navigation }: Props) {
  const profiles = useProfilesStore((s) => s.profiles);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);
  const createProfile = useProfilesStore((s) => s.createProfile);
  const setActiveProfile = useProfilesStore((s) => s.setActiveProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      const profile = await createProfile(name || 'Personal Hermes');
      setName('');
      navigation.navigate('ProfileEditor', { profileId: profile.id });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (id: string, profileName: string) => {
    Alert.alert('Delete profile', `Remove “${profileName}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteProfile(id);
        },
      },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>Backend profiles</Text>
      <Text style={styles.hint}>
        Personal, Development, Production, or Custom — switch which Hermes the app uses.
      </Text>

      <View style={styles.create}>
        <FormField
          label="New profile name"
          value={name}
          onChangeText={setName}
          placeholder="Personal Hermes"
          autoCapitalize="words"
        />
        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => void onCreate()}
          disabled={busy}
        >
          <Text style={styles.buttonText}>Create profile</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {profiles.length === 0 ? (
          <Text style={styles.empty}>No profiles yet.</Text>
        ) : (
          profiles.map((profile) => (
            <View key={profile.id} style={styles.item}>
              <ListRow
                title={profile.name}
                subtitle={profile.webhook.url || 'No webhook URL'}
                trailing={activeProfileId === profile.id ? 'Active' : undefined}
                onPress={() =>
                  navigation.navigate('ProfileEditor', { profileId: profile.id })
                }
              />
              <View style={styles.actions}>
                {activeProfileId !== profile.id ? (
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setActiveProfile(profile.id)}
                  >
                    <Text style={styles.secondaryText}>Set active</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.secondary}
                  onPress={() => onDelete(profile.id, profile.name)}
                >
                  <Text style={[styles.secondaryText, styles.danger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  hint: {
    ...typeScale.caption,
    color: colors.mist,
  },
  create: {
    gap: space.sm,
  },
  button: {
    minHeight: touch.min,
    borderRadius: 10,
    backgroundColor: colors.brandBand,
    borderWidth: 1,
    borderColor: colors.lanternReady,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typeScale.label,
    color: colors.foam,
  },
  list: {
    gap: space.md,
  },
  item: {
    gap: space.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  secondary: {
    minHeight: touch.min,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  secondaryText: {
    ...typeScale.label,
    color: colors.lanternReady,
  },
  danger: {
    color: colors.danger,
  },
  empty: {
    ...typeScale.body,
    color: colors.lanternOff,
  },
});
