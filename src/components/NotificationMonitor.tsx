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

  const notify = () => {
    if (localStorage.getItem(lockName) === broadNo) {
      return;
    }

    const options = {
      body: broad.broadTitle,
      renotify: true,
      requireInteraction: true,
      tag: broad.userId,
      timestamp: new Date(broad.broadStart).getTime(),
    } satisfies ExtendedNotificationOptions;
    const notification = new Notification(`${nick}님 방송 시작`, options);
    notification.onclick = () => {
      notification.close();
      window.open(
        `https://play.sooplive.com/${broad.userId}`,
        '_blank',
        'noreferrer',
      );
    };

    localStorage.setItem(lockName, broadNo);
  };

  if ('locks' in navigator) {
    await navigator.locks.request(lockName, notify);
  } else {
    // locks 미지원 브라우저
    notify();
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
