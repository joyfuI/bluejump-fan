import { createFileRoute } from '@tanstack/react-router';
import type { TableProps } from 'antd';
import { Checkbox, Flex, Segmented, Table, Typography } from 'antd';
import { Check } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type { DataType } from '@/components/MusicbookTable';
import useCsvParse from '@/hooks/useCsvParse';

type MusicbookId = '9mogu9' | 'haroha' | 'marronie' | 'yangdoki';
type MatchMode = 'at-least-two' | 'all-selected';
type Musicbook = { id: MusicbookId; label: string; path: string };
type OverlapRow = Pick<DataType, '분류' | '가수' | '제목'> & {
  key: string;
  musicbooks: MusicbookId[];
  overlapCount: number;
};

const MUSICBOOKS: Musicbook[] = [
  { id: '9mogu9', label: '모구구', path: '/musicbook/9mogu9.csv' },
  { id: 'haroha', label: '하로하', path: '/musicbook/haroha.csv' },
  { id: 'marronie', label: '마로니', path: '/musicbook/marronie.csv' },
  { id: 'yangdoki', label: '양도끼', path: '/musicbook/yangdoki.csv' },
];

const ALL_MUSICBOOK_IDS = MUSICBOOKS.map(({ id }) => id);

const normalizeText = (value: string | undefined) =>
  (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

const getSongKey = (song: DataType) =>
  JSON.stringify([normalizeText(song.가수), normalizeText(song.제목)]);

const RouteComponent = () => {
  const mogu = useCsvParse<DataType>(MUSICBOOKS[0].path);
  const haroha = useCsvParse<DataType>(MUSICBOOKS[1].path);
  const marronie = useCsvParse<DataType>(MUSICBOOKS[2].path);
  const yangdoki = useCsvParse<DataType>(MUSICBOOKS[3].path);

  const [selectedMusicbooks, setSelectedMusicbooks] =
    useState<MusicbookId[]>(ALL_MUSICBOOK_IDS);
  const [matchMode, setMatchMode] = useState<MatchMode>('at-least-two');

  const musicbookData = useMemo(
    () => [
      { id: '9mogu9' as const, data: mogu.data },
      { id: 'haroha' as const, data: haroha.data },
      { id: 'marronie' as const, data: marronie.data },
      { id: 'yangdoki' as const, data: yangdoki.data },
    ],
    [mogu.data, haroha.data, marronie.data, yangdoki.data],
  );

  const groupedSongs = useMemo(() => {
    const groups = new Map<
      string,
      { song: DataType; musicbooks: Set<MusicbookId> }
    >();

    for (const { id, data } of musicbookData) {
      for (const song of data) {
        if (!normalizeText(song.제목)) {
          continue;
        }

        const key = getSongKey(song);
        const group = groups.get(key);

        if (group) {
          group.musicbooks.add(id);
        } else {
          groups.set(key, { song, musicbooks: new Set([id]) });
        }
      }
    }

    return [...groups.entries()].map(([key, { song, musicbooks }]) => ({
      key,
      분류: song.분류,
      가수: song.가수,
      제목: song.제목,
      musicbooks: [...musicbooks],
    }));
  }, [musicbookData]);

  const matchedRows = useMemo(() => {
    if (selectedMusicbooks.length < 2) {
      return [];
    }

    return groupedSongs
      .map((song) => ({
        ...song,
        overlapCount: selectedMusicbooks.filter((id) =>
          song.musicbooks.includes(id),
        ).length,
      }))
      .filter((song) =>
        matchMode === 'all-selected'
          ? song.overlapCount === selectedMusicbooks.length
          : song.overlapCount >= 2,
      )
      .sort(
        (a, b) =>
          b.overlapCount - a.overlapCount ||
          a.가수.localeCompare(b.가수, 'ko') ||
          a.제목.localeCompare(b.제목, 'ko'),
      );
  }, [groupedSongs, matchMode, selectedMusicbooks]);

  const columns = useMemo<TableProps<OverlapRow>['columns']>(
    () => [
      {
        title: '분류',
        dataIndex: '분류',
        width: 130,
        sorter: (a, b) => a.분류.localeCompare(b.분류, 'ko'),
      },
      {
        title: '가수',
        dataIndex: '가수',
        sorter: (a, b) => a.가수.localeCompare(b.가수, 'ko'),
      },
      {
        title: '제목',
        dataIndex: '제목',
        sorter: (a, b) => a.제목.localeCompare(b.제목, 'ko'),
      },
      {
        title: '선택한 노래책',
        children: MUSICBOOKS.filter(({ id }) =>
          selectedMusicbooks.includes(id),
        ).map(({ id, label }) => ({
          title: label,
          key: id,
          align: 'center' as const,
          width: 90,
          render: (_value: unknown, record: OverlapRow) =>
            record.musicbooks.includes(id) ? (
              <Check
                aria-label={`${label} 노래책에 포함`}
                className="inline text-blue-500"
                size={17}
              />
            ) : (
              <Typography.Text
                aria-label={`${label} 노래책에 없음`}
                type="secondary"
              >
                —
              </Typography.Text>
            ),
        })),
      },
      {
        title: '겹침',
        dataIndex: 'overlapCount',
        align: 'center',
        width: 80,
        sorter: (a, b) => a.overlapCount - b.overlapCount,
        render: (count: number) => `${count}곳`,
      },
    ],
    [selectedMusicbooks],
  );

  const isLoading =
    mogu.isLoading ||
    haroha.isLoading ||
    marronie.isLoading ||
    yangdoki.isLoading;

  const handleMusicbookChange = useCallback(
    (values: Array<string | number>) => {
      const selectedValues = new Set(values as MusicbookId[]);
      setSelectedMusicbooks(
        ALL_MUSICBOOK_IDS.filter((id) => selectedValues.has(id)),
      );
    },
    [],
  );

  const handleMatchModeChange = useCallback((value: string | number) => {
    setMatchMode(value as MatchMode);
  }, []);

  const emptyText =
    selectedMusicbooks.length < 2
      ? '비교할 노래책을 2개 이상 선택해 주세요.'
      : '조건에 맞는 겹치는 노래가 없습니다.';

  return (
    <>
      <p>가수와 제목이 같은 곡을 기준으로 노래책 간 겹치는 곡을 찾습니다.</p>

      <Flex align="center" className="my-4" gap="middle" wrap>
        <Checkbox.Group
          onChange={handleMusicbookChange}
          options={MUSICBOOKS.map(({ id, label }) => ({ label, value: id }))}
          value={selectedMusicbooks}
        />
        <Segmented
          onChange={handleMatchModeChange}
          options={[
            { label: '2개 이상', value: 'at-least-two' },
            { label: '선택한 모두', value: 'all-selected' },
          ]}
          value={matchMode}
        />
      </Flex>

      <Table<OverlapRow>
        columns={columns}
        dataSource={matchedRows}
        loading={isLoading}
        locale={{ emptyText }}
        pagination={false}
        rowKey="key"
        scroll={{ x: 900 }}
        size="small"
        sticky
      />
    </>
  );
};

export const Route = createFileRoute('/_defaultLayout/musicbook/overlap')({
  staticData: { musicbook: 'overlap' },
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
