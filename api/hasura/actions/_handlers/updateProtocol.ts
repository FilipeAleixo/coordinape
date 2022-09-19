import { VercelRequest, VercelResponse } from '@vercel/node';

import { updateProtocol } from '../../../../api-lib/gql/mutations';
import { authProtocolAdminMiddleware } from '../../../../api-lib/protocolAdmin';
import {
  composeHasuraActionRequestBody,
  updateProtocolInput,
} from '../../../../src/lib/zod';

const requestSchema = composeHasuraActionRequestBody(updateProtocolInput);

async function handler(req: VercelRequest, res: VercelResponse) {
  const {
    input: { payload: input },
  } = await requestSchema.parseAsync(req.body);

  const updated = await updateProtocol(input);

  res.status(200).json(updated);
}

export default authProtocolAdminMiddleware(handler);
