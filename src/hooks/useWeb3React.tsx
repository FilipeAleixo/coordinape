import { useState } from 'react';

import { Web3Provider } from '@ethersproject/providers';
import {
  useWeb3React as useOriginalWeb3React,
  Web3ReactProvider as OriginalWeb3ReactProvider,
} from '@web3-react/core';
import type { Web3ReactContextInterface } from '@web3-react/core/dist/types';

import { AuthContext } from 'hooks/login';
import type { AuthStep } from 'hooks/login';

export function useWeb3React<T = any>(
  key?: string | undefined
): Web3ReactContextInterface<T> {
  // connector?: AbstractConnector;
  // library?: T;
  // chainId?: number;
  // account?: null | string;
  // active: boolean;
  // error?: Error;
  // activate: (connector: AbstractConnector, onError?: (error: Error) => void, throwErrors?: boolean) => Promise<void>;
  // setError: (error: Error) => void;
  // deactivate: () => void;

  // change this so it returns a provider from web3auth wrapped with ethers

  return useOriginalWeb3React(key);
}

export function Web3ReactProvider({
  children,
}: {
  children: any;
}): JSX.Element {
  const authStepState = useState<AuthStep>('connect');

  return (
    <OriginalWeb3ReactProvider getLibrary={getLibrary}>
      <AuthContext.Provider value={authStepState}>
        {children}
      </AuthContext.Provider>
    </OriginalWeb3ReactProvider>
  );
}

function getLibrary(provider: any): Web3Provider {
  // This checks specifically whether the provider is
  // an instance of a Web3Provider by checking the existence of this
  // uniquely named method. Normally, we would want to use `instanceof`
  // to check if a provider conforms to a specific class, but because
  // some providers are injected into the window from other contexts,
  // this check will fail, since those providers aren't derived from
  // the same prototype tree.
  const library =
    typeof provider.jsonRpcFetchFunc !== 'undefined'
      ? provider
      : new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
}
