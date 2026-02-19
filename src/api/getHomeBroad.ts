import fetchJson from '@/utils/fetchJson';

export type GetHomeBroadResponse = {
  broadNo: number; // 290080510
  broadCateNo: number; // 810000
  parentBroadNo: number; // 0
  userId: string; // "9mogu9"
  broadTitle: string; // "오늘의 선물은 나야"
  broadType: string; // "21"
  broadStart: string; // "2025-12-19T10:00:16.000Z"
  currentSumViewer: number; // 158
  broadGrade: number; // 0
  subscriptionOnly: number; // 0
  totalViewCnt: number; // 2052
  visitBroadType: number; // 1
  isPassword: boolean; // false
  categoryName: string; // "버추얼"
  categoryTags: string[];
  hashTags: string[];
  autoHashTags: string[];
};

// 1분
export const REVALIDATE = 60;

const getHomeBroad = (userId: string) =>
  fetchJson<GetHomeBroadResponse>(
    `https://api-channel.sooplive.co.kr/v1.1/channel/${userId}/home/section/broad`,
  ).catch(() => Promise.resolve(null));

export default getHomeBroad;
