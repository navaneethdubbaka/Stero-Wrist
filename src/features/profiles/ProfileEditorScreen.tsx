import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../shared/ui/Screen';
import { FormField } from '../../shared/ui/FormField';
import { colors, space, touch, type as typeScale } from '../../shared/theme/tokens';
import { useProfilesStore } from './profilesStore';
import type { AuthType, WebhookConfig } from '../../shared/types/settings';
import type { RootStackParamList } from '../../app/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEditor'>;

const AUTH_OPTIONS: AuthType[] = ['none', 'bearer', 'api_key', 'header'];

export function ProfileEditorScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const profile = useProfilesStore((s) =>
    s.profiles.find((p) => p.id === profileId),
  );
  const updateProfile = useProfilesStore((s) => s.updateProfile);
  const updateWebhook = useProfilesStore((s) => s.updateWebhook);
  const saveToken = useProfilesStore((s) => s.saveToken);
  const setActiveProfile = useProfilesStore((s) => s.setActiveProfile);
  const activeProfileId = useProfilesStore((s) => s.activeProfileId);

  const [tokenDraft, setTokenDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const httpWarning = useMemo(() => {
    const url = profile?.webhook.url ?? '';
    if (!url) return null;
    if (url.startsWith('http://')) {
      return 'HTTP is allowed for local testing; prefer HTTPS in production.';
    }
    if (url && !url.startsWith('https://') && !url.startsWith('http://')) {
      return 'URL should start with https://';
    }
    return null;
  }, [profile?.webhook.url]);

  if (!profile) {
    return (
      <Screen>
        <Text style={styles.title}>Profile not found</Text>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </Screen>
    );
  }

  const patchWebhook = (patch: Partial<WebhookConfig>) => {
    updateWebhook(profile.id, { ...profile.webhook, ...patch });
  };

  const onSaveToken = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await saveToken(profile.id, tokenDraft);
      setTokenDraft('');
      setMessage(
        tokenDraft.trim()
          ? 'Token saved to secure storage.'
          : 'Token cleared.',
      );
    } catch {
      Alert.alert('Secure storage error', 'Could not save the token on this device.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>{profile.name}</Text>

      <FormField
        label="Profile name"
        value={profile.name}
        onChangeText={(name) => updateProfile(profile.id, { name })}
        autoCapitalize="words"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Active profile</Text>
        <Switch
          value={activeProfileId === profile.id}
          onValueChange={(on) => setActiveProfile(on ? profile.id : null)}
        />
      </View>

      <Text style={styles.section}>Webhook</Text>
      <FormField
        label="Webhook URL"
        value={profile.webhook.url}
        onChangeText={(url) => patchWebhook({ url })}
        placeholder="https://your-hermes-server.example/webhook"
        keyboardType="url"
        hint={httpWarning ?? undefined}
      />

      <View style={styles.row}>
        <Text style={styles.label}>Method</Text>
        <View style={styles.chips}>
          {(['POST', 'PUT'] as const).map((method) => (
            <Pressable
              key={method}
              style={[
                styles.chip,
                profile.webhook.method === method && styles.chipOn,
              ]}
              onPress={() => patchWebhook({ method })}
            >
              <Text style={styles.chipText}>{method}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.rowWrap}>
        <Text style={styles.label}>Authentication</Text>
        <View style={styles.chips}>
          {AUTH_OPTIONS.map((authType) => (
            <Pressable
              key={authType}
              style={[
                styles.chip,
                profile.webhook.authType === authType && styles.chipOn,
              ]}
              onPress={() => patchWebhook({ authType })}
            >
              <Text style={styles.chipText}>{authType}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FormField
        label="Bearer / API token"
        value={tokenDraft}
        onChangeText={setTokenDraft}
        placeholder={
          profile.webhook.tokenSecretId
            ? 'Token saved — enter new value to replace'
            : 'Paste token (stored securely)'
        }
        secureTextEntry
        hint="Tokens are stored in the OS secure store, not in preferences."
      />
      <Pressable
        style={[styles.button, saving && styles.disabled]}
        onPress={() => void onSaveToken()}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {tokenDraft.trim() ? 'Save token' : 'Clear token'}
        </Text>
      </Pressable>
      {message ? <Text style={styles.message}>{message}</Text> : null}

      <FormField
        label="Request JSON template"
        value={profile.webhook.requestTemplate}
        onChangeText={(requestTemplate) => patchWebhook({ requestTemplate })}
        multiline
      />
      <FormField
        label="Response path"
        value={profile.webhook.responseMapping.responsePath}
        onChangeText={(responsePath) =>
          patchWebhook({
            responseMapping: {
              ...profile.webhook.responseMapping,
              responsePath,
            },
          })
        }
        placeholder="response"
      />
      <FormField
        label="Session ID path"
        value={profile.webhook.responseMapping.sessionIdPath ?? ''}
        onChangeText={(sessionIdPath) =>
          patchWebhook({
            responseMapping: {
              ...profile.webhook.responseMapping,
              sessionIdPath: sessionIdPath || undefined,
            },
          })
        }
        placeholder="session_id"
      />
      <FormField
        label="Timeout (ms)"
        value={String(profile.webhook.timeoutMs)}
        onChangeText={(text) => {
          const timeoutMs = Number(text.replace(/[^0-9]/g, '')) || 0;
          patchWebhook({ timeoutMs });
        }}
        keyboardType="numeric"
      />
      <FormField
        label="Retry attempts"
        value={String(profile.webhook.retry.maxAttempts)}
        onChangeText={(text) => {
          const maxAttempts = Number(text.replace(/[^0-9]/g, '')) || 0;
          patchWebhook({
            retry: { ...profile.webhook.retry, maxAttempts },
          });
        }}
        keyboardType="numeric"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typeScale.title,
    color: colors.foam,
  },
  section: {
    ...typeScale.label,
    color: colors.mist,
    marginTop: space.sm,
  },
  row: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  rowWrap: {
    gap: space.sm,
  },
  label: {
    ...typeScale.label,
    color: colors.mist,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.lanternReady,
    backgroundColor: colors.brandBand,
  },
  chipText: {
    ...typeScale.caption,
    color: colors.foam,
  },
  button: {
    minHeight: touch.min,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandBand,
    borderWidth: 1,
    borderColor: colors.lanternReady,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...typeScale.label,
    color: colors.foam,
  },
  message: {
    ...typeScale.caption,
    color: colors.lanternReady,
  },
  link: {
    ...typeScale.label,
    color: colors.lanternReady,
  },
});
