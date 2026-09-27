// src/services/ApiProvider.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { MockApiAdapter } from './api/MockApiAdapter';
import { UniversityApiAdapter } from './api/UniversityApiAdapter';
import type { IApiAdapter } from './api/IApiAdapter';
import { API_MODE, API_BASE_URL } from '../core/constants';

const ApiContext = createContext<IApiAdapter | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const adapter = useMemo<IApiAdapter>(() => {
    if (API_MODE === 'production') {
      return new UniversityApiAdapter(API_BASE_URL);
    }
    return new MockApiAdapter();
  }, []);

  return <ApiContext.Provider value={adapter}>{children}</ApiContext.Provider>;
}

export function useApiAdapter(): IApiAdapter {
  const adapter = useContext(ApiContext);
  if (!adapter) {
    throw new Error('useApiAdapter must be used within an ApiProvider');
  }
  return adapter;
}
