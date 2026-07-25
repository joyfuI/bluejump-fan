import type {
  InputRef,
  TableColumnType,
  TablePaginationConfig,
  TableProps,
} from 'antd';
import { Button, Flex, Input, Space, Table } from 'antd';
import type {
  FilterDropdownProps,
  FilterValue,
  SorterResult,
  TableCurrentDataSource,
} from 'antd/es/table/interface';
import { Dices, Search } from 'lucide-react';
import type { ParseMeta } from 'papaparse';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highlighter from 'react-highlight-words';

import MusicbookRandomModal from '@/components/MusicbookRandomModal';

export type DataType = {
  분류: string;
  가수: string;
  제목: string;
  단가: string;
  비고: string;
};
export type MusicbookTableProps = {
  data: DataType[];
  meta: ParseMeta;
  isLoading: boolean;
};

const MusicbookTable = ({ data, meta, isLoading }: MusicbookTableProps) => {
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [currentDataSource, setCurrentDataSource] = useState<DataType[]>([]);
  const [open, setOpen] = useState(false);
  const searchInput = useRef<InputRef>(null);

  const genre = useMemo(() => [...new Set(data?.map((i) => i.분류))], [data]);

  const handleReset = useCallback((clearFilters: () => void) => {
    clearFilters();
    setSearchText('');
  }, []);

  const handleSearch = useCallback(
    (
      selectedKeys: string[],
      confirm: FilterDropdownProps['confirm'],
      dataIndex: keyof DataType,
    ) => {
      confirm();
      setSearchText(selectedKeys[0]);
      setSearchedColumn(dataIndex);
    },
    [],
  );

  const getColumnSearchProps = useCallback(
    (dataIndex: keyof DataType): TableColumnType<DataType> => {
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

  const columns = useMemo<TableProps<DataType>['columns']>(
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
      { title: '단가', dataIndex: '단가', width: 130 },
      { title: '비고', dataIndex: '비고' },
    ],
    [genre, getColumnSearchProps],
  );

  useEffect(() => {
    if (!isLoading) {
      setCurrentDataSource(data);
    }
  }, [isLoading, data]);

  const rowKey = (record: DataType) => `${record.가수} - ${record.제목}`;

  const handleChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    _sorter: SorterResult<DataType> | SorterResult<DataType>[],
    extra: TableCurrentDataSource<DataType>,
  ) => {
    setCurrentDataSource(extra.currentDataSource);
  };

  const handleRandomClick = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Space className="my-4">
        <Button
          disabled={isLoading || currentDataSource.length === 0}
          icon={<Dices />}
          onClick={handleRandomClick}
          shape="round"
          size="large"
          type="primary"
        >
          랜덤 뽑기!
        </Button>
        <p>현재 목록 중에서 랜덤으로 선택됩니다.</p>
      </Space>
      <div className="relative">
        <p className="absolute right-0 bottom-full">
          업데이트: {meta?.fields?.at(-1)}
        </p>
        <Table<DataType>
          columns={columns}
          dataSource={data ?? []}
          loading={isLoading}
          onChange={handleChange}
          pagination={false}
          rowKey={rowKey}
          size="small"
          sticky
        />
      </div>

      <MusicbookRandomModal
        data={currentDataSource}
        onClose={handleClose}
        open={open}
      />
    </>
  );
};

export default MusicbookTable;
