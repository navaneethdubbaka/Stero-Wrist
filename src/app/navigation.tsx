import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../features/home/HomeScreen';
import { SettingsHubScreen } from '../features/settings/SettingsHubScreen';
import { ProfilesScreen } from '../features/profiles/ProfilesScreen';
import { ProfileEditorScreen } from '../features/profiles/ProfileEditorScreen';
import { AssistantSettingsScreen } from '../features/settings/AssistantSettingsScreen';
import { TtsSettingsScreen } from '../features/settings/TtsSettingsScreen';
import { NotificationSettingsScreen } from '../features/settings/NotificationSettingsScreen';
import { AudioSettingsScreen } from '../features/settings/AudioSettingsScreen';
import { AssistantRoleScreen } from '../features/settings/AssistantRoleScreen';
import { InboxScreen } from '../features/notifications/InboxScreen';
import { InboxDetailScreen } from '../features/notifications/InboxDetailScreen';
import { colors } from '../shared/theme/tokens';

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Profiles: undefined;
  ProfileEditor: { profileId: string };
  AssistantSettings: undefined;
  AssistantRole: undefined;
  TtsSettings: undefined;
  NotificationSettings: undefined;
  AudioSettings: undefined;
  Inbox: undefined;
  InboxDetail: { notificationId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.ink,
    card: colors.surface,
    text: colors.foam,
    border: colors.outline,
    primary: colors.lanternReady,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.foam,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.ink },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Settings" component={SettingsHubScreen} />
        <Stack.Screen
          name="Profiles"
          component={ProfilesScreen}
          options={{ title: 'Profiles' }}
        />
        <Stack.Screen
          name="ProfileEditor"
          component={ProfileEditorScreen}
          options={{ title: 'Profile' }}
        />
        <Stack.Screen
          name="AssistantSettings"
          component={AssistantSettingsScreen}
          options={{ title: 'Assistant' }}
        />
        <Stack.Screen
          name="AssistantRole"
          component={AssistantRoleScreen}
          options={{ title: 'Default assistant' }}
        />
        <Stack.Screen
          name="TtsSettings"
          component={TtsSettingsScreen}
          options={{ title: 'TTS' }}
        />
        <Stack.Screen
          name="NotificationSettings"
          component={NotificationSettingsScreen}
          options={{ title: 'Notifications' }}
        />
        <Stack.Screen
          name="Inbox"
          component={InboxScreen}
          options={{ title: 'Inbox' }}
        />
        <Stack.Screen
          name="InboxDetail"
          component={InboxDetailScreen}
          options={{ title: 'Notification' }}
        />
        <Stack.Screen
          name="AudioSettings"
          component={AudioSettingsScreen}
          options={{ title: 'Audio' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
