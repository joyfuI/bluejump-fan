import fetchJson from '@/utils/fetchJson';

export type GetVodSearchResponse = {
  RESULT: number; // 1
  TOTAL_CNT: number; // 6254
  HAS_MORE_LIST: boolean; // true
  FILETYPE_CNT: null;
  processTm: number; // 0
  t: 'json';
  charset: 'UTF-8';
  DATA: {
    title_no: string; // "204334639"
    view_cnt: string; // "7"
    auth: string; // "OPEN_ALL"
    vod_category_name: string; // "버추얼"
    ai_title_no: null;
    station_no: string; // "12595054"
    file_resolution: string; // "1920x1080"
    language_code: string; // "ko_KR"
    file_type: 'REVIEW' | 'NORMAL' | 'CLIP' | 'CATCH' | 'PLAYLIST'; // "CLIP"
    bbs_no: string; // "68075176"
    memo_cnt: string; // "0"
    mobile_thumbnail_path: string; // "http://iflv14.sooplive.com/clip/20260815/961/eb7950b0-d036-4403-a7c3-593c1a71c6ca/42391961_l.jpg"
    station_name: string; // "afreecaTV"
    recomm_cnt: string; // "0"
    hotclip_yn: string; // "0"
    vod_view_cnt: string; // "7"
    encoding_type: string; // "2"
    auto_hashtags: [];
    reg_date: string; // "2026-08-15 01:31:41"
    user_id: string; // "kiscezyr"
    grade: string; // "0"
    broad_no: string; // "296354967"
    status: string; // "1"
    original_bj: string; // "9mogu9"
    title: string; // "[클립]벌칙 공겜.. w. 하디아"
    content: string; // "  "
    duration: string; // "1:40"
    vod_category: string; // "00820000"
    thumbnail_path: string; // "http://iflv14.sooplive.com/clip/20260815/961/eb7950b0-d036-4403-a7c3-593c1a71c6ca/42391961_r.jpg"
    category_id: string; // ""
    org_title_no: string; // ""
    hash_tags: string[]; // ["블루점프", "버츄얼", "여캠", "머리퍼리"]
    original_user_nick: string; // "모구구"
    aftv_score: string; // "0"
    b_title: string; // "[클립]벌칙 공겜.. w. 하디아"
    ai_thumb_path: string; // ""
    user_nick: string; // "아사히생맥주"
    vod_duration: string; // "100016"
    rookie: boolean; // false
    url: string; // "https://vod.afreecatv.com/player/204334639"
    video_type: string; // "ucc"
    ucc_type: string; // "21"
    ppv: boolean; // false
    original_type?: 'USER' | 'CLIP' | 'CATCH'; // "CLIP"
    category: string; // "00210000"
    ppv_yn: string; // "N"
    webp_path: string; // "https://videoimg.sooplive.com/php/SnapshotLoad.php?rowKey=clip_20260815_961_eb7950b0-d036-4403-a7c3-593c1a71c6ca_42391961_w&column=1"
    fan_flag: 0 | 1; // 0
    subs_flag: 0 | 1; // 0
    type: 'REVIEW' | 'NORMAL' | 'CLIP' | 'CATCH' | 'PLAYLIST'; // "CLIP"
    timestamp: number; // 1786725101
    vertical_thumbnail_path: null;
    vertical_webp_path: string; // ""
    broad_date: string; // ""
    original_reg_user_id: string; // ""
    geoblock_flag: 0 | 1; // 0
    category_tags: string[]; // ["버추얼"]
    strm_lang_type: string; // "ko_KR"
    lang_tags: string[]; // ["한국어"]
    is_subtitle: boolean; // false
    title_history: [];
    favorite_flag: 0 | 1; // 0
    use_vertical_thumbnail: boolean; // false
  }[];
  RELATED_DATA: { VOD: []; BJ: [] };
  LATEST_DATA: [];
  RECOMMEND_DATA: [];
  CATCH_DATA: [];
  CATCH_STORY_DATA: [];
  WORD: string; // "블루점프"
  origin_word: string; // "블루점프"
};
export type GetVodSearchParams = {
  keyword: string;
  page?: number;
  limit?: number;
  term?: 'all' | '1day' | '1week' | '1month' | '1year';
};

// 1분
export const REVALIDATE = 60;

const getVodSearch = (params?: GetVodSearchParams) =>
  fetchJson<GetVodSearchResponse>(
    `/api/vod-search?keyword=${encodeURIComponent(params?.keyword ?? '')}&page=${params?.page ?? 1}&limit=${params?.limit ?? 100}&term=${params?.term ?? '1month'}`,
  );

export default getVodSearch;
