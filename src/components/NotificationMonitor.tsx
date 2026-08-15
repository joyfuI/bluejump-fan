import { skipToken, useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { GetHomeBroadResponse } from '@/api/getHomeBroad';
import getHomeBroad from '@/api/getHomeBroad';
import { MEMBERS } from '@/data/constants';

type ExtendedNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  timestamp?: number;
};

const canUseNotification = () => {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window
  );
};

const showNotificationOnce = async (
  broad: GetHomeBroadResponse,
  nick: string,
) => {
  const lockName = `notification:${broad.userId}`;
  const broadNo = broad.broadNo.toString();

  const notify = async () => {
    if (localStorage.getItem(lockName) === broadNo) {
      return;
    }

    const url = `https://play.sooplive.com/${broad.userId}`;
    const title = `${nick}님 방송 시작`;
    const options = {
      body: broad.broadTitle,
      data: { url },
      renotify: true,
      requireInteraction: true,
      tag: broad.userId,
      timestamp: new Date(broad.broadStart).getTime(),
    } satisfies ExtendedNotificationOptions;

    const registration =
      'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : undefined;
    if (registration?.active) {
      await registration.showNotification(title, options);
    } else {
      const notification = new Notification(title, options);
      notification.onclick = (e) => {
        e.preventDefault();
        notification.close();
      };
    }

    localStorage.setItem(lockName, broadNo);
  };

  if ('locks' in navigator) {
    await navigator.locks.request(lockName, notify);
  } else {
    // locks 미지원 브라우저
    await notify();
  }
};

const NotificationMonitor = () => {
  const [enabled, setEnabled] = useState(false);
  const broadNoMapRef = useRef(new Map<string, number>());

  const results = useQueries({
    queries: MEMBERS.map((member) => ({
      queryKey: ['getHomeBroad', member.id],
      queryFn: enabled ? () => getHomeBroad(member.id) : skipToken,
      refetchInterval: 10000,
      refetchIntervalInBackground: true,
    })),
  });

  useEffect(() => {
    if (!canUseNotification()) {
      return;
    }
    (async () => {
      let permission = Notification.permission;
      if (permission === 'default') {
        // 권한 요청
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        // 권한 거부
        setEnabled(false);
        return;
      }

      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (error) {
          console.error('서비스 워커 등록 실패:', error);
        }
      }
      setEnabled(true);
    })();
  }, []);

  useEffect(() => {
    if (enabled) {
      MEMBERS.forEach((member, index) => {
        const result = results[index];
        if (!result.isSuccess) {
          return;
        }

        const data = result.data;
        const prevBroadNo = broadNoMapRef.current.get(member.id);
        const currBroadNo = data?.broadNo ?? 0;

        if (prevBroadNo !== undefined && data && prevBroadNo !== currBroadNo) {
          showNotificationOnce(data, member.nick).catch(console.error);
        }

        broadNoMapRef.current.set(member.id, currBroadNo);
      });
    }
  }, [enabled, results]);

  return null;
};

export default NotificationMonitor;
