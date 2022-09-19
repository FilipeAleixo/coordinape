import type {
  VercelRequest,
  VercelResponse,
  VercelApiHandler,
} from '@vercel/node';

import {
  updateProtocolInput,
  composeHasuraActionRequestBody,
} from '../src/lib/zod';

import { getUserFromProfileId } from './findUser';
import { UnauthorizedError } from './HttpError';
import { verifyHasuraRequestMiddleware } from './validate';

const requestSchema = composeHasuraActionRequestBody(updateProtocolInput);

const middleware =
  (handler: VercelApiHandler) =>
  async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const {
      input: { payload: input },
      session_variables: sessionVariables,
    } = await requestSchema.parseAsync(req.body);

    // the admin role is validated early by zod
    if (sessionVariables.hasuraRole === 'admin') {
      await handler(req, res);
      return;
    }

    if (sessionVariables.hasuraRole === 'user') {
      const profileId = sessionVariables.hasuraProfileId;

      // Protocol admin defined as admin of any circle belonging to Org
      const { role } = await getUserFromProfileId(profileId, 1);
      if (isCircleAdmin(role)) {
        await handler(req, res);
        input;
        return;
      }
    }

    // Reject request if not validated above
    throw new UnauthorizedError('User not circle admin');
  };

const isCircleAdmin = (role: number): boolean => role === 1;

export const authProtocolAdminMiddleware = (handler: VercelApiHandler) =>
  verifyHasuraRequestMiddleware(middleware(handler));
