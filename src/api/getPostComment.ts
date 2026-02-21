import fetchJson from '@/utils/fetchJson';

export type GetPostCommentResponse = {
  data: {
    pCommentNo: number; // 106993477
    isBestTop: boolean; // true
    titleNo: number; // 185132049
    userNick: string; // "빙밍_"
    userId: string; // "tleod1818"
    profileImage: string; // "https://profile.img.sooplive.co.kr/LOGO/tl/tleod1818/tleod1818.jpg"
    comment: string; // "1. 빙밍_\n2. oO김빙밍Oo\n3. 풀트 보유중\n4.우왁굳을 잡아라, 왁타 싸이클, 버육대, 왁체대, 릴동계 등\n5. 쇼트트랙 압도적 금메달 영상\nhttps://vod.sooplive.co.kr/player/152387529 \n\n쇼트트랙 압도적인 경기력으로 천양님 무관력을 깨버린 빙밍입니다!!!\n이번에도 꼭 증명 하고싶습니다!!!!!!!"
    cCommentCnt: number; // 0
    likeCnt: number; // 19301
    regDate: string; // "2026-01-28 19:19:38"
    regDateHumans: string; // "23 day ago"
    isLike: boolean; // false
    bjlike: boolean; // false
    isPinable: boolean; // false
    isPin: boolean; // false
    isHighlight: boolean; // false
    pinNick: string; // ""
    tagUserId: string; // ""
    tagUserNick: string; // ""
    tagIndex: number; // -1
    tagCheck: boolean; // false
    photo: {
      photoNo: number; // 24422789
      filename: string; // "COMMENT/9/26662229/78451769681137125.png"
      type: number; // 1
      size: number; // 1034911
      key: string; // "COMMENT/9/26662229/78451769681137125.png"
      domain: string; // "https://stimg.sooplive.co.kr"
      url: string; // "https://stimg.sooplive.co.kr/COMMENT/9/26662229/78451769681137125.png"
      link: string; // "https://stimg.sooplive.co.kr/COMMENT/9/26662229/78451769681137125.png"
      class: string; // ""
    };
    authority: {
      isCommentUpdatable: boolean; // false
      isCommentDeletable: boolean; // false
      isCommentReportable: boolean; // true
      isCommentPinFixable: boolean; // false
      isCommentPinCancelable: boolean; // false
    };
    badge: {
      userId: string; // ""
      bjId: string; // "lilpa0309"
      isManager: number; // 0
      isTopFan: number; // 0
      isFan: number; // 1
      isSubscribe: number; // 0
      isSupport: number; // 0
    };
  }[];
  links: {
    first: string; // "http://api-channel-origin.sooplive.co.kr/v1.1/channel/lilpa0309/post/185132049/comment?perPage=30"
    prev: string; // ""
    next: string; // "http://api-channel-origin.sooplive.co.kr/v1.1/channel/lilpa0309/post/185132049/comment?page=2&perPage=30"
    last: string; // "http://api-channel-origin.sooplive.co.kr/v1.1/channel/lilpa0309/post/185132049/comment?page=5&perPage=30"
  };
  meta: {
    total: number; // 142
    itemCount: number; // 30
    perPage: number; // 30
    lastPage: number; // 5
    currentPage: number; // 1
  };
  hiddenList: [];
  bestCount: number; // 3
  pinCount: number; // 0
  highlightCount: number; // 0
  pCommentNo: number; // 0
  cCommentNo: number; // 0
  pHighlightNo: number; // 0
  cHighlightNo: number; // 0
  commentCount: number; // 277
};
export type GetPostCommentParams = { page?: number };

// 10초
export const REVALIDATE = 10;

const getPostComment = (
  userId: string,
  postId: number,
  params?: GetPostCommentParams,
) =>
  fetchJson<GetPostCommentResponse>(
    `http://api-channel-origin.sooplive.co.kr/v1.1/channel/${userId}/post/${postId}/comment?page=${params?.page ?? 1}&perPage=30`,
  );

export default getPostComment;
