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
      menus: [{ id: 37, name: '맴버들의 이모저모' }],
    },
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
  },
  {
    id: 'denebeu',
    nick: '데네브',
    stationNo: 29418184,
    cafe: {
      url: 'https://cafe.naver.com/denebeu',
      id: 31644578,
      name: '데네브의 아틀리에',
      menus: [
        { id: 27, name: '네브의 일기장' },
        { id: 28, name: '네브의 대화방' },
      ],
    },
  },
];
