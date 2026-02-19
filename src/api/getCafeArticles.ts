import fetchJson from '@/utils/fetchJson';

export type GetCafeArticlesResponse = {
  result: {
    articleList: {
      type: string; // "ARTICLE"
      item: {
        articleId: number; // 3135
        cafeId: number; // 31345283
        refArticleId: number; // 3135
        replyArticleCount: number; // 0
        writerInfo: {
          memberKey: string; // "xbXlVcN84bo8_xXzz4lC5Rn_X0bBZgz7sUW-dLURZGY"
          nickName: string; // "아이덴큐"
          memberLevel: number; // 1
          memberLevelName: string; // "지상인"
          memberLevelIconId: number; // 1
          staff: boolean; // false
          manager: boolean; // false
          secedeMember: boolean; // false
        };
        menuId: number; // 43
        readLevel: number; // 1
        restrictMenu: boolean; // false
        subject: string; // "두구둥 안녕하십니까! 인사 올립니다!!!"
        writeDateTimestamp: number; // 1767261439300
        representImage: string; // "https://cafeptthumb-phinf.pstatic.net/MjAyNjAxMDFfNzcg/MDAxNzY3MjU2Njc0Njg4.Kz4gqN36MBBjlUGcdg-2UdOJGlh5xBGYR6dzQ86uaSQg.uLi-tIHUo7FizUYilmSDkhMz8qWm8FG3nqMy9qpGtFAg.GIF/%25EB%25B0%259C%25E3%2585%258A%25EC%2595%2584%25EA%25B8%25B0.gif"
        representImageType: string; // "G"
        summary: string; // "이 발차기 하나로 여기까지 올라왔다!\n블루점프 4기 서류 합격\n아이덴큐입니다!!!\n편하게 뎅큐 덴큐라고 부르셔도 됩니다!!!\n**웹툰 아닙니다 아이온큐 주주 아닙니다!!\n오늘은 합격 기념 기분이 좋아 세팅도 제대로 되진 않았지만\n일단 풀트부터 해보자!라는 생각으로 풀트 방송을 합니다!!!!\n저는 2D도 있고 \n3D도 있어서 현재는 번갈아 쓰고 있습니다!!\n소통 및 옷 보여주기가 주된 일이라서 많이 실수도 나고\n이상한 짓만 할 수 있습니다만 잘 부탁드리겠습니다!!!\nhttps://www.sooplive.co.kr/station/..."
        blindArticle: boolean; // false
        commentCount: number; // 4
        readCount: number; // 49
        hasCalender: boolean; // false
        hasFile: boolean; // false
        hasGpx: boolean; // false
        hasImage: boolean; // true
        hasLink: boolean; // true
        hasMap: boolean; // false
        hasMusic: boolean; // false
        hasMovie: boolean; // false
        hasPoll: boolean; // false
        likeCount: number; // 9
        liked: boolean; // false
        newArticle: boolean; // true
        delParent: boolean; // false
        marketArticle: boolean; // false
        popular: boolean; // false
        openArticle: boolean; // true
        hasNewComment: boolean; // true
        enableComment: boolean; // true
        refArticle: boolean; // false
      };
    }[];
    pageInfo: {
      lastNavigationPageNumber: number; // 1
      visibleNextButton: boolean; // false
    };
  };
};

export type GetCafeArticlesParams = { page?: number; pageSize?: number };

// 10분
export const REVALIDATE = 600;

const getCafeArticles = (
  cafeId: number = 31345283,
  menuId: number = 43,
  params?: GetCafeArticlesParams,
) =>
  fetchJson<GetCafeArticlesResponse>(
    `https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/${cafeId}/menus/${menuId}/articles?page=${params?.page ?? 1}&pageSize=${params?.pageSize ?? 100}&sortBy=TIME&viewType=C`,
  );

export default getCafeArticles;
