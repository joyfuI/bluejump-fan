import { createFileRoute } from '@tanstack/react-router';
import type { InputRef, TableColumnType, TableProps } from 'antd';
import {
  Button,
  Checkbox,
  Flex,
  Input,
  Segmented,
  Table,
  Typography,
} from 'antd';
import type { FilterDropdownProps } from 'antd/es/table/interface';
import { Check, Search } from 'lucide-react';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import Highlighter from 'react-highlight-words';

import type { DataType } from '@/components/MusicbookTable';
import useCsvParse from '@/hooks/useCsvParse';

type OverlapRow = Pick<DataType, '분류' | '가수' | '제목'> & {
  key: string;
  musicbooks: string[];
  overlapCount: number;
};

const MUSICBOOKS: { id: string; label: string; path: string }[] = [
  { id: '9mogu9', label: '모구구', path: '/musicbook/9mogu9.csv' },
  { id: 'haroha', label: '하로하', path: '/musicbook/haroha.csv' },
  { id: 'marronie', label: '마로니', path: '/musicbook/marronie.csv' },
  { id: 'yangdoki', label: '양도끼', path: '/musicbook/yangdoki.csv' },
];

const MUSICBOOK_IDS = MUSICBOOKS.map(({ id }) => id);

const normalizeText = (value: string | undefined) =>
  (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

const getSongKey = (song: DataType) =>
  JSON.stringify([normalizeText(song.가수), normalizeText(song.제목)]);

const RouteComponent = () => {
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const searchInput = useRef<InputRef>(null);
  const [selectedMusicbooks, setSelectedMusicbooks] = useQueryState(
    'userId',
    parseAsArrayOf(parseAsString).withDefault(MUSICBOOK_IDS),
  );
  const [matchMode, setMatchMode] = useQueryState(
    'match',
    parseAsString.withDefault('two'),
  );

  const mogugu = useCsvParse<DataType>(MUSICBOOKS[0].path);
  const haroha = useCsvParse<DataType>(MUSICBOOKS[1].path);
  const marronie = useCsvParse<DataType>(MUSICBOOKS[2].path);
  const yangdoki = useCsvParse<DataType>(MUSICBOOKS[3].path);

  const musicbookData = useMemo(
    () => [
      { id: '9mogu9', data: mogugu.data },
      { id: 'haroha', data: haroha.data },
      { id: 'marronie', data: marronie.data },
      { id: 'yangdoki', data: yangdoki.data },
    ],
    [mogugu.data, haroha.data, marronie.data, yangdoki.data],
  );

  const groupedSongs = useMemo(() => {
    const groups = new Map<
      string,
      { song: DataType; musicbooks: Set<string> }
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
        matchMode === 'all'
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

  const genre = useMemo(
    () => [...new Set(matchedRows.map((i) => i.분류))],
    [matchedRows],
  );

  const handleReset = useCallback((clearFilters: () => void) => {
    clearFilters();
    setSearchText('');
  }, []);

  const handleSearch = useCallback(
    (
      selectedKeys: string[],
      confirm: FilterDropdownProps['confirm'],
      dataIndex: keyof OverlapRow,
    ) => {
      confirm();
      setSearchText(selectedKeys[0]);
      setSearchedColumn(dataIndex);
    },
    [],
  );

  const getColumnSearchProps = useCallback(
    (dataIndex: keyof OverlapRow): TableColumnType<OverlapRow> => {
      const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        e.stopPropagation();
      };

      return {
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          clearFilters,
        }) => {
          const handleChange = (
            e: ChangeEvent<HTMLInputElement, HTMLInputElement>,
          ) => {
            setSelectedKeys(e.target.value ? [e.target.value] : []);
          };

          const handlePressEnter = () => {
            handleSearch(selectedKeys as string[], confirm, dataIndex);
          };

          const handleResetClick = () => {
            if (clearFilters) {
              handleReset(clearFilters);
            }
          };

          const handleSearchClick = () => {
            handleSearch(selectedKeys as string[], confirm, dataIndex);
          };

          return (
            <div className="p-2" onKeyDown={handleKeyDown} role="dialog">
              <Input
                className="block mb-2"
                onChange={handleChange}
                onPressEnter={handlePressEnter}
                placeholder={`${dataIndex} 검색`}
                ref={searchInput}
                value={selectedKeys[0]}
              />
              <Flex justify="space-between">
                <Button onClick={handleResetClick} size="small" type="link">
                  초기화
                </Button>
                <Button onClick={handleSearchClick} size="small" type="primary">
                  검색
                </Button>
              </Flex>
            </div>
          );
        },
        filterIcon: (filtered: boolean) => (
          <Search color={filtered ? '#1677ff' : undefined} size={16} />
        ),
        onFilter: (value, record) =>
          record[dataIndex]
            .toString()
            .toLowerCase()
            .includes((value as string).toLowerCase()),
        filterDropdownProps: {
          onOpenChange(open) {
            if (open) {
              setTimeout(() => searchInput.current?.select(), 100);
            }
          },
        },
        render: (text) =>
          searchedColumn === dataIndex ? (
            <Highlighter
              autoEscape
              highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
              searchWords={[searchText]}
              textToHighlight={text ? text.toString() : ''}
            />
          ) : (
            text
          ),
      };
    },
    [searchText, searchedColumn, handleReset, handleSearch],
  );

  const columns = useMemo<TableProps<OverlapRow>['columns']>(
    () => [
      {
        title: '분류',
        dataIndex: '분류',
        width: 130,
        sorter: (a, b) => a.분류.localeCompare(b.분류),
        filters: genre.map((i) => ({ text: i, value: i })),
        onFilter: (value, record) => record.분류 === value,
      },
      {
        title: '가수',
        dataIndex: '가수',
        sorter: (a, b) => a.가수.localeCompare(b.가수),
        ...getColumnSearchProps('가수'),
      },
      {
        title: '제목',
        dataIndex: '제목',
        sorter: (a, b) => a.제목.localeCompare(b.제목),
        ...getColumnSearchProps('제목'),
      },
      {
        title: '선택한 노래책',
        children: MUSICBOOKS.filter(({ id }) =>
          selectedMusicbooks.includes(id),
        ).map(({ id, label }) => ({
          title: label,
          key: id,
          align: 'center',
          width: 90,
          render: (_value, record: OverlapRow) =>
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
    [genre, getColumnSearchProps, selectedMusicbooks],
  );

  const isLoading =
    mogugu.isLoading ||
    haroha.isLoading ||
    marronie.isLoading ||
    yangdoki.isLoading;

  const handleMusicbookChange = useCallback(
    (values: string[]) => {
      const selectedValues = new Set(values);
      setSelectedMusicbooks(
        MUSICBOOK_IDS.filter((id) => selectedValues.has(id)),
      );
    },
    [setSelectedMusicbooks],
  );

  const handleMatchModeChange = useCallback(
    (value: string) => {
      setMatchMode(value);
    },
    [setMatchMode],
  );

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
            { label: '2개 이상', value: 'two' },
            { label: '선택한 모두', value: 'all' },
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
