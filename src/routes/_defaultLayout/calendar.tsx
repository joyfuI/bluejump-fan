import { ClientOnly, createFileRoute } from '@tanstack/react-router';
import type { CalendarMode, CalendarProps } from 'antd';
import { Badge, Calendar, Modal } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { createStandardSchemaV1, parseAsString, useQueryState } from 'nuqs';
import { useMemo, useState } from 'react';

import type { GetCalendarResponse } from '@/api/getCalendar';
import type { MEMBERS } from '@/data/constants';
import useCalendarQuery from '@/hooks/query/useCalendarQuery';

const badgeColor = {
  방송시작: '#7f7fff',
  합방: '#43cec9',
  휴방: '#ff7096',
  기타: '#acb0b9',
} as const;

const searchParams = { date: parseAsString };

const RouteComponent = () => {
  const [mode, setMode] = useState<CalendarMode>('month');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useQueryState(
    'date',
    searchParams.date.withDefault(dayjs().format('YYYY-MM-DD')),
  );
  const day = dayjs(date, 'YYYY-MM-DD');

  const { data } = useCalendarQuery({
    year: day.year(),
    month: day.month() + 1,
  });

  const listData = useMemo(() => {
    const map = Map.groupBy<
      string,
      GetCalendarResponse['days'][number]['events'][number] &
        (typeof MEMBERS)[number]
    >(data, (item) => item.eventDate);
    map.forEach((value, key, map) => {
      const newValue = value.toSorted((a, b) =>
        a.eventTime.localeCompare(b.eventTime),
      );
      map.set(key, newValue);
    });
    return map;
  }, [data]);

  const dateCellRender = (
    value: Dayjs,
    options?: { disabled?: boolean; small?: boolean },
  ) => (
    <ul className={`p-0 list-none ${options?.disabled ? 'opacity-50' : ''}`}>
      {listData.get(value.format('YYYY-MM-DD'))?.map((item) => (
        <li key={item.idx}>
          <Badge
            color={badgeColor[item.calendarTypeName]}
            text={
              <span
                className={`${options?.small ? 'text-xs' : 'text-base'} rounded`}
                style={{
                  backgroundColor: `color-mix(in srgb, ${item.color}, white 20%)`,
                }}
              >{`${item.eventTime} | ${item.nick} | ${item.title}`}</span>
            }
          />
        </li>
      ))}
    </ul>
  );

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type === 'date') {
      return dateCellRender(current, {
        disabled: current.month() !== day.month(),
        small: true,
      });
    }
    return info.originNode;
  };

  const handleChange = (d: Dayjs) => {
    setDate(dayjs(d).format('YYYY-MM-DD'));
  };

  const handlePanelChange = (_d: Dayjs, m: CalendarMode) => {
    setMode(m);
  };

  const handleSelect: CalendarProps<Dayjs>['onSelect'] = (d, i) => {
    if (i.source === 'month') {
      setMode('month');
    } else if (
      i.source === 'date' &&
      d.month() === day.month() &&
      listData.has(d.format('YYYY-MM-DD')) // 일정이 있는 경우만
    ) {
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <ClientOnly>
      <Calendar
        cellRender={cellRender}
        className="-mb-24"
        mode={mode}
        onChange={handleChange}
        onPanelChange={handlePanelChange}
        onSelect={handleSelect}
        value={day}
      />

      <Modal
        centered
        footer={null}
        onCancel={handleClose}
        open={open}
        title={day.format('YYYY-MM-DD')}
      >
        {dateCellRender(day)}
      </Modal>
    </ClientOnly>
  );
};

export const Route = createFileRoute('/_defaultLayout/calendar')({
  staticData: { selectedKey: 'calendar' },
  component: RouteComponent,
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
