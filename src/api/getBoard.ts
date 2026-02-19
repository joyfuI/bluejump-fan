import fetchJson from '@/utils/fetchJson';

export type GetBoardResponse = {
  data: {
    title_no: number; // 186890565
    station_no: number; // 21670907
    bbs_no: number; // 72360725
    board_type: number; // 103
    auth_no: number; // 101
    title_name: string; // "이번엔 진짜 화끈합니다 [제갈금자x마로니 빨간안경]"
    user_nick: string; // "제갈금자"
    user_id: string; // "dlsn9911"
    profile_image: string; // "//profile.img.sooplive.co.kr/LOGO/dl/dlsn9911/dlsn9911.jpg"
    photo_cnt: number; // 1
    platform_type: number; // 1
    notice_yn: number; // 0
    comment_yn: number; // 1
    reply_yn: number; // 1
    livepost_yn: number; // 1
    share_yn: number; // 1
    search_yn: number; // 1
    ip: string; // ""
    reg_date: string; // "2026-02-14 22:51:20"
    count: {
      like_cnt: number; // 148
      read_cnt: number; // 1999
      comment_cnt: number; // 39
      vod_read_cnt: number; // 1999
      ucc_favorite_cnt: number; // 0
    };
    content: {
      content: string; // "<p style="text-align: center;"><img alt="upload-photo" class="upload-photo image-loaded" data-url="https://stimg.sooplive.co.kr/NORMAL_BBS/7/21670907/740769907dc701acf.png" src="https://stimg.sooplive.co.kr/NORMAL_BBS/7/21670907/740769907dc701acf.png" /></p><p>&nbsp;</p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;">알림 너무 많이 보내서 죄송해용 ㅠ</p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;"><br />&nbsp;</p>"
      text_content: string; // "알림 너무 많이 보내서 죄송해용 ㅠ"
      summary: string; // "  알림 너무 많이 보내서 죄송해용 ㅠ  "
    };
    display: {
      bbs_name: string; // "방송 공지"
    };
    ucc: {
      auto_delete_remain_hours: null;
      auto_hashtags: string[]; // []
      category: number; // 10000
      category_tags: string[]; // ['월드 오브 탱크']
      file_type: string; // "NORMAL"
      flag: string; // "SUCCEED"
      grade: number; // 0
      hash_tags: string[]; // []
      lang_tags: string[]; // ['한국어']
      paid_ppv: null;
      story_idx: null;
      thumb: string; // "//iflv14.sooplive.co.kr/save/afreeca/station/2026/0209/15/thumb/1770618227512789_R_7.jpg"
      thumb_type: string; // "SUCCEED"
      total_file_duration: number; // 670698
      ucc_type: string; // "0"
      vod_category: number; // 40102
    } | null;
    pin: null;
    copyright: null;
    vote: null;
    like: null;
    bjlike: null;
    badge: null;
    reserve: null;
    photos: {
      photo_no: number; // 47446263
      rnum: number; // 1
      file_size: number; // 1680463
      file_name: string; // "740769907dc701acf.png"
      img_height: number; // 1800
      img_width: number; // 1300
      url: string; // "//stimg.sooplive.co.kr/NORMAL_BBS/7/21670907/740769907dc701acf.png"
      key: string; // "NORMAL_BBS/7/21670907/740769907dc701acf.png"
    }[];
    calendar: [];
    authority: {
      is_board_shareable: boolean; // true
      is_board_deletable: boolean; // false
      is_reason_deletable: boolean; // false
      is_ucc_deletable: boolean; // false
      is_board_updatable: boolean; // false
      is_ucc_updatable: boolean; // false
      is_movable: boolean; // false
      is_pinable: boolean; // false
      is_pin_fixable: boolean; // false
      is_pin_cancelable: boolean; // false
      is_vod_pinable: boolean; // false
      is_vod_pin_fixable: boolean; // false
      is_vod_pin_cancelable: boolean; // false
      is_notice_cancelable: boolean; // false
      is_reportable: boolean; // true
      is_ucc_editable: boolean; // false
      is_ucc_mid_roll_settable: boolean; // false
    };
  }[];
  links: {
    first: string; // "https://chapi.sooplive.co.kr/api/dlsn9911/board/72360725?page=1"
    last: string; // "https://chapi.sooplive.co.kr/api/dlsn9911/board/72360725?page=61"
    prev: null;
    next: string; // "https://chapi.sooplive.co.kr/api/dlsn9911/board/72360725?page=2"
  };
  meta: {
    current_page: number; // 1
    from: number; // 1
    last_page: number; // 61
    path: string; // "https://chapi.sooplive.co.kr/api/dlsn9911/board/72360725"
    per_page: number; // 20
    to: number; // 20
    total: number; // 1209
  };
  notice_data: {
    title_no: number; // 183651161
    station_no: number; // 21670907
    bbs_no: number; // 72360725
    board_type: number; // 104
    auth_no: number; // 101
    title_name: string; // "결혼/연애 관련 갈등 사연 상시 모집 중"
    user_nick: string; // "제갈금자"
    user_id: string; // "dlsn9911"
    profile_image: string; // "//profile.img.sooplive.co.kr/LOGO/dl/dlsn9911/dlsn9911.jpg"
    photo_cnt: number; // 0
    platform_type: number; // 1
    notice_yn: number; // 2
    comment_yn: number; // 1
    reply_yn: number; // 1
    livepost_yn: number; // 1
    share_yn: number; // 1
    search_yn: number; // 1
    ip: string; // ""
    reg_date: string; // "2026-01-13 12:56:18"
    count: {
      like_cnt: number; // 106
      read_cnt: number; // 2504
      comment_cnt: number; // 23
      vod_read_cnt: number; // 2504
      ucc_favorite_cnt: number; // 0
    };
    content: {
      content: string; // "<p style="text-align: center;">&nbsp;</p><p style="text-align: center;"><span style="font-size:28px;">본인 혹은 주변에서 <strong><span style="color:#ee82ee;">&lt;결혼/연애&gt;</span></strong> 생활 중 발생했던 <span style="color:#b22222;"><strong>갈등 경험에 대한 사연</strong></span>을 적어주세요!</span></p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;"><span style="font-size:20px;">채택된 사연은 방송에서 </span><strong><span style="font-size:26px;"><span style="color:#0000ff;">변호사님</span></span></strong><span style="font-size:20px;">이 </span><span style="font-size:22px;"><strong>법적 조언</strong></span><span style="font-size:20px;">을 해드릴 예정이며,</span><br /><span style="font-size:22px;"><strong>최대한 자세하게</strong></span><span style="font-size:20px;"> 작성해주시면 </span><span style="font-size:22px;"><strong>더욱 정확한 조언</strong></span><span style="font-size:20px;">을 해드리는데 도움이 됩니다.</span></p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;"><span style="font-size:20px;">※ 결혼/연애 갈등과 관련된 평소 궁금하셨던 가벼운 주제의 사연도 괜찮습니다.<br />※ 보내주신 사연은 방송을 위해 각색하여 사용됩니다.</span></p><p style="text-align: center;"><br /><span style="font-size:26px;"><span style="color:#ffffff;"><strong><span style="background-color:#ee82ee;">[사연 모집 폼]</span></strong></span></span></p><p style="text-align: center;"><a target="_blank" href="https://forms.gle/hityAprG6WTcfQVT6">https://forms.gle/hityAprG6WTcfQVT6</a></p><p style="text-align: center;">&nbsp;</p><p style="text-align: center;"><span style="font-size:28px;">많은 관심 부탁드리겠습니다!!</span></p>"
      text_content: string; // "본인 혹은 주변에서  생활 중 발생했던 갈등 경험에 대한 사연을 적어주세요!<br />채택된 사연은 방송에서 변호사님이 법적 조언을 해드릴 예정이며,<br />최대한 자세하게 작성해주시면 더욱 정확한 조언을 해드리는데 도움이 됩니다.<br />※ 결혼/연애 갈등과 관련된 평소 궁금하셨던 가벼운 주제의 사연도 괜찮습니다.<br /..."
      summary: string; // " 본인 혹은 주변에서  생활 중 발생했던 갈등 경험에 대한 사연을 적어주세요! 채택된 사연은 방송에서 변호사님이 법적 조언을 해드릴 예정이며,최대한 자세하게 작성해주시면 더욱 정확한 조언을 해드리는데 도움이 됩니다.  ※ 결혼/연애 갈등과 관련된 평소 궁금하셨던 가벼운 주제의 사연도 괜찮습니다.※ 보내주신 사연은 방송을 위해 각..."
    };
    display: {
      bbs_name: string; // "방송 공지"
    };
    ucc: null;
    pin: null;
    copyright: null;
    like: null;
    bjlike: null;
    badge: null;
    reserve: null;
    photos: [];
    authority: {
      is_board_shareable: boolean; // true
      is_board_deletable: boolean; // false
      is_reason_deletable: boolean; // false
      is_ucc_deletable: boolean; // false
      is_board_updatable: boolean; // false
      is_ucc_updatable: boolean; // false
      is_movable: boolean; // false
      is_pinable: boolean; // false
      is_pin_fixable: boolean; // false
      is_pin_cancelable: boolean; // false
      is_vod_pinable: boolean; // false
      is_vod_pin_fixable: boolean; // false
      is_vod_pin_cancelable: boolean; // false
      is_notice_cancelable: boolean; // false
      is_reportable: boolean; // true
      is_ucc_editable: boolean; // false
      is_ucc_mid_roll_settable: boolean; // false
    };
  }[];
};
export type GetBoardParams = { page?: number };

// 10분
export const REVALIDATE = 600;

const getBoard = (
  userId: string,
  boardNumber?: number,
  params?: GetBoardParams,
) =>
  fetchJson<GetBoardResponse>(
    `https://chapi.sooplive.co.kr/api/${userId}/board/${boardNumber ?? ''}?per_page=20&field=title,contents,user_nick,user_id,hashtags&type=all&order_by=reg_date&board_number=${boardNumber ?? ''}&page=${params?.page ?? 1}`,
  );

export default getBoard;
