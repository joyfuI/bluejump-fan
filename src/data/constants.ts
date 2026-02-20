type Member = {
  readonly id: string;
  readonly nick: string;
  readonly stationNo: number;
  readonly cafeId?: number;
  readonly cafeMenuIds?: number[];
};

export const MEMBERS: readonly Member[] = [
  {
    id: 'wjdfogur98',
    nick: '대월향',
    stationNo: 11696793,
    cafeId: 31345283,
    cafeMenuIds: [37],
  },
  {
    id: 'dlsn9911',
    nick: '제갈금자',
    stationNo: 21670907,
    cafeId: 31181423,
    cafeMenuIds: [19, 85],
  },
  {
    id: '9mogu9',
    nick: '모구구',
    stationNo: 26547847,
    cafeId: 31113449,
    cafeMenuIds: [27, 30],
  },
  {
    id: 'haroha',
    nick: '하로하',
    stationNo: 28354254,
    cafeId: 31299984,
    cafeMenuIds: [12, 57, 31],
  },
  {
    id: 'kgoyangyeeee',
    nick: '누눙지',
    stationNo: 22575554,
    cafeId: 31369087,
    cafeMenuIds: [5, 25, 24],
  },
  {
    id: 'denebeu',
    nick: '데네브',
    stationNo: 29418184,
    cafeId: 31644578,
    cafeMenuIds: [27, 28],
  },
];
