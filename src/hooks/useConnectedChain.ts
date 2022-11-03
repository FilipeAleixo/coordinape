import { useWeb3React } from '@web3-react/core';
import { loginSupportedChainIds } from 'lib/login';

export default function useConnectedChain() {
  const { chainId } = useWeb3React();
  return {
    chainId,
    chainName: (chainId && loginSupportedChainIds[chainId]) || undefined,
  };
}
