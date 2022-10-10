import assert from 'assert';

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

import { authCircleAdminMiddleware } from '../../../../api-lib/circleAdmin';
import { DISTRIBUTION_TYPE } from '../../../../api-lib/constants';
import { formatCustomDate } from '../../../../api-lib/dateTimeHelpers';
import { adminClient } from '../../../../api-lib/gql/adminClient';
import { getEpoch } from '../../../../api-lib/gql/queries';
import { errorResponseWithStatusCode } from '../../../../api-lib/HttpError';
import { getProvider } from '../../../../api-lib/provider';
import { uploadCsv } from '../../../../api-lib/s3';
import { Awaited } from '../../../../api-lib/ts4.5shim';
import { isFeatureEnabled } from '../../../../src/config/features';
import { Contracts } from '../../../../src/lib/vaults';
import {
  allocationCsvInput,
  composeHasuraActionRequestBody,
} from '../../../../src/lib/zod';

async function handler(req: VercelRequest, res: VercelResponse) {
  const {
    input: { payload },
  } = composeHasuraActionRequestBody(allocationCsvInput).parse(req.body);

  const { circle_id, epoch_id, epoch, form_gift_amount, gift_token_symbol } =
    payload;
  const epochObj = await getEpoch(circle_id, epoch_id, epoch);
  if (!epochObj) {
    return errorResponseWithStatusCode(
      res,
      { message: 'Epoch does not exist in this circle' },
      422
    );
  }
  const grant = payload.grant ?? epochObj.grant;

  const totalTokensSent = epochObj.token_gifts.length
    ? epochObj.token_gifts.reduce((total, { tokens }) => total + tokens, 0)
    : 0;
  const circle = await getCircleDetails(circle_id, epochObj.id);
  assert(circle, 'No Circle Found');
  const fixedPaymentsEnabled =
    isFeatureEnabled('fixed_payments') && !!circle.fixed_payment_token_type;

  const userValues = generateCsvValues(
    circle,
    form_gift_amount,
    gift_token_symbol,
    totalTokensSent,
    fixedPaymentsEnabled,
    circle.fixed_payment_token_type,
    grant
  );
  console.debug('userValues', userValues);
  const headers = [
    'No',
    'name',
    'address',
    'received',
    'sent',
    'givers',
    'percentage_of_give',
    'circle_rewards',
    'circle_rewards_token',
  ];
  if (fixedPaymentsEnabled) {
    headers.push('fixed_payment_rewards');
    headers.push('fixed_payment_token_symbol');
  }
  if (grant) headers.push('Grant_amt');
  let csvText = `${headers.join(',')}\r\n`;
  userValues.forEach(rowValues => {
    csvText += `${rowValues.join(',')}\r\n`;
  });
  const fileName = `${epochObj.circle?.organization?.name}-${
    epochObj.circle?.name
  }-epoch-${epochObj.number}-date-${formatCustomDate(
    epochObj.start_date,
    'ddLLyy'
  )}-${formatCustomDate(epochObj.end_date, 'ddLLyy')}.csv`;
  const result = await uploadCsv(
    `${circle_id}/${epochObj.id}/${uuidv4()}/${fileName}`,
    csvText
  );

  res.status(200).json({
    file: result.Location,
  });
}

export function generateCsvValues(
  circle: CircleDetails,
  formGiftAmount: number,
  giftTokenSymbol: string | undefined,
  totalTokensSent: number,
  fixedPaymentsEnabled: boolean,
  fixedPaymentTokenType: string | undefined,
  grant: number | undefined
) {
  assert(circle, 'No Circle Found');
  assert(circle.epochs[0], 'No Epoch Found');

  const distEpoch = circle.epochs[0];
  const circleDist = distEpoch.distributions.find(
    d =>
      d.distribution_type === DISTRIBUTION_TYPE.GIFT ||
      d.distribution_type === DISTRIBUTION_TYPE.COMBINED
  );
  const fixedDist = distEpoch.distributions.find(
    d =>
      d.distribution_type === DISTRIBUTION_TYPE.FIXED ||
      d.distribution_type === DISTRIBUTION_TYPE.COMBINED
  );

  const unwrappedAmount = (
    id?: number,
    dist?: typeof distEpoch.distributions[0]
  ) => {
    if (!id || !dist) return { claimed: 0, fixedPayment: 0, circleClaimed: 0 };
    const claim = dist.claims.find(c => c.profile_id === id);
    const pricePerShare = dist.pricePerShare.toUnsafeFloat();
    return {
      claimed: (claim?.new_amount || 0) * pricePerShare,
      fixedPayment: (claim?.fixed_payment_amount || 0) * pricePerShare,
      circleClaimed:
        ((claim?.new_amount || 0) - (claim?.fixed_payment_amount || 0)) *
        pricePerShare,
    };
  };

  giftTokenSymbol = circleDist ? circleDist.vault.symbol : giftTokenSymbol;
  const { users } = circle;

  return (
    users?.map((u, idx) => {
      const { fixedPayment } = unwrappedAmount(u.profile?.id, fixedDist);
      const { circleClaimed: cClaimed } = unwrappedAmount(
        u.profile?.id,
        circleDist
      );
      const received = u.received_gifts.length
        ? u.received_gifts
            .map(g => g.tokens)
            .reduce((total, tokens) => tokens + total)
        : 0;

      const circleClaimed = circleDist
        ? cClaimed
        : formGiftAmount * givenPercent(received, totalTokensSent);

      const rowValues: (string | number)[] = [
        idx + 1,
        u.name,
        u.address,
        received,
        u.sent_gifts.length
          ? u.sent_gifts
              .map(g => g.tokens)
              .reduce((total, tokens) => tokens + total)
          : 0,
        u.received_gifts.length,
        (givenPercent(received, totalTokensSent) * 100).toFixed(2),
        circleClaimed.toFixed(2),
        giftTokenSymbol || '',
      ];
      if (fixedPaymentsEnabled && fixedPaymentTokenType) {
        const fixedAmount = fixedDist ? fixedPayment : u.fixed_payment_amount;
        rowValues.push(fixedAmount.toFixed(2));
        rowValues.push(fixedPaymentTokenType);
      }
      if (grant)
        rowValues.push(
          received
            ? Math.floor(((received * grant) / totalTokensSent) * 100) / 100
            : 0
        );

      return rowValues;
    }) || []
  );
}

export type CircleDetails = Awaited<ReturnType<typeof getCircleDetails>>;

export async function getCircleDetails(circle_id: number, epochId: number) {
  console.debug('epochId', epochId);

  const { circles_by_pk } = await adminClient.query(
    {
      circles_by_pk: [
        { id: circle_id },
        {
          fixed_payment_token_type: true,
          epochs: [
            {
              where: { id: { _eq: epochId } },
            },
            {
              distributions: [
                { where: { tx_hash: { _is_null: false } } },
                {
                  distribution_type: true,
                  tx_hash: true,
                  vault: {
                    symbol: true,
                    chain_id: true,
                    vault_address: true,
                    simple_token_address: true,
                    decimals: true,
                  },
                  claims: [
                    {},
                    {
                      profile_id: true,
                      new_amount: true,
                      fixed_payment_amount: true,
                    },
                  ],
                },
              ],
            },
          ],
          users: [
            {
              where: {
                _or: [{ deleted_at: { _is_null: true } }],
              },
            },
            {
              id: true,
              name: true,
              address: true,
              fixed_payment_amount: true,
              profile: { id: true },
              received_gifts: [
                { where: { epoch_id: { _eq: epochId } } },
                { tokens: true },
              ],
              sent_gifts: [
                { where: { epoch_id: { _eq: epochId } } },
                { tokens: true },
              ],
            },
          ],
        },
      ],
    },
    { operationName: 'allocationCsv_getGifts' }
  );
  const chainId =
    circles_by_pk?.epochs[0]?.distributions[0]?.vault.chain_id || 1;
  const provider = getProvider(chainId);
  const contracts = new Contracts(chainId, provider, true);
  const distributions = await Promise.all(
    circles_by_pk?.epochs[0]?.distributions.map(async dist => ({
      ...dist,
      pricePerShare: await contracts.getPricePerShare(
        dist.vault.vault_address,
        dist.vault.simple_token_address,
        dist.vault.decimals
      ),
    })) || []
  );
  const epoch = circles_by_pk?.epochs[0];
  return { ...circles_by_pk, epochs: [{ ...epoch, distributions }] };
}

export default authCircleAdminMiddleware(handler);

const givenPercent = (received: number, totalGive: number) => {
  return received / totalGive;
};
