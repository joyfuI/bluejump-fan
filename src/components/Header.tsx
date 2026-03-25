import { Link, useMatches } from '@tanstack/react-router';
import { Layout, Menu, Typography } from 'antd';
import { ExternalLink, Wrench } from 'lucide-react';

import { MEMBERS } from '@/data/constants.ts';

const items = [
  { key: 'live', label: <Link to="/live">라이브 모아보기</Link> },
  { key: 'calendar', label: <Link to="/calendar">캘린더 모아보기</Link> },
  { key: 'soop', label: <Link to="/soop">방송국글 모아보기</Link> },
  { key: 'cafe', label: <Link to="/cafe">카페글 모아보기</Link> },
  { key: 'review', label: <Link to="/review">다시보기 모아보기</Link> },
  { key: 'clipper', label: <Link to="/clipper">키리누키 목록</Link> },
  {
    key: 'fancafe',
    label: '팬카페',
    children: MEMBERS.values()
      .filter((member) => member.cafe)
      .map((member) => ({
        key: `fancafe-${member.id}`,
        label: (
          <a
            className="inline-flex items-center"
            href={member.cafe?.url}
            rel="noreferrer"
            target="_blank"
          >
            {member.cafe?.name}
            <ExternalLink className="ml-1" size={16} />
          </a>
        ),
      }))
      .toArray(),
  },
  {
    key: 'tools',
    icon: <Wrench size={16} />,
    label: '방송 도구',
    children: [
      {
        key: 'tools-soop',
        label: '숲 관련',
        type: 'group',
        children: [
          {
            key: 'tools-soop-up',
            label: (
              <Link
                className="inline-flex items-center"
                target="_blank"
                to="/tools/soopup"
              >
                댓글 실시간 업 랭킹
                <ExternalLink className="ml-1" size={16} />
              </Link>
            ),
          },
          {
            key: 'tools-soop-comment',
            label: (
              <Link
                className="inline-flex items-center"
                target="_blank"
                to="/tools/soopcomment"
              >
                댓글 링크 생성기
                <ExternalLink className="ml-1" size={16} />
              </Link>
            ),
          },
        ],
      },
    ],
  },
];

const Header = () => {
  const matches = useMatches();
  const selectedKeys = matches
    .values()
    .filter((m) => m.staticData?.selectedKey)
    .map((m) => m.staticData.selectedKey)
    .toArray() as string[];

  return (
    <Layout.Header className="flex items-center gap-12">
      <Link to="/">
        <Typography.Title className="m-0 text-white" level={4}>
          블루점프 팬사이트
        </Typography.Title>
      </Link>
      <Menu
        className="flex-1 min-w-0"
        items={items}
        mode="horizontal"
        selectedKeys={selectedKeys}
        theme="dark"
      />
    </Layout.Header>
  );
};

export default Header;
