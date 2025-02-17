import assert from 'assert';
import React, { useState, useMemo, useEffect } from 'react';

import { constants as ethersConstants } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { isUserAdmin } from 'lib/users';
import { useQuery } from 'react-query';
import { NavLink } from 'react-router-dom';
import { disabledStyle } from 'stitches.config';

import { LoadingModal } from 'components';
import { useApeSnackbar, useApiAdminCircle, useContracts } from 'hooks';
import { useCircleOrg } from 'hooks/gql/useCircleOrg';
import { useVaults } from 'hooks/gql/useVaults';
import useMobileDetect from 'hooks/useMobileDetect';
import { Search } from 'icons/__generated';
import {
  getCircleSettings,
  QUERY_KEY_CIRCLE_SETTINGS,
} from 'pages/CircleAdminPage/getCircleSettings';
import {
  getFixedPayment,
  QUERY_KEY_FIXED_PAYMENT,
} from 'pages/CircleAdminPage/getFixedPayment';
import { useSelectedCircle } from 'recoilState/app';
import { NEW_CIRCLE_CREATED_PARAMS, paths } from 'routes/paths';
import { AppLink, Button, Flex, Modal, Panel, Text, TextField } from 'ui';
import { SingleColumnLayout } from 'ui/layouts';
import { numberWithCommas } from 'utils';

import {
  getActiveNominees,
  QUERY_KEY_ACTIVE_NOMINEES,
} from './getActiveNominees';
import { LeaveCircleModal } from './LeaveCircleModal';
import { MembersTable } from './MembersTable';
import { NomineesTable } from './NomineeTable';

import { IUser } from 'types';

export interface IDeleteUser {
  name: string;
  address: string;
}

const MembersPage = () => {
  const { isMobile } = useMobileDetect();
  const { showError } = useApeSnackbar();

  const [keyword, setKeyword] = useState<string>('');
  const [deleteUserDialog, setDeleteUserDialog] = useState<
    IDeleteUser | undefined
  >(undefined);
  const [leaveCircleDialog, setLeaveCircleDialog] = useState<
    IDeleteUser | undefined
  >(undefined);
  const [newCircle, setNewCircle] = useState<boolean>(false);
  const [maxGiftTokens, setMaxGiftTokens] = useState(ethersConstants.Zero);

  useEffect(() => {
    // do this initialization in useEffect because window is only available client side -g
    if (typeof window !== 'undefined') {
      setNewCircle(window.location.search === NEW_CIRCLE_CREATED_PARAMS);
    }
  }, []);

  const {
    circleId,
    myUser: me,
    users: visibleUsers,
    circle: selectedCircle,
    circleEpochsStatus,
  } = useSelectedCircle();

  const {
    isError: circleSettingsHasError,
    error: circleSettingsError,
    data: circle,
  } = useQuery(
    [QUERY_KEY_CIRCLE_SETTINGS, circleId],
    () => getCircleSettings(circleId),
    {
      initialData: selectedCircle,
      enabled: !!circleId,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      notifyOnChangeProps: ['data'],
    }
  );

  const {
    isError: activeNomineesHasError,
    error: activeNomineesError,
    data: activeNominees,
    refetch: refetchNominees,
  } = useQuery(
    [QUERY_KEY_ACTIVE_NOMINEES, circleId],
    () => getActiveNominees(circleId),
    {
      // the query will not be executed untill circleId exists
      enabled: !!circleId,

      //minmize background refetch
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      notifyOnChangeProps: ['data'],
    }
  );

  const {
    isError: fixedPaymentHasError,
    error: fixedPaymentError,
    data: fixedPayment,
  } = useQuery(
    [QUERY_KEY_FIXED_PAYMENT, circleId],
    () => getFixedPayment(circleId),
    {
      // the query will not be executed untill circleId exists
      enabled: !!circleId,
      //minmize background refetch
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      notifyOnChangeProps: ['data'],
    }
  );

  const onChangeKeyword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(event.target.value);
  };

  const isAdmin = isUserAdmin(me);

  const contracts = useContracts();
  const orgQuery = useCircleOrg(circleId);
  const { deleteUser } = useApiAdminCircle(circleId);

  const vaultsQuery = useVaults({
    orgId: orgQuery.data?.id,
    chainId: Number(contracts?.chainId),
  });

  const vaultOptions = vaultsQuery.data
    ? [
        { value: '', label: '- None -' },
        ...vaultsQuery.data.map(vault => {
          return { value: vault.id, label: vault.symbol };
        }),
      ]
    : [
        {
          value: '',
          label:
            vaultsQuery.isLoading || orgQuery.isLoading
              ? 'Loading...'
              : 'None Available',
        },
      ];

  useEffect(() => {
    updateBalanceState(stringifiedVaultId());
  }, [vaultOptions.length]);

  const nomineeCount = activeNominees?.length || 0;
  const cannotVouch = circle?.only_giver_vouch && me.non_giver;

  // User Columns
  const filterUser = useMemo(
    () => (u: IUser) => {
      const r = new RegExp(keyword, 'i');
      return r.test(u.name) || r.test(u.address);
    },
    [keyword]
  );

  const refetch = () => {
    refetchNominees();
  };

  const findVault = (vaultId: string) => {
    return vaultsQuery?.data?.find(v => v.id === parseInt(vaultId));
  };

  const updateBalanceState = async (vaultId: string): Promise<void> => {
    assert(circle);
    const vault = findVault(vaultId);
    assert(contracts, 'This network is not supported');

    if (vault) {
      const tokenBalance = await contracts.getVaultBalance(vault);
      setMaxGiftTokens(tokenBalance);
    } else {
      setMaxGiftTokens(ethersConstants.Zero);
    }
  };

  const stringifiedVaultId = () => {
    const id = circle?.fixed_payment_vault_id;
    if (id == null) {
      return '';
    }
    return `${id}`;
  };

  const getDecimals = (vaultId: string) => {
    if (vaultId) {
      const v = findVault(vaultId);
      if (v) return v.decimals;
    }
    return 0;
  };

  const availableFixedTokens = numberWithCommas(
    formatUnits(maxGiftTokens, getDecimals(stringifiedVaultId()))
  );

  if (!activeNominees || !circle || !fixedPayment)
    return <LoadingModal visible />;

  if (activeNomineesHasError) {
    if (activeNomineesError instanceof Error) {
      showError(activeNomineesError.message);
    }
  }
  if (circleSettingsHasError) {
    if (circleSettingsError instanceof Error) {
      showError(circleSettingsError.message);
    }
  }
  if (fixedPaymentHasError) {
    if (fixedPaymentError instanceof Error) {
      showError(fixedPaymentError.message);
    }
  }
  return (
    <SingleColumnLayout>
      <Flex alignItems="center" css={{ mb: '$md' }}>
        <Text h1>Circle Members</Text>
        {!isMobile && (
          <Flex
            css={{
              flexGrow: 1,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: '$md',
            }}
          >
            <Text size={'small'} css={{ color: '$headingText' }}>
              <Text>
                {visibleUsers.length} Member
                {visibleUsers.length > 1 ? 's' : ''}
              </Text>
              {circle?.vouching && (
                <>
                  <Text
                    css={{
                      whiteSpace: 'pre-wrap',
                      color: '$secondaryText',
                    }}
                  >
                    {' | '}
                  </Text>
                  <Text>
                    {nomineeCount} Nominee{nomineeCount > 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </Text>
            {isAdmin && (
              <Button
                as={NavLink}
                to={paths.membersAdd(selectedCircle.id)}
                color="primary"
                outlined
                size="small"
              >
                Add Members
              </Button>
            )}
            {circle?.hasVouching && (
              <Button
                as={NavLink}
                to={paths.membersNominate(selectedCircle.id)}
                size="small"
                color="primary"
                outlined
                tabIndex={cannotVouch ? -1 : 0}
                css={cannotVouch ? disabledStyle : {}}
              >
                Nominate Member
              </Button>
            )}
          </Flex>
        )}
      </Flex>
      <Text size="medium" css={{ mb: '$lg' }}>
        Manage, nominate and vouch for members.
      </Text>

      {isMobile && (
        <Flex
          column
          css={{
            width: 'auto',
            marginTop: '$xl',
            gap: '$sm',
          }}
        >
          <Text h3>Users</Text>
          <Text size={'small'} css={{ color: '$headingText' }}>
            <Text>
              {visibleUsers.length} Member
              {visibleUsers.length > 1 ? 's' : ''}
            </Text>
            {circle?.vouching && (
              <>
                <Text css={{ whiteSpace: 'pre-wrap', color: '$secondaryText' }}>
                  {' | '}
                </Text>
                <Text>
                  {nomineeCount} Nominee{nomineeCount > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </Text>
          <Flex
            css={{
              flexWrap: 'wrap',
              justifyContent: 'flex-start',
              gap: '$sm',
            }}
          >
            {isAdmin && (
              <AppLink to={paths.membersAdd(selectedCircle.id)}>
                <Button
                  color="primary"
                  outlined
                  size="small"
                  css={{ minWidth: '130px' }}
                >
                  Add Members
                </Button>
              </AppLink>
            )}
            {circle?.hasVouching && (
              <AppLink to={paths.membersNominate(selectedCircle.id)}>
                <Button
                  size="small"
                  color="primary"
                  outlined
                  disabled={cannotVouch}
                  css={{ minWidth: '130px' }}
                >
                  Nominate Member
                </Button>
              </AppLink>
            )}
          </Flex>
        </Flex>
      )}
      {circle?.vouching && (
        <NomineesTable
          refetchNominees={refetch}
          isNonGiverVoucher={circle?.only_giver_vouch}
          myUser={me}
          nominees={activeNominees}
          vouchingText={circle.vouchingText}
        />
      )}
      <Panel>
        <Flex css={{ justifyContent: 'space-between', mb: '$md' }}>
          <Text h3 css={{ fontWeight: '$semibold', color: '$headingText' }}>
            Members
          </Text>
          <Flex alignItems="center" css={{ gap: '$sm' }}>
            <Search color="neutral" />
            <TextField
              inPanel
              size="sm"
              onChange={onChangeKeyword}
              placeholder="Search"
              value={keyword}
            />
          </Flex>
        </Flex>
        {circle && (
          <MembersTable
            visibleUsers={visibleUsers}
            myUser={me}
            circle={circle}
            filter={filterUser}
            perPage={15}
            fixedPayment={fixedPayment}
            availableInVault={availableFixedTokens}
            setDeleteUserDialog={setDeleteUserDialog}
            setLeaveCircleDialog={setLeaveCircleDialog}
          />
        )}
      </Panel>
      {}
      <Modal
        open={newCircle}
        title="Congrats! You just launched a new circle."
        onOpenChange={() => setNewCircle(false)}
      >
        <Flex column alignItems="start" css={{ gap: '$md' }}>
          <Text p>
            {selectedCircle.organization.sample &&
            /* this length check is the only way to know that this was the prepopulated circle */
            visibleUsers.length > 2 ? (
              <>
                We’ve set you up with a sample circle prepopulated with members
                and data. Feel free to add real people and experiment! Make your
                own non-sample circle when you are ready.
              </>
            ) : (
              <>
                You’ll need to add your teammates to your circle and schedule an
                epoch before you can start allocating {circle?.tokenName}.
              </>
            )}
          </Text>
          <Button color="primary" onClick={() => setNewCircle(false)}>
            I Understand
          </Button>
        </Flex>
      </Modal>
      <Modal
        open={!!deleteUserDialog}
        title={`Remove ${deleteUserDialog?.name} from circle`}
        onOpenChange={() => setDeleteUserDialog(undefined)}
      >
        <Flex column alignItems="start" css={{ gap: '$md' }}>
          <Button
            color="destructive"
            onClick={
              deleteUserDialog
                ? () =>
                    deleteUser(deleteUserDialog.address)
                      .then(() => setDeleteUserDialog(undefined))
                      .catch(() => setDeleteUserDialog(undefined))
                : undefined
            }
          >
            Remove
          </Button>
        </Flex>
      </Modal>
      <LeaveCircleModal
        epochIsActive={circleEpochsStatus.epochIsActive}
        leaveCircleDialog={leaveCircleDialog}
        setLeaveCircleDialog={setLeaveCircleDialog}
        circleName={circle?.name}
        circleId={circle?.id}
      ></LeaveCircleModal>
    </SingleColumnLayout>
  );
};

export default MembersPage;
