import { ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            gcTime: TWENTY_FOUR_HOURS,
            retry: 2,
            refetchOnReconnect: 'always',
          },
        },
      }),
    []
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: AsyncStorage,
        key: '@komanda/react-query/v1',
        throttleTime: 1000,
      }),
    []
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: TWENTY_FOUR_HOURS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
