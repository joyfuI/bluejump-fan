import fetchJson from '@/utils/fetchJson';

export type GetBluejumpNewsResponse = {
  data: {
    id: number; // 71
    title: string; // "블루점프 3기생 '누눙지'님의 OGQ 이모지 \"주식소녀 누눙지쨩\" 출시 안내"
    title_en: string; // ""
    category: string; // "Notice"
    thumbnail_url: string; // "https://ypwwfffamjeuomxevmtk.supabase.co/storage/v1/object/public/live-creator-images/news/1778618865173-lcf5jf.jpg"
    creator: string; // ""
    published: boolean; // true
    created_at: string; // "2026-05-12T20:55:34.096987+00:00"
    content: string; // "블루점프 3기생 누눙지님의 OGQ 이모지 \"주식소녀 누눙지쨩\" 출시되었습니다!! 이번 이모지는 SOOP과 네이버 OGQ 마켓에서 구매하실 수 있습니다! 이번 이모티콘은 누눙지 특유의 ‘주식 밈’ 감성과 다양한 리액션을 담아, 채팅에서 활용하기 좋은 표현들로 구성되어 있습니다. [이모지 목록] 이제 “상/하한가”, “물타기”, “비상” 등 누눙지짱의 리액션으로 오늘의 기분을 마음껏 표현해 보세요! -SOOP OGQ 마켓 : https://ogqmarket.sooplive.com/emoticon/650963e0fdeb0 -네이버 OGQ"
    content_en: string; // ""
  }[];
};

const getBluejumpNews = () =>
  fetchJson<GetBluejumpNewsResponse>('https://bluejump.co.kr/api/news');

export default getBluejumpNews;
