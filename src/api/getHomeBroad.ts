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

const getHomeBroad = async (userId: string) => {
  const response = await fetch(
    `https://api-channel.sooplive.com/v1.1/channel/${userId}/home/section/broad`,
  );
  if (!response.ok) {
    throw new Error(response.statusText, { cause: response });
  }

  const body = await response.text();

  // 정상 응답이지만 본문이 없으면 방송 중이 아님
  if (!body.trim()) {
    return null;
  }

  return JSON.parse(body) as GetHomeBroadResponse;
};

export default getHomeBroad;
