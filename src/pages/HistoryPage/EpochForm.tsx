import { useState, useMemo, useEffect, useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import isEmpty from 'lodash/isEmpty';
import { DateTime, Interval } from 'luxon';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { SafeParseReturnType, z } from 'zod';

import { FormRadioGroup, FormDatePicker, FormTimePicker } from 'components';
import { useApiAdminCircle } from 'hooks';
import { Info } from 'icons/__generated';
import {
  Box,
  Flex,
  Form,
  FormLabel,
  Link,
  Text,
  Button,
  Panel,
  Select,
  Tooltip,
} from 'ui';

import { IQueryEpoch, QueryFutureEpoch } from './getHistoryData';

const longFormat = "DD 'at' H:mm";

interface IEpochFormSource {
  epoch?: IQueryEpoch;
  epochs?: IQueryEpoch[];
}
const EpochRepeatEnum = z.enum(['none', 'monthly', 'weekly']);
type TEpochRepeatEnum = typeof EpochRepeatEnum['_type'];

const submitSchema = z
  .object({
    start_date: z.string(),
    end_date: z.string(),
    repeat: EpochRepeatEnum,
    weekDay: z.string(),
    repeat_view: z.boolean(),
    dayOfMonth: z.string(),
    repeatStartDate: z.string(),
    days: z
      .number()
      .refine(n => n >= 1, { message: 'Must be at least one day.' })
      .refine(n => n <= 100, { message: 'cant be more than 100 days' }),
    customError: z.undefined(), //unregistered to disable submitting
  })
  .strict();

const schema = z
  .object({
    start_date: z.string(),
    end_date: z.string(),
    repeat: EpochRepeatEnum,
    weekDay: z.string(),
    dayOfMonth: z.string(),
    repeatStartDate: z.string(),
    repeat_view: z.boolean(),
    customError: z.undefined(), //unregistered to disable submitting
  })
  .strict();

const nextIntervalFactory = (repeat: TEpochRepeatEnum) => {
  const increment = repeat === 'weekly' ? { weeks: 1 } : { months: 1 };
  return (i: Interval) =>
    Interval.fromDateTimes(i.start.plus(increment), i.end.plus(increment));
};

const extraEpoch = (raw: QueryFutureEpoch): IQueryEpoch => {
  const startDate = DateTime.fromISO(raw.start_date, {
    zone: 'utc',
  });
  const endDate = DateTime.fromISO(raw.end_date, { zone: 'utc' });

  const calculatedDays = endDate.diff(startDate, 'days').days;

  const repeatEnum =
    raw.repeat === 2 ? 'monthly' : raw.repeat === 1 ? 'weekly' : 'none';

  return {
    ...raw,
    repeatEnum,
    startDate,
    interval: startDate.until(endDate),
    calculatedDays,
  };
};

const getCollisionMessage = (
  newInterval: Interval,
  newRepeat: TEpochRepeatEnum,
  e: IQueryEpoch
) => {
  if (
    newInterval.overlaps(e.interval) ||
    (e.repeatEnum === 'none' && newRepeat === 'none')
  ) {
    return newInterval.overlaps(e.interval)
      ? `Overlap with an epoch starting ${e.startDate.toFormat(longFormat)}`
      : undefined;
  }
  // Only one will be allowed to be repeating
  // Set r as the repeating and c as the constant interval.
  const [r, c, next] =
    e.repeatEnum !== 'none'
      ? [e.interval, newInterval, nextIntervalFactory(e.repeatEnum)]
      : [newInterval, e.interval, nextIntervalFactory(newRepeat)];

  if (c.isBefore(r.start) || +c.end === +r.start) {
    return undefined;
  }

  let rp = r;
  while (rp.start < c.end) {
    if (rp.overlaps(c)) {
      return e.repeatEnum !== 'none'
        ? `Overlap with repeating epoch ${e.number ?? 'x'}: ${rp.toFormat(
            longFormat
          )}`
        : `After repeat, new epoch overlaps ${
            e.number ?? 'x'
          }: ${e.startDate.toFormat(longFormat)}`;
    }
    rp = next(rp);
  }

  return undefined;
};

const getZodParser = (source?: IEpochFormSource, currentEpoch?: number) => {
  const otherRepeating = source?.epochs?.find(e => !!e.repeat);

  const getOverlapIssue = ({
    start_date,
    end_date,
    repeat,
  }: {
    start_date: DateTime;
    end_date: DateTime;
    repeat: TEpochRepeatEnum;
  }) => {
    const interval = Interval.fromDateTimes(start_date, end_date);

    const collisionMessage = source?.epochs
      ? source?.epochs
          .map(e => getCollisionMessage(interval, repeat, e))
          .find(m => m !== undefined)
      : undefined;

    return collisionMessage === undefined
      ? undefined
      : {
          path: ['start_dateTime'],
          message: collisionMessage,
        };
  };

  return schema
    .transform(({ start_date, end_date, ...fields }) => ({
      start_date: DateTime.fromISO(start_date).setZone(),
      end_date: DateTime.fromISO(end_date).setZone(),
      ...fields,
    }))
    .transform(({ repeat_view, repeat, repeatStartDate, ...fields }) => {
      if (repeat_view) {
        const now = DateTime.now();
        const weekday = Number.parseInt(fields.weekDay);
        if (repeat === 'monthly')
          return {
            repeat_view,
            repeat: repeat as TEpochRepeatEnum,
            repeatStartDate,
            ...fields,
            start_date: DateTime.fromISO(repeatStartDate),
            end_date: DateTime.fromISO(repeatStartDate).plus({ weeks: 2 }),
          };
        if (repeat === 'weekly')
          return {
            repeat_view,
            repeat: repeat as TEpochRepeatEnum,
            repeatStartDate,
            ...fields,
            start_date:
              now.weekday >= weekday
                ? now.plus({ weeks: 1 }).set({ weekday })
                : now.set({ weekday }),
            end_date: DateTime.fromISO(repeatStartDate).plus({ weeks: 1 }),
          };
      }
      return {
        repeat_view,
        repeat: repeat as TEpochRepeatEnum,
        repeatStartDate,
        ...fields,
      };
    })
    .refine(
      ({ start_date }) =>
        start_date > DateTime.now().setZone() ||
        source?.epoch?.id === currentEpoch,
      {
        path: ['start_date'],
        message: 'Start date must be in the future',
      }
    )
    .refine(
      ({ end_date }) => {
        return end_date > DateTime.now().setZone();
      },
      {
        path: ['end_date'],
        message: 'Epoch must end in the future',
      }
    )
    .refine(({ repeat }) => !(repeat !== 'none' && !!otherRepeating), {
      path: ['repeat'],
      // the getOverlapIssue relies on this invariant.
      message: `Only one repeating epoch allowed.`,
    })
    .refine(
      v => !getOverlapIssue(v),
      v => getOverlapIssue(v) ?? {}
    )
    .transform(({ start_date, end_date, ...fields }) => ({
      start_date: start_date.toISO(),
      end_date: start_date.toISO(),
      days: end_date.diff(start_date, 'days').days,
      ...fields,
    }));
};

type epochFormSchema = z.infer<typeof schema>;
type epochSubmissionSchema = z.infer<typeof submitSchema>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const repeat = [
  {
    label: 'Monthly',
    value: 'monthly',
  },
  {
    label: 'Weekly',
    value: 'weekly',
  },
];

const EpochForm = ({
  selectedEpoch,
  epochs,
  currentEpoch,
  circleId,
  setNewEpoch,
  setEditEpoch,
  onClose,
}: {
  selectedEpoch: QueryFutureEpoch | undefined;
  epochs: QueryFutureEpoch[] | undefined;
  currentEpoch: QueryFutureEpoch | undefined;
  circleId: number;
  setNewEpoch: (e: boolean) => void;
  setEditEpoch: (e: QueryFutureEpoch | undefined) => void;
  onClose: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  const { createEpoch, updateEpoch } = useApiAdminCircle(circleId);

  const source = useMemo(
    () => ({
      epoch: selectedEpoch ? extraEpoch(selectedEpoch) : undefined,
      epochs: currentEpoch
        ? currentEpoch.id !== selectedEpoch?.id
          ? epochs
              ?.filter(e => e.id !== selectedEpoch?.id)
              .concat(currentEpoch)
              .map(e => extraEpoch(e))
          : epochs?.map(e => extraEpoch(e))
        : epochs
            ?.filter(e => e.id !== selectedEpoch?.id)
            .map(e => extraEpoch(e)),
    }),
    [selectedEpoch, epochs, currentEpoch]
  );

  const {
    control,
    formState: { errors, isDirty },
    getValues,
    setValue,
    watch,
    handleSubmit,
    setError,
    clearErrors,
  } = useForm<epochFormSchema>({
    resolver: zodResolver(schema),
    mode: 'all',
    defaultValues: {
      repeat_view: true,
      repeatStartDate: getMonthStartDates(
        ((DateTime.now().day + 1) % 29 || 1).toString()
      )[0].value,
      repeat: 'monthly',
      dayOfMonth: ((DateTime.now().day + 1) % 29 || 1).toString(),
      weekDay: '1',
      start_date:
        source?.epoch?.start_date ??
        DateTime.now().setZone().plus({ days: 1 }).toISO(),
      end_date: source?.epoch?.end_date
        ? DateTime.fromISO(source.epoch.end_date)
            .plus(source.epoch.days || 0)
            .toISO()
        : DateTime.now().setZone().plus({ days: 8 }).toISO(),
    },
  });

  const watchFields = useRef<
    Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
  >({
    weekDay: '1',
    end_date:
      source?.epoch?.end_date ??
      DateTime.now().setZone().plus({ days: 15 }).toISO(),
    start_date:
      source?.epoch?.start_date ??
      DateTime.now().setZone().plus({ days: 1 }).toISO(),
    repeat_view: true,
    dayOfMonth: '5',
    repeatStartDate: '',
    repeat:
      source?.epoch?.repeat === 2
        ? 'monthly'
        : source?.epoch?.repeat === 1
        ? 'weekly'
        : 'none',
  });
  const extraErrors = useRef(false);

  useEffect(() => {
    watch((data, { name, type }) => {
      const value: SafeParseReturnType<epochFormSchema, epochSubmissionSchema> =
        getZodParser(source, currentEpoch?.id).safeParse(data);

      if (
        name === 'repeat_view' &&
        type === 'change' &&
        data.repeat_view === true &&
        data.start_date &&
        data.end_date
      ) {
        /*
        data.start_date = DateTime.fromISO(data.start_date)
          .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
          .toISO();
        data.end_date = DateTime.fromISO(data.end_date)
          .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
          .toISO();

        setValue('start_date', data.start_date);
        setValue('end_date', data.end_date);
        */
      }
      if (name === 'dayOfMonth' && type === 'change') {
        setValue(
          'repeatStartDate',
          getMonthStartDates(data.dayOfMonth || '1')[0].value
        );
      }
      if (!value.success) {
        extraErrors.current = true;
        setError('customError', {
          message: value.error.errors[0].message,
        });
      } else {
        extraErrors.current = false;
        clearErrors('customError');

        console.table(value.data);
        const { repeat_view, weekDay, repeat, repeatStartDate } = value.data;
        if (
          repeat_view &&
          (name === 'repeatStartDate' ||
            name === 'weekDay' ||
            name === 'dayOfMonth')
        ) {
          const now = DateTime.now();
          const weekday = Number.parseInt(weekDay);
          let nextStartDate = DateTime.now();
          let nextEndDate = DateTime.now();
          if (repeat === 'monthly') {
            nextStartDate = DateTime.fromISO(repeatStartDate);
            nextEndDate = nextStartDate.plus({ weeks: 2 });
          } else if (repeat === 'weekly') {
            nextStartDate =
              now.weekday > weekday
                ? now.plus({ weeks: 1 }).set({ weekday })
                : now.set({ weekday });
            nextEndDate = nextStartDate.plus({ weeks: 1 });
          }
          nextStartDate = nextStartDate.set({
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
          });
          nextEndDate = nextEndDate.set({
            hour: 0,
            minute: 0,
            second: 0,
            millisecond: 0,
          });
          console.info('derp', {
            start: nextStartDate.toISO(),
            end: nextEndDate.toISO(),
          });
          if (
            name === 'repeatStartDate' ||
            name === 'weekDay' ||
            name === 'dayOfMonth'
          ) {
            setValue('start_date', nextStartDate.toISO(), {
              shouldTouch: true,
            });
            setValue('end_date', nextEndDate.toISO(), { shouldTouch: true });
          }
        }
      }

      console.table({ data });
      if (data.end_date) watchFields.current.end_date = data.end_date;
      if (data.repeat) watchFields.current.repeat = data.repeat;
      if (data.start_date) watchFields.current.start_date = data.start_date;
    });
  });

  const onSubmit: SubmitHandler<epochFormSchema> = async data => {
    if (extraErrors.current) {
      return;
    }
    setSubmitting(true);
    (source?.epoch
      ? updateEpoch(source.epoch.id, {
          start_date: data.start_date,
          // round is needed to remove daylight savings offsets
          days: Math.round(
            DateTime.fromISO(data.end_date)
              .diff(DateTime.fromISO(data.start_date))
              .as('days')
          ),
          repeat:
            data.repeat === 'weekly' ? 1 : data.repeat === 'monthly' ? 2 : 0,
        })
      : createEpoch({
          start_date: data.start_date,
          // round is needed to remove daylight savings offsets
          days: Math.round(
            DateTime.fromISO(data.end_date)
              .diff(DateTime.fromISO(data.start_date))
              .as('days')
          ),
          repeat:
            data.repeat === 'weekly' ? 1 : data.repeat === 'monthly' ? 2 : 0,
        })
    )
      .then(() => {
        setSubmitting(false);
      })
      .then(onClose)
      .catch(console.warn);
  };

  const monthStartDates = getMonthStartDates(getValues('dayOfMonth'));

  return (
    <Form>
      <Panel css={{ mb: '$md', p: '$md' }}>
        <Flex
          css={{
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '$md',
          }}
        >
          <Text semibold css={{ color: '$secondaryText', fontSize: 'large' }}>
            {selectedEpoch ? 'Edit Epoch' : 'New Epoch'}
          </Text>

          <Flex css={{ gap: '$md', flexWrap: 'wrap' }}>
            <Button
              color="primary"
              outlined
              onClick={() => {
                selectedEpoch ? setEditEpoch(undefined) : setNewEpoch(false);
              }}
            >
              Cancel
            </Button>

            <Button
              color="primary"
              type="submit"
              disabled={submitting || !isDirty || !isEmpty(errors)}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </Flex>
        </Flex>
        <Panel nested css={{ mt: '$md' }}>
          <Flex column>
            <Text h3 semibold>
              Epoch Timing
            </Text>
            <Text p size="small" css={{ mt: '$md' }}>
              An Epoch is a period of time where circle members contribute value
              & allocate {'GIVE'} tokens to one another.{' '}
              <span>
                <Link
                  href="https://docs.coordinape.com/get-started/epochs/create-an-epoch"
                  rel="noreferrer"
                  target="_blank"
                >
                  Learn More
                </Link>
              </span>
            </Text>
          </Flex>
          <Box
            css={{
              display: 'grid',
              gridTemplateColumns: '3fr 1fr',
              mt: '$1xl',
              gap: '$2xl',
              '@sm': { gridTemplateColumns: '1fr' },
            }}
          >
            <Flex column>
              <Flex column css={{ mt: '$sm ', mb: '$md' }}>
                <FormRadioGroup
                  name="repeat_view"
                  control={control}
                  options={[
                    { label: 'Repeats', value: true },
                    { label: 'Does Not Repeat', value: false },
                  ]}
                  label="Type"
                  infoTooltip="Decide whether the epoch will repeat monthly or weekly or will not repeat after ending"
                />
              </Flex>
              <Flex
                css={{
                  flexWrap: 'wrap',
                  gap: '$md',
                  display: getValues('repeat_view') ? 'none' : 'flex',
                }}
              >
                <Flex
                  column
                  css={{
                    alignItems: 'flex-start',
                    maxWidth: '150px',
                    gap: '$xs',
                  }}
                >
                  <FormLabel type="label" css={{ fontWeight: '$bold' }}>
                    Start Date{' '}
                    <Tooltip content="The first day of the epoch in your local time zone">
                      <Info size="sm" />
                    </Tooltip>
                  </FormLabel>
                  <Controller
                    control={control}
                    name="start_date"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <FormDatePicker
                        onChange={onChange}
                        value={value}
                        onBlur={onBlur}
                        disabled={
                          selectedEpoch &&
                          currentEpoch?.id === selectedEpoch?.id
                        }
                        format="MMM dd, yyyy"
                        style={{
                          marginLeft: 0,
                        }}
                      />
                    )}
                  />
                </Flex>
                <Flex
                  column
                  css={{
                    alignItems: 'flex-start',
                    maxWidth: '150px',
                    gap: '$xs',
                  }}
                >
                  <FormLabel type="label" css={{ fontWeight: '$bold' }}>
                    End Date{' '}
                    <Tooltip content="The last day of the epoch in your local time zone">
                      <Info size="sm" />
                    </Tooltip>
                  </FormLabel>
                  <Controller
                    control={control}
                    name="end_date"
                    render={({ field: { onChange, value, onBlur } }) => (
                      <FormDatePicker
                        onChange={onChange}
                        value={value}
                        onBlur={onBlur}
                        disabled={
                          selectedEpoch &&
                          currentEpoch?.id === selectedEpoch?.id
                        }
                        format="MMM dd, yyyy"
                        style={{
                          marginLeft: 0,
                        }}
                      />
                    )}
                  />
                </Flex>
                <Flex column css={{ gap: '$xs' }}>
                  <FormLabel type="label" css={{ fontWeight: '$bold' }}>
                    Time{' '}
                    <Tooltip content="The time the epoch will start and end in your local time zone">
                      <Info size="sm" />
                    </Tooltip>
                  </FormLabel>
                  <Flex row css={{ gap: '$sm' }}>
                    <Controller
                      control={control}
                      name="start_date"
                      render={({ field: { onChange, value, onBlur } }) => (
                        <Box
                          css={{
                            maxWidth: '150px',
                            '> div': { mb: '0 !important' },
                          }}
                        >
                          <FormTimePicker
                            onBlur={onBlur}
                            onChange={onChange}
                            value={value}
                            disabled={
                              selectedEpoch &&
                              currentEpoch?.id === selectedEpoch?.id
                            }
                          />
                        </Box>
                      )}
                    />
                    <Text font="inter" size="medium">
                      In your
                      <br /> local timezone
                    </Text>
                  </Flex>
                </Flex>
              </Flex>
              <Flex
                column
                css={{
                  display: getValues('repeat_view') ? 'flex' : 'none',
                  flexWrap: 'wrap',
                  gap: '$md',
                }}
              >
                <Flex
                  css={{
                    gap: '$xs',
                  }}
                >
                  <Controller
                    control={control}
                    name="repeat"
                    defaultValue="monthly"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        css={{ minWidth: '280px', outline: '2px solid red' }}
                        options={repeat}
                        value={value}
                        onValueChange={onChange}
                        id="repeat_type"
                        label="Cycles"
                      />
                    )}
                  />
                </Flex>
                <Flex
                  css={{
                    gap: '$xs',
                    display: getValues('repeat') == 'monthly' ? 'flex' : 'none',
                  }}
                >
                  <Controller
                    control={control}
                    name="dayOfMonth"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        css={{ minWidth: '280px', outline: '2px solid red' }}
                        onValueChange={onChange}
                        value={value}
                        options={Array(28)
                          .fill(undefined)
                          .map((_, idx) => ({
                            label: (idx + 1).toString(),
                            value: (idx + 1).toString(),
                          }))}
                        id="day_of_month"
                        label="Day Of Month"
                      />
                    )}
                  />
                </Flex>
                <Flex
                  column
                  css={{
                    alignItems: 'flex-start',
                    maxWidth: '280px',
                    gap: '$xs',
                    display: getValues('repeat') == 'monthly' ? 'flex' : 'none',
                  }}
                >
                  <Controller
                    control={control}
                    name="repeatStartDate"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        css={{ minWidth: '280px', outline: '2px solid red' }}
                        defaultValue={monthStartDates[0].value}
                        onValueChange={onChange}
                        value={value}
                        options={monthStartDates}
                        id="repeatStartDate"
                        label="Start Date"
                      />
                    )}
                  />
                </Flex>
                <Flex
                  column
                  css={{
                    alignItems: 'flex-start',
                    maxWidth: '280px',
                    gap: '$xs',
                    display: getValues('repeat') == 'monthly' ? 'none' : 'flex',
                  }}
                >
                  <Controller
                    control={control}
                    name="weekDay"
                    render={({ field: { onChange, value } }) => (
                      <Select
                        css={{ minWidth: '280px', outline: '2px solid red' }}
                        defaultValue={monthStartDates[0].value}
                        onValueChange={onChange}
                        value={value}
                        options={[
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                          'Saturday',
                          'Sunday',
                        ].map((d, idx) => ({
                          label: d,
                          value: (idx + 1).toString(),
                        }))}
                        id="start_date"
                        label="start_date"
                      />
                    )}
                  />
                </Flex>
              </Flex>
              <Text p css={{ mt: '$xl' }}>
                {summarizeEpoch(watchFields.current)}
              </Text>
            </Flex>
            <Flex column>{epochsPreview(watchFields.current)}</Flex>
          </Box>
          {!isEmpty(errors) && (
            <Box
              css={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                mt: '$md',
                color: '$alert',
              }}
            >
              {Object.values(errors).map((error, i) => {
                return <div key={i}>{error.message}</div>;
              })}
            </Box>
          )}
        </Panel>
      </Panel>
    </Form>
  );
};

const epochsPreview = (
  value: Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
) => {
  const epochStart = DateTime.fromISO(value.start_date).setZone();
  const epochEnd = DateTime.fromISO(value.end_date).setZone();
  return (
    <Flex css={{ flexDirection: 'column', gap: '$xs' }}>
      <Text variant="label">Preview</Text>
      <Text bold css={{ mt: '$sm' }}>
        Epoch 1
      </Text>
      <Text>
        {epochStart.toFormat('ccc LLL d')} - {epochEnd.toFormat('ccc LLL d')}
      </Text>
      {(value.repeat === 'weekly' || value.repeat === 'monthly') && (
        <>
          <Text bold css={{ mt: '$sm' }}>
            Epoch 2
          </Text>
          <Text>
            {epochStart
              .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
              .toFormat('ccc LLL d')}{' '}
            -{' '}
            {epochEnd
              .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
              .toFormat('ccc LLL d')}
          </Text>
          <Text bold css={{ mt: '$sm' }}>
            Epoch 3
          </Text>
          <Text>
            {epochStart
              .plus(value.repeat === 'monthly' ? { months: 2 } : { weeks: 2 })
              .toFormat('ccc LLL d')}{' '}
            -{' '}
            {epochEnd
              .plus(value.repeat === 'monthly' ? { months: 2 } : { weeks: 2 })
              .toFormat('ccc LLL d')}
          </Text>
        </>
      )}
      <Text css={{ mt: '$sm' }}>
        {value.repeat === 'monthly'
          ? 'Repeats monthly'
          : value.repeat === 'weekly'
          ? 'Repeats weekly'
          : ''}
      </Text>
    </Flex>
  );
};

const summarizeEpoch = (
  value: Omit<epochFormSchema, 'repeat'> & { repeat: string | number }
) => {
  const startDate = DateTime.fromISO(value.start_date)
    .setZone()
    .toFormat(longFormat);
  const endDate = DateTime.fromISO(value.end_date)
    .setZone()
    .toFormat(longFormat);

  const nextRepeat = DateTime.fromISO(value.start_date)
    .setZone()
    .plus(value.repeat === 'monthly' ? { months: 1 } : { weeks: 1 })
    .toFormat('DD');

  const repeating =
    value.repeat === 'monthly'
      ? `The epoch is set to repeat every month; the following epoch will start on ${nextRepeat}.`
      : value.repeat === 'weekly'
      ? `The epoch is set to repeat every week; the following epoch will start on ${nextRepeat}.`
      : "The epoch doesn't repeat.";

  return `This epoch starts on ${startDate} and will end on ${endDate}. ${repeating}`;
};

const getMonthStartDates = (day: string) =>
  Array(5)
    .fill(undefined)
    .map((_, idx) => {
      let monthDiff = idx;
      const now = DateTime.now();
      const monthDay = Number.parseInt(day);
      if (DateTime.now().day >= monthDay) monthDiff += 1;
      const nextDT = now.set({
        day: monthDay,
        month: now.month + monthDiff,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
      return {
        label: nextDT.toLocaleString(),
        value: nextDT.toISO(),
      };
    });

export default EpochForm;
