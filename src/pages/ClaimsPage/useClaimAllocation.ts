import assert from 'assert';

import { BigNumber, BytesLike, ethers } from 'ethers';
import { vault_tx_types_enum } from 'lib/gql/__generated__/zeus';
import { client } from 'lib/gql/client';
import { savePendingVaultTx } from 'lib/gql/mutations/vaults';
import { encodeCircleId, hasSimpleToken } from 'lib/vaults';
import max from 'lodash/max';

import { useApeSnackbar, useContracts } from 'hooks';
import { sendAndTrackTx } from 'utils/contractHelpers';

import type { QueryClaim } from './queries';

export type ClaimAllocationProps = {
  claimIds: number[];
  distribution: QueryClaim['distribution'];
  amount: string;
  index: number;
  address: string;
  proof: BytesLike[];
  unwrapEth: boolean;
};

export function useClaimAllocation() {
  const contracts = useContracts();
  const { showError, showInfo } = useApeSnackbar();

  return async ({
    distribution,
    amount,
    index,
    address,
    proof,
    claimIds,
    unwrapEth,
  }: ClaimAllocationProps): Promise<string | undefined> => {
    assert(contracts, 'This network is not supported');
    const {
      vault,
      distribution_epoch_id,
      distribution_json: { circleId },
      epoch,
    } = distribution;
    const vaultContract = contracts.getVault(vault.vault_address);
    const yVaultAddress = await vaultContract.vault();
    try {
      const encodedCircleId = encodeCircleId(circleId);

      const isSimpleToken = hasSimpleToken(vault);

      const trx = await sendAndTrackTx(
        () =>
          contracts.distributor.claim(
            vault.vault_address,
            encodedCircleId,
            isSimpleToken ? vault.simple_token_address : yVaultAddress,
            BigNumber.from(distribution_epoch_id),
            BigNumber.from(index),
            address,
            amount,
            !isSimpleToken,
            proof
          ),
        {
          showInfo,
          showError,
          description: `Claim Tokens from ${
            epoch?.circle?.name || vault.vault_address
          }${epoch?.circle ? `: Epoch ${distribution.epoch.number}` : ''}`,
          chainId: contracts.chainId,
          savePending: async (txHash: string) =>
            savePendingVaultTx({
              tx_hash: txHash,
              claim_id: max(claimIds),
              chain_id: Number.parseInt(contracts.chainId),
              tx_type: vault_tx_types_enum.Claim,
            }),
        }
      );

      const { receipt, error } = trx;
      if ((error as any)?.message.match(/User denied transaction signature/))
        return;

      // some other error occurred. saveAndTrackTx will report it
      if (!receipt) return;

      const event = receipt?.events?.find(e => e.event === 'Claimed');
      const txHash = receipt?.transactionHash;
      assert(event, 'Claimed event not found');
      assert(txHash, "Claimed event didn't return a transaction hash");

      showInfo('Saving record of claim...');

      if (unwrapEth) {
        const tokenAddress = isSimpleToken
          ? vault.simple_token_address
          : vault.token_address;

        const weth = new ethers.Contract(
          tokenAddress,
          ['function withdraw(uint) public'],
          contracts.signerOrProvider
        );
        await sendAndTrackTx(() => weth.withdraw(amount), {
          showError,
          showInfo,
          signingMessage: 'Please sign the transaction to unwrap your WETH.',
          description: `Unwrapped ${amount} ETH`,
          chainId: contracts.chainId,
        });
      }

      await markClaimed({ claim_id: Math.max(...claimIds), tx_hash: txHash });
      showInfo('Claim succeeded');

      return txHash;
    } catch (e) {
      console.error(e);
      showError(e);
    }
  };
}

const markClaimed = (payload: { claim_id: number; tx_hash: string }) =>
  client.mutate(
    { markClaimed: [{ payload }, { ids: true }] },
    { operationName: 'markClaimed' }
  );
