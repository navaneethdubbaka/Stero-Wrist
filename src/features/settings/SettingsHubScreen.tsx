import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../shared/ui/Screen';
import { ListRow } from '../../shared/ui/ListRow';
import { colors, type as typeScale } from '../../shared/theme/tokens';
import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from './settingsStore';
import type { RootStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsHubScreen({ navigation }: Props) {
  const active = useProfilesStore((s) => s.getActiveProfile());
  const tts = useSettingsStore((s) => s.settings.tts);
  const assistant = useSettingsStore((s) => s.settings.assistant);

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.group}>
        <ListRow
          title="Backend profiles"
          subtitle={active ? `Active: ${active.name}` : 'No active profile'}
          onPress={() => navigation.navigate('Profiles')}
        />
        <ListRow
          title="Webhook"
          subtitle={
            active
              ? active.webhook.url || 'Configure URL and auth'
              : 'Select or create a profile first'
          }
          onPress={() => {
            if (active) {
              navigation.navigate('ProfileEditor', { profileId: active.id });
            } else {
              navigation.navigate('Profiles');
            }
          }}
        />
        <ListRow
          title="Assistant"
          subtitle={assistant.enabled ? `Mode: ${assistant.defaultMode}` : 'Disabled'}
          onPress={() => navigation.navigate('AssistantSettings')}
        />
        <ListRow
          title="Default assistant role"
          subtitle="Watch button → Stero Wrist (Android)"
          onPress={() => navigation.navigate('AssistantRole')}
        />
        <ListRow
          title="Text to speech"
          subtitle={`Provider: ${tts.provider}`}
          onPress={() => navigation.navigate('TtsSettings')}
        />
        <ListRow
          title="Notifications"
          subtitle="Stub — FCM in Phase 6"
          onPress={() => navigation.navigate('NotificationSettings')}
        />
        <ListRow
          title="Audio"
          subtitle="Input route + mic probe"
          onPress={() => navigation.navigate('AudioSettings')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  group: {
    gap: 10,
  },
});
