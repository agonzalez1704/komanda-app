import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Reactive online/offline flag. `true` when reachable; `null` during first probe.
 */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const reachable =
        state.isInternetReachable ?? state.isConnected ?? false;
      setOnline(Boolean(reachable));
    });
    NetInfo.fetch().then((state) => {
      setOnline(Boolean(state.isInternetReachable ?? state.isConnected ?? false));
    });
    return () => sub();
  }, []);

  return online;
}
