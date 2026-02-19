import fetchJson from '@/utils/fetchJson';

export type GetCalendarResponse = {
  days: {
    date: string; // "2025-11-24"
    events: {
      idx: number; // 129097
      calendarType: number; // 1
      calendarTypeName: '방송시작' | '합방' | '휴방' | '기타';
      title: string; // "자유 방송"
      eventDate: string; // "2025-11-24"
      eventTime: string; // "14:00"
      relTitleNo: null;
    }[];
  }[];
};
export type GetCalendarParams = { year?: number; month?: number };

// 30분
export const REVALIDATE = 1800;

const getCalendar = (userId: string, params?: GetCalendarParams) => {
  const today = new Date();
  const year = params?.year ?? today.getFullYear();
  const month = params?.month ?? today.getMonth() + 1;

  return fetchJson<GetCalendarResponse>(
    `https://api-channel.sooplive.co.kr/v1.1/channel/${userId}/calendar?view=month&year=${year}&month=${month}&userId=${userId}`,
  );
};

export default getCalendar;
