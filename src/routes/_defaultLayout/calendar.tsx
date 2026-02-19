import { createFileRoute } from '@tanstack/react-router';
import type { CalendarProps } from 'antd';
import { Badge, Calendar } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { createStandardSchemaV1, parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import type { GetCalendarResponse } from '@/api/getCalendar';
import type { MEMBERS } from '@/data/constants';
import useCalendarQuery from '@/hooks/query/useCalendarQuery';

const badgeColor = {
  방송시작: '#7f7fff',
  합방: '#43cec9',
  휴방: '#ff7096',
  기타: '#acb0b9',
} as const;

const searchParams = {
  date: parseAsString.withDefault(dayjs().format('YYYY-MM-DD')),
};

const RouteComponent = () => {
  const [date, setDate] = useQueryState('date', searchParams.date);
  const day = dayjs(date, 'YYYY-MM-DD');

  const { data } = useCalendarQuery({
    year: day.year(),
    month: day.month() + 1,
  });

  const listData = useMemo(() => {
    const map = Map.groupBy<
      string,
      GetCalendarResponse['days'][0]['events'][0] & (typeof MEMBERS)[0]
    >(data, (item) => item.eventDate);
    map.forEach((value, key, map) => {
      const newValue = value.toSorted((a, b) =>
        a.eventTime.localeCompare(b.eventTime),
      );
      map.set(key, newValue);
    });
    return map;
  }, [data]);

  const dateCellRender = (value: Dayjs) => (
    <ul className="p-0 list-none">
      {listData.get(value.format('YYYY-MM-DD'))?.map((item) => (
        <li key={item.idx}>
          <Badge
            color={badgeColor[item.calendarTypeName]}
            text={`${item.eventTime} | ${item.nick} | ${item.title}`}
          />
        </li>
      ))}
    </ul>
  );

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type === 'date') {
      return dateCellRender(current);
    }
    return info.originNode;
  };

  const handleChange = (day: Dayjs) => {
    setDate(dayjs(day).format('YYYY-MM-DD'));
  };

  return (
    <Calendar
      cellRender={cellRender}
      className="-mb-24"
      onChange={handleChange}
      value={day}
    />
  );
};

export const Route = createFileRoute('/_defaultLayout/calendar')({
  staticData: { selectedKey: 'calendar' },
  component: RouteComponent,
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
});
