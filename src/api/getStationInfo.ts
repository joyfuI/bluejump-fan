import fetchJson from '@/utils/fetchJson';

export type GetStationInfoResponse = {
  station: {
    stationNo: number; // 26547847
    userId: string; // "9mogu9"
    userNick: string; // "모구구"
    stationName: string; // "Mogugu"
    stationTitle: string; // ""
    broadStart: string; // "2025-12-19 19:00:16": 마지막 방송 시작시간
    firstBroadDate: string; // "2025-12-20 01:15:09"
    totalBroadTime: number; // 12543716
    grade: number; // 0
    joinTime: string; // "2023-12-30 17:39:34"
    country: string; // "KR"
    currentTimestamp: string; // "2025-12-20 01:15:09"
    activeNo: number; // 0
    profileImage: string; // "https://profile.img.sooplive.co.kr/LOGO/9m/9mogu9/9mogu9.jpg"
    subscribeVisible: string; // "on"
  };
  display: {
    stationNo: number; // 26547847
    userId: string; // "9mogu9"
    mainType: string; // "1110"
    titleType: string; // "IMAGE"
    titleText: string; // ""
    profileText: string; // "항상 찾아와줘서 고마워!"
    skinType: number; // 0
    titleSkinImage: string; // ""
    aiProfileConfYn: string; // "N"
    aiProfileStr: null;
  };
  channelArt: {
    pcFilename: string; // "SKIN/26547847/367068e67de32ea8d.jpg"
    mobileFilename: string; // ""
    color: string; // "#71b3d9"
    regDate: string; // "2025-10-08T15:06:13.000Z"
  };
  badges: {
    idx: number; // 16488
    groupNo: number; // 2
    priority: number; // 999
    groupName: string; // "파트너" | "베스트" | "루키존"
    groupClassName: string; // "badge_partner" | "badge_best" | "badge_newbj"
    groupBackgroundColor: string; // "#00ca55"
  }[];
  medals: {
    userId: string; // "9mogu9"
    medalName: string; // "BEST_STREAMER"
    medalContent: string; // "베스트 스트리머"
    medalImageKey: string; // "best"
    medalDescription: string; // "다양한 콘텐츠와 자신만의 개성으로 뚜렷한 방송활동을 보여준 스트리머입니다."
  }[];
  upd: {
    fanCnt: number; // 21403
  };
  subscription: {
    totalCnt: number; // 164
  };
  userAuth: {
    isFavorite: boolean; // true
    isMobilePush: boolean; // true
    isSubscribe: boolean; // false
    isOwner: boolean; // false
    isManager: boolean; // false
    isNotice: boolean; // false
    isAdsence: boolean; // false
  };
  link: {
    userId: string; // ""
    type: number; // 3
    url: string; // "https://www.youtube.com/channel/UCApvBjzSzJzoO7G7EdxLYqQ"
    image: string; // ""
    linkName: string; // "유튜브"
  }[];
};

// 1분
export const REVALIDATE = 60;

const getStationInfo = (userId: string) =>
  fetchJson<GetStationInfoResponse>(
    `https://api-channel.sooplive.co.kr/v1.1/channel/${userId}/station`,
  );

export default getStationInfo;
