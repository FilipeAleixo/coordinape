import { styled } from '../../stitches.config';
import { Box } from '../../ui';

export const ConstrainedBox = styled(Box, {
  width: '70%',
  '@md': {
    width: '100%',
  },
});
