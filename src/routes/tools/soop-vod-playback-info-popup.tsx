/**
 * SOOP 재생정보 팝업 맥락 (동작을 바꾸면 이 주석도 갱신):
 * - public/userscript/soop-vod-playback-info-popup.user.js는 SOOP에서 별도로 설치·실행된다.
 *   npm 모듈을 공유하지 않으므로 송수신 메시지와 표시 디자인은 두 파일을 함께 맞춘다.
 * - 송신 관리 창을 닫으면 송신도 종료하지만, 같은 VOD 문서에서는 연결코드를 유지한다.
 *   관리 창을 다시 열면 기존 OBS URL로 재연결되며, VOD 새로고침 후에는 URL을 갱신해야 한다.
 *   수신기가 모두 나가도 관리 창이 열려 있으면 송신 방을 유지하며 연결 대기한다.
 * - Trystero 0.26의 Nostr 방을 사용한다. 두 파일의 appId·액션 이름·버전을 함께 맞춘다.
 *   연결코드는 roomId로 전달하며, 수신기는 passive로 참여해 송신기에만 연결한다.
 * - 사이트의 TURN 주소는 빌드 시 VITE_SOOP_CHAT_API_URL에 /turn을 붙여 결정한다.
 *   TURN API는 { iceServers }를 반환한다. 사이트에서는 fetch, 유저 스크립트에서는
 *   GM.xmlHttpRequest로 호출하며, 재접속마다 새 자격증명을 발급받아 방에 다시 참여한다.
 *   Nostr와 Cloudflare TURN을 사용하므로 인터넷이 필요하며 LAN으로 접속을 제한하지 않는다.
 * - Document PiP는 URL로 이동할 수 없어 수신 컴포넌트를 portal로 렌더링한다.
 *   ?roomId URL은 일반 팝업·OBS가 직접 사용하는 표시 전용 페이지이며 자동 PiP를 열지 않는다.
 * - OBS 화면을 가리지 않도록 정상 연결 상태는 숨기고 연결 중·끊김만 작게 표시한다.
 */

import { createFileRoute } from '@tanstack/react-router';
import { createStandardSchemaV1, parseAsString } from 'nuqs';
import {
  type ChangeEvent,
  type SubmitEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { joinRoom, type Room } from 'trystero';

const searchParams = { roomId: parseAsString };
const TRYSTERO_APP_ID = 'soop-vod-playback-info-popup';

type PlaybackInfo = { title: string; currentTime: number; duration: number };
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type Popup = { win: Window; roomId: string; kind: 'pip' | 'normal' };
type WindowWithDocumentPip = Window & {
  documentPictureInPicture?: {
    requestWindow: (options: {
      width: number;
      height: number;
    }) => Promise<Window>;
  };
};

const isPlaybackInfo = (data: unknown): data is PlaybackInfo => {
  if (typeof data !== 'object' || data === null) return false;
  return (
    'title' in data &&
    typeof data.title === 'string' &&
    'currentTime' in data &&
    typeof data.currentTime === 'number' &&
    Number.isFinite(data.currentTime) &&
    data.currentTime >= 0 &&
    'duration' in data &&
    typeof data.duration === 'number' &&
    Number.isFinite(data.duration) &&
    data.duration >= 0
  );
};

const formatTime = (seconds: number | undefined) => {
  if (seconds === undefined || !Number.isFinite(seconds)) return '--:--:--';
  const time = Math.max(0, Math.floor(seconds));
  return [Math.floor(time / 3600), Math.floor((time % 3600) / 60), time % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};

const isIceServers = (value: unknown): value is RTCIceServer[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((server) => {
    if (typeof server !== 'object' || server === null) return false;
    const urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
    return (
      Array.isArray(urls) &&
      urls.length > 0 &&
      urls.every(
        (url: unknown) =>
          typeof url === 'string' && /^(stun|stuns|turn|turns):\S+$/.test(url),
      ) &&
      (!urls.some((url: string) => /^turns?:/.test(url)) ||
        (typeof server.username === 'string' &&
          server.username.length > 0 &&
          typeof server.credential === 'string' &&
          server.credential.length > 0))
    );
  });

const PlaybackInfoReceiver = ({ roomId }: { roomId: string }) => {
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let stopped = false;
    let room: Room | null = null;
    let turnRequest: AbortController | null = null;
    let leaving = Promise.resolve();
    let generation = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attemptTimer: ReturnType<typeof setTimeout> | undefined;

    const clearAttempt = () => {
      clearTimeout(attemptTimer);
      attemptTimer = undefined;
    };
    const retry = () => {
      if (stopped || retryTimer !== undefined) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void start();
      }, 3000);
    };
    const disconnect = () => {
      if (stopped) return;
      generation++;
      clearAttempt();
      turnRequest?.abort();
      turnRequest = null;
      const previous = room;
      room = null;
      if (previous) {
        leaving = previous.leave().catch((error) => {
          console.warn('[SOOP VOD INFO] 수신 방 종료 실패', error);
        });
      }
      setStatus('disconnected');
      retry();
    };
    async function start() {
      if (stopped) return;
      const currentGeneration = ++generation;
      clearAttempt();
      // Nostr의 재공지 간격이 60초이므로 초기 방 탐색과 연결에는 90초를 허용한다.
      attemptTimer = setTimeout(disconnect, 90000);
      const controller = new AbortController();
      turnRequest = controller;
      try {
        const baseUrl = import.meta.env.VITE_SOOP_CHAT_API_URL?.trim();
        if (!baseUrl)
          throw new Error('VITE_SOOP_CHAT_API_URL 환경변수를 설정해 주세요.');
        await leaving;
        if (stopped || generation !== currentGeneration) return;
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/turn`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('TURN 발급 요청 실패');
        const data = await response.json();
        if (!isIceServers(data?.iceServers))
          throw new Error('TURN 서버 응답 형식 오류');
        if (stopped || generation !== currentGeneration) return;
        turnRequest = null;
        const next = joinRoom(
          {
            appId: TRYSTERO_APP_ID,
            passive: true,
            rtcConfig: { iceServers: data.iceServers },
          },
          roomId,
          {
            onJoinError: ({ error }) => {
              if (stopped || room !== next) return;
              console.warn('[SOOP VOD INFO] 수신 연결 오류', error);
              disconnect();
            },
          },
        );
        room = next;
        next.makeAction('playback').onMessage = (data: unknown) => {
          if (stopped || room !== next || !isPlaybackInfo(data)) return;
          clearAttempt();
          // 모바일 연결이 조용히 끊긴 경우에도 새 TURN 정보로 복구한다.
          attemptTimer = setTimeout(disconnect, 10000);
          setInfo(data);
          setStatus('connected');
        };
        next.onPeerLeave = () => {
          if (!stopped && room === next) disconnect();
        };
      } catch (error) {
        if (stopped || generation !== currentGeneration) return;
        console.warn('[SOOP VOD INFO] 수신 연결 준비 실패', error);
        disconnect();
      }
    }

    void start();
    return () => {
      stopped = true;
      generation++;
      clearTimeout(retryTimer);
      clearAttempt();
      turnRequest?.abort();
      const previous = room;
      room = null;
      void previous?.leave().catch((error) => {
        console.warn('[SOOP VOD INFO] 수신 방 종료 실패', error);
      });
    };
  }, [roomId]);

  const progress =
    info && info.duration > 0
      ? Math.min(1, info.currentTime / info.duration) * 100
      : 0;

  return (
    <main
      className="pointer-events-none fixed inset-0 flex select-none items-center overflow-hidden bg-[#17181c] text-[#f5f5f5]"
      style={{
        fontFamily:
          'Pretendard, "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {status !== 'connected' && (
        <div
          className="absolute top-[3px] right-2 text-[10px] leading-[14px] text-[#aaa]"
          role="status"
        >
          {status === 'connecting' ? '연결 중' : '연결 끊김'}
        </div>
      )}
      <div className="w-full px-[22px] pt-4 pb-[17px]">
        <div className="mb-[14px] flex w-full items-center gap-6">
          <div
            className="min-w-0 flex-1 truncate text-[17px] leading-[1.3] font-[650]"
            data-playback="title"
            title={info?.title}
          >
            {info?.title ?? '제목 불러오는 중...'}
          </div>
          <div
            className="shrink-0 whitespace-nowrap text-[15px] font-semibold text-[#dddddd] tabular-nums"
            data-playback="time"
            style={{
              fontFamily:
                '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
              lineHeight: 'normal',
            }}
          >
            {formatTime(info?.currentTime)} / {formatTime(info?.duration)}
          </div>
        </div>
        <div className="flex h-4 w-full items-center">
          <div className="relative h-[5px] w-full rounded-full bg-[#45474f]">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-white"
              data-playback="progress"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
              data-playback="thumb"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </main>
  );
};

const ConnectionForm = () => {
  const codeId = useId();
  const urlId = useId();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [opening, setOpening] = useState(false);
  const [pipPopup, setPipPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const disposed = useRef(false);
  const roomId = code.trim();
  const popupUrl =
    roomId && typeof window !== 'undefined'
      ? `${window.location.origin}/tools/soop-vod-playback-info-popup?roomId=${encodeURIComponent(roomId)}`
      : '';

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      if (popupRef.current?.kind === 'pip') popupRef.current.win.close();
    };
  }, []);

  const openPopup = async () => {
    if (!roomId || opening) return;
    setMessage('');
    const existing = popupRef.current;
    if (existing && !existing.win.closed) {
      if (existing.roomId !== roomId) {
        const updated = { ...existing, roomId };
        popupRef.current = updated;
        if (existing.kind === 'pip') setPipPopup(updated);
        else existing.win.location.href = popupUrl;
      }
      existing.win.focus();
      return;
    }
    setOpening(true);
    try {
      const documentPip = (window as WindowWithDocumentPip)
        .documentPictureInPicture;
      if (documentPip) {
        try {
          const win = await documentPip.requestWindow({
            width: 680,
            height: 110,
          });
          if (disposed.current) {
            win.close();
            return;
          }
          win.document.title = 'SOOP VOD 재생정보';
          for (const node of document.querySelectorAll(
            'style, link[rel="stylesheet"]',
          )) {
            win.document.head.appendChild(node.cloneNode(true));
          }
          const popup: Popup = { win, roomId, kind: 'pip' };
          popupRef.current = popup;
          setPipPopup(popup);
          win.addEventListener(
            'pagehide',
            () => {
              if (popupRef.current?.win !== win) return;
              popupRef.current = null;
              setPipPopup(null);
            },
            { once: true },
          );
          return;
        } catch (error) {
          console.warn('[SOOP VOD INFO] Document PiP 열기 실패', error);
        }
      }
      if (disposed.current) return;
      const win = window.open(
        popupUrl,
        'soopVodRemoteInfo',
        'width=680,height=140,resizable=yes,scrollbars=no',
      );
      if (!win) {
        setMessage(
          '팝업을 열 수 없습니다. 브라우저의 팝업 차단 설정을 확인해주세요.',
        );
        return;
      }
      popupRef.current = { win, roomId, kind: 'normal' };
    } catch (error) {
      console.warn('[SOOP VOD INFO] 팝업 열기 실패', error);
      setMessage(
        '팝업을 열 수 없습니다. 브라우저의 팝업 차단 설정을 확인해주세요.',
      );
    } finally {
      if (!disposed.current) setOpening(false);
    }
  };

  const copyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(popupUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = popupUrl;
        document.body.appendChild(textArea);
        try {
          textArea.select();
          if (!document.execCommand('copy')) throw new Error('복사 실패');
        } finally {
          textArea.remove();
        }
      }
      setMessage('팝업 URL을 복사했습니다.');
    } catch {
      setMessage('복사하지 못했습니다. 아래 URL을 직접 복사해주세요.');
    }
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openPopup();
  };
  const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCode(event.target.value);
    setMessage('');
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h1 className="text-xl font-semibold">SOOP VOD 재생정보 팝업</h1>
        <p className="mt-2 text-sm text-zinc-400">
          SOOP VOD에서 외부연결 팝업을 열고, 표시된 연결코드를 입력하세요.
        </p>
        <a
          className="mt-4 inline-flex rounded-lg border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800"
          href="https://gist.github.com/joyfuI/5898be2770fb1eac003f9abb164b7a08/raw/soop-vod-playback-info-popup.user.js"
          rel="noreferrer"
          target="_blank"
        >
          유저 스크립트 설치
        </a>
        <p className="mt-2 text-xs text-zinc-400">
          <a
            className="underline underline-offset-2 hover:text-zinc-200"
            href="https://www.tampermonkey.net/"
            rel="noreferrer"
            target="_blank"
          >
            Tampermonkey
          </a>{' '}
          등 유저 스크립트 관리자가 필요합니다.
        </p>
        <form className="mt-6 flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="text-sm font-medium" htmlFor={codeId}>
            연결코드
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
            id={codeId}
            onChange={handleCodeChange}
            placeholder="외부연결 팝업의 연결코드를 붙여넣으세요"
            type="text"
            value={code}
          />
          <button
            className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            disabled={!roomId || opening}
            type="submit"
          >
            {opening ? '팝업 여는 중...' : '팝업 열기'}
          </button>
        </form>
        <label className="mt-5 block text-sm font-medium" htmlFor={urlId}>
          OBS 브라우저 소스용 팝업 URL
        </label>
        <div className="mt-2 flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300"
            id={urlId}
            placeholder="연결코드를 입력하면 URL이 표시됩니다"
            readOnly
            value={popupUrl}
          />
          <button
            aria-label="팝업 URL 복사"
            className="shrink-0 rounded-lg border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-40"
            disabled={!popupUrl}
            onClick={copyUrl}
            type="button"
          >
            복사
          </button>
        </div>
        <p className="mt-3 text-sm text-zinc-300">
          OBS 권장 크기: 너비 680px · 높이 110px
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          재생정보를 보내는 동안 SOOP의 외부연결 팝업을 열어 두세요. VOD
          페이지를 새로고침하면 새 연결코드로 OBS URL을 갱신해야 합니다.
        </p>
        <p className="mt-3 min-h-5 text-sm text-sky-300" role="status">
          {message}
        </p>
      </section>
      {pipPopup
        ? createPortal(
            <PlaybackInfoReceiver
              key={pipPopup.roomId}
              roomId={pipPopup.roomId}
            />,
            pipPopup.win.document.body,
          )
        : null}
    </main>
  );
};

const RouteComponent = () => {
  const roomId = Route.useSearch().roomId?.trim();
  return roomId ? (
    <PlaybackInfoReceiver key={roomId} roomId={roomId} />
  ) : (
    <ConnectionForm />
  );
};

export const Route = createFileRoute('/tools/soop-vod-playback-info-popup')({
  component: RouteComponent,
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  head: () => ({ meta: [{ title: 'SOOP VOD 재생정보 팝업' }] }),
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
