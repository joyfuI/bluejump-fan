import fetchJson from '@/utils/fetchJson';

export type GetVodsReviewResponse = {
  data: {
    title_no: number; // 181772635
    station_no: number; // 26547847
    bbs_no: number; // 98353959
    board_type: number; // 105
    auth_no: number; // 101
    title_name: string; // "이번 크리스마스는 나랑 보내는 거 어때"
    user_nick: string; // "모구구"
    user_id: string; // "9mogu9"
    profile_image: string; // "//profile.img.sooplive.co.kr/LOGO/9m/9mogu9/9mogu9.jpg"
    photo_cnt: number; // 0
    platform_type: number; // 0
    notice_yn: number; // 0
    comment_yn: number; // 1
    reply_yn: number; // 1
    livepost_yn: number; // 0
    share_yn: number; // 1
    search_yn: number; // 1
    ip: string; // ""
    reg_date: string; // "2025-12-25 21:10:17"
    ucc: {
      thumb: string; // "//videoimg.sooplive.co.kr/php/SnapshotLoad.php?rowKey=20251225_E42B9D29_290230988_2_r"
      thumb_type: string; // "SUCCEED"
      flag: string; // "SUCCEED"
      ucc_type: string; // "21"
      category: number; // 210000
      vod_category: number; // 820000
      grade: number; // 0
      category_tags: string[];
      hash_tags: string[];
      auto_hashtags: [];
      total_file_duration: number; // 19526234
      file_type: string; // "REVIEW"
      auto_delete_remain_hours: null;
      story_idx: number; // 563997
      paid_ppv: boolean; // false
      catchInfo: null;
    };
    display: {
      bbs_name: string; // '다시보기'
    };
    count: {
      like_cnt: number; // 4
      read_cnt: number; // 4326
      comment_cnt: number; // 0
      vod_read_cnt: number; // 61
      ucc_favorite_cnt: number; // 0
    };
    copyright: null;
    badge: null;
    pin: null;
    authority: {
      is_board_shareable: boolean; // true
      is_reason_deletable: boolean; // false
      is_blind_deletable: boolean; // false
      is_clip_reason_deletable: boolean; // false
      is_catch_reason_deletable: boolean; // false
      is_ucc_deletable: boolean; // false
      is_ucc_updatable: boolean; // false
      is_vod_pinable: boolean; // false
      is_vod_pin_fixable: boolean; // false
      is_vod_pin_cancelable: boolean; // false
      is_ucc_editable: boolean; // false
      is_ucc_mid_roll_settable: boolean; // false
      is_ucc_playlist_addable: boolean; // true
      is_ucc_chapter_settable: boolean; // false
      is_vod_movable_to_board: boolean; // false
    };
  }[];
  links: {
    first: string | null; // "https://chapi.sooplive.co.kr/api/9mogu9/vods/review?page=1"
    last: string | null; // "https://chapi.sooplive.co.kr/api/9mogu9/vods/review?page=10"
    prev: string | null;
    next: string | null; // "https://chapi.sooplive.co.kr/api/9mogu9/vods/review?page=2"
  };
  meta: {
    current_page: number; // 1
    from: number; // 1
    last_page: number; // 10
    path: string; // "https://chapi.sooplive.co.kr/api/9mogu9/vods/review"
    per_page: number; // 60
    to: number; // 60
    total: number; // 569
  };
  auto_del_vods: [];
};

export type GetVodsReviewParams = { page?: number };

// 5분
export const REVALIDATE = 300;

const getVodsReview = (userId: string, params?: GetVodsReviewParams) =>
  fetchJson<GetVodsReviewResponse>(
    `https://chapi.sooplive.co.kr/api/${userId}/vods/review?orderby=reg_date&page=${params?.page ?? 1}&field=title,contents,user_nick,user_id&per_page=60`,
  );

export default getVodsReview;
