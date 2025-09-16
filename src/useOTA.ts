import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

export function useOTA() {
  useEffect(() => {
    // En Expo Go NO se debe chequear OTA
    if (Constants.appOwnership === 'expo') {
      console.log('[OTA] skip: Expo Go');
      return;
    }

    (async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('[OTA] error:', e);
      }
    })();
  }, []);
}
