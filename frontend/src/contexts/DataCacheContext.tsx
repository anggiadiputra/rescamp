import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";

interface CacheItem<T = any> {
  data: T;
  timestamp: number;
}

interface DataCacheContextType {
  getCachedData: <T = any>(key: string) => T | undefined;
  setCachedData: <T = any>(key: string, data: T) => void;
  invalidateCache: (keyPrefix?: string) => void;
}

const DataCacheContext = createContext<DataCacheContextType | null>(null);

const DEFAULT_TTL_MS = 5 * 60_000; // 5 minutes cache TTL

export function DataCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CacheItem>>(new Map());

  const getCachedData = useCallback(<T = any>(key: string): T | undefined => {
    const item = cacheRef.current.get(key);
    if (!item) return undefined;
    if (Date.now() - item.timestamp > DEFAULT_TTL_MS) {
      cacheRef.current.delete(key);
      return undefined;
    }
    return item.data as T;
  }, []);

  const setCachedData = useCallback(<T = any>(key: string, data: T) => {
    cacheRef.current.set(key, { data, timestamp: Date.now() });
  }, []);

  const invalidateCache = useCallback((keyPrefix?: string) => {
    if (!keyPrefix) {
      cacheRef.current.clear();
      return;
    }
    for (const key of cacheRef.current.keys()) {
      if (key.startsWith(keyPrefix)) {
        cacheRef.current.delete(key);
      }
    }
  }, []);

  return (
    <DataCacheContext.Provider value={{ getCachedData, setCachedData, invalidateCache }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const ctx = useContext(DataCacheContext);
  if (!ctx) {
    throw new Error("useDataCache must be used within DataCacheProvider");
  }
  return ctx;
}

/**
 * Custom hook implementing Stale-While-Revalidate (SWR) fetching.
 * If data exists in client cache, returns cached data IMMEDIATELY with loading: false (0ms instant render!),
 * and refetches in background to seamlessly refresh stale data.
 */
export function useCachedFetch<T = any>(
  key: string,
  fetcherFn: () => Promise<T>,
  deps: any[] = []
) {
  const { getCachedData, setCachedData } = useDataCache();
  const cachedInitial = getCachedData<T>(key);

  const [data, setData] = useState<T | undefined>(cachedInitial);
  const [loading, setLoading] = useState<boolean>(cachedInitial === undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const refetch = useCallback(async () => {
    if (data !== undefined) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const freshData = await fetcherFn();
      setCachedData(key, freshData);
      setData(freshData);
      return freshData;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [key, fetcherFn, setCachedData]);

  useEffect(() => {
    let isMounted = true;
    const existing = getCachedData<T>(key);
    if (existing !== undefined) {
      setData(existing);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetcherFn()
      .then((res) => {
        if (isMounted) {
          setCachedData(key, res);
          setData(res);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [key, ...deps]);

  return { data, setData, loading, isRefreshing, error, refetch };
}
