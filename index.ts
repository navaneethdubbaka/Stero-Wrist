import { registerRootComponent } from 'expo';

import App from './App';
import { startAssistantActivationListeners } from './src/features/assistant/assistantActivation';
import { useProfilesStore } from './src/features/profiles/profilesStore';
import { useSettingsStore } from './src/features/settings/settingsStore';
import { hydratePrefs } from './src/shared/storage/prefs';

void (async () => {
  try {
    await hydratePrefs();
  } catch {
    // listeners still needed so hangup can transcribe
  }
  try {
    useProfilesStore.getState().hydrate();
    useSettingsStore.getState().hydrate();
  } catch {
    // ignore
  }
  startAssistantActivationListeners();
})();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
