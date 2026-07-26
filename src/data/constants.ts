type Member = {
  readonly id: string;
  readonly nick: string;
  readonly stationNo: number;
  readonly cafe?: {
    readonly url: string;
    readonly id: number;
    readonly name: string;
    readonly menus?: { readonly id: number; readonly name: string }[];
  };
  readonly color?: string;
};

export const MEMBERS: readonly Member[] = [
  {
    id: 'wjdfogur98',
    nick: '대월향',
    stationNo: 11696793,
    cafe: {
      url: 'https://cafe.naver.com/bluejumpofficial',
      id: 31345283,
      name: '대월향의 1평 사장실',
      menus: [{ id: 37, name: '대월향의 이모저모' }],
    },
    color: '#dcf8ff',
  },
  {
    id: 'dlsn9911',
    nick: '제갈금자',
    stationNo: 21670907,
    cafe: {
      url: 'https://cafe.naver.com/geumpeltown',
      id: 31181423,
      name: '금펠다운',
      menus: [
        { id: 19, name: '금언' },
        { id: 85, name: '팬심후기' },
      ],
    },
    color: '#f7cbcb',
  },
  {
    id: '9mogu9',
    nick: '모구구',
    stationNo: 26547847,
    cafe: {
      url: 'https://cafe.naver.com/mogugu',
      id: 31113449,
      name: '귀여우면 모구구라도 좋아해 주실 수 있나요',
      menus: [
        { id: 27, name: '모뀨 잡담' },
        { id: 30, name: '팬심 후기' },
      ],
    },
    color: '#fce5cd',
  },
  {
    id: 'haroha',
    nick: '하로하',
    stationNo: 28354254,
    cafe: {
      url: 'https://cafe.naver.com/haroha00',
      id: 31299984,
      name: '하로하의 저승탐구소',
      menus: [
        { id: 12, name: '꿍얼꿍얼' },
        { id: 57, name: '선물후기' },
        { id: 31, name: '창고대방출' },
      ],
    },
    color: '#fff2cc',
  },
  {
    id: 'kgoyangyeeee',
    nick: '누눙지',
    stationNo: 22575554,
    cafe: {
      url: 'https://cafe.naver.com/nunungzi',
      id: 31369087,
      name: '누눙지의 종토방',
      menus: [
        { id: 5, name: '일기장' },
        { id: 25, name: '누렁이 선물' },
        { id: 24, name: '카톡' },
      ],
    },
    color: '#d7f0cd',
  },
  {
    id: 'marronie',
    nick: '마로니',
    stationNo: 30400072,
    cafe: {
      url: 'https://cafe.naver.com/marroniepark',
      id: 31556246,
      name: '마로니 공원',
      menus: [{ id: 17, name: '마로니 일상' }],
    },
    color: '#d1f0cc',
  },
  {
    id: 'yangdoki',
    nick: '양도끼',
    stationNo: 26435439,
    cafe: {
      url: 'https://cafe.naver.com/yangdoki',
      id: 30947879,
      name: 'AXE함',
      menus: [
        { id: 22, name: '알림' },
        { id: 2, name: '뻘글' },
        { id: 27, name: '낙서방' },
        { id: 73, name: '비밀방' },
      ],
    },
    color: '#c8f4d3',
  },
];

export const CLIPPERS: readonly string[] = [
  'UCbr8po8y2zkvya5qcGQL4jA', // 블점코인
  'UCuJTjPFNeixarR9mMPpabeQ', // 모구구의 68번째 낫
  'UCG0jWW7q0P1r5pm1UWyfOZA', // 작대기
  'UCjyayvu8VlUg3-fvvdG5lAQ', // 과자나라 주민
  'UCw186e1y2vw_JWlX8K50bcQ', // 버공소
  'UC87cvDeTygkdQZmeOaaefCA', // 츄블링
  'UCkkFUaMD94pzaE9ajLQ3w-A', // 헤일로 Haleo
  'UCafk8p2dKUNRgH9Xd9trR2A', // 위로
];
