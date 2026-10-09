/**
 * SOOP 재생정보 팝업 맥락 (동작을 바꾸면 이 주석도 갱신):
 * - public/userscript/soop-vod-playback-info-popup.user.js는 SOOP에서 별도로 설치·실행된다.
 *   npm 모듈을 공유하지 않으므로 송수신 메시지와 표시 디자인은 두 파일을 함께 맞춘다.
 * - 송신 관리 창을 닫으면 송신도 종료하지만, 같은 VOD 문서에서는 연결코드를 유지한다.
 *   관리 창을 다시 열면 기존 OBS URL로 재연결되며, VOD 새로고침 후에는 URL을 갱신해야 한다.
 * - PeerJS 공개 서버로 연결을 맺으므로 인터넷이 필요하며 LAN으로 접속을 제한하지 않는다.
 * - Document PiP는 URL로 이동할 수 없어 수신 컴포넌트를 portal로 렌더링한다.
 *   ?peerId URL은 일반 팝업·OBS가 직접 사용하는 표시 전용 페이지이며 자동 PiP를 열지 않는다.
 * - OBS 화면을 가리지 않도록 정상 연결 상태는 숨기고 연결 중·끊김만 작게 표시한다.
 */

import { createFileRoute } from '@tanstack/react-router';
import { createStandardSchemaV1, parseAsString } from 'nuqs';
import type { DataConnection, Peer } from 'peerjs';
import {
  type ChangeEvent,
  type SubmitEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const searchParams = { peerId: parseAsString };

type PlaybackInfo = { title: string; currentTime: number; duration: number };
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
type Popup = { win: Window; peerId: string; kind: 'pip' | 'normal' };
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

const PlaybackInfoReceiver = ({ peerId }: { peerId: string }) => {
  const [info, setInfo] = useState<PlaybackInfo | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    let stopped = false;
    let peer: Peer | null = null;
    let connection: DataConnection | null = null;
    let received = false;
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
      const previous = connection;
      connection = null;
      received = false;
      previous?.close();
      setStatus('disconnected');
      retry();
    };
    const connect = (activePeer: Peer) => {
      if (stopped || peer !== activePeer || connection || !activePeer.open)
        return;
      const next = activePeer.connect(peerId, {
        reliable: true,
        serialization: 'json',
      });
      connection = next;
      next.on('data', (data: unknown) => {
        if (stopped || connection !== next || !isPlaybackInfo(data)) return;
        received = true;
        setInfo(data);
        setStatus('connected');
        if (activePeer.open) {
          clearAttempt();
          clearTimeout(retryTimer);
          retryTimer = undefined;
        }
      });
      next.on('close', () => {
        if (connection === next) disconnect();
      });
      next.on('error', () => {
        if (connection === next) disconnect();
      });
    };
    async function start() {
      if (stopped) return;
      const currentGeneration = ++generation;
      clearAttempt();
      attemptTimer = setTimeout(() => {
        clearAttempt();
        if (connection?.open && received) {
          peer?.disconnect();
          retry();
        } else {
          if (peer && !peer.open) {
            const previous = peer;
            peer = null;
            previous.destroy();
          }
          disconnect();
        }
      }, 10000);

      try {
        if (!peer || peer.destroyed) {
          const { Peer } = await import('peerjs');
          if (stopped || generation !== currentGeneration) return;
          const activePeer = new Peer();
          peer = activePeer;
          activePeer.on('open', () => {
            if (stopped || peer !== activePeer) return;
            if (connection?.open && received) {
              clearAttempt();
              clearTimeout(retryTimer);
              retryTimer = undefined;
            }
            connect(activePeer);
          });
          activePeer.on('disconnected', () => {
            if (stopped || peer !== activePeer) return;
            clearAttempt();
            if (connection?.open && received) retry();
            else disconnect();
          });
          activePeer.on('error', () => {
            if (stopped || peer !== activePeer) return;
            if (connection?.open && received) retry();
            else disconnect();
          });
          activePeer.on('close', () => {
            if (stopped || peer !== activePeer) return;
            peer = null;
            disconnect();
          });
        } else if (peer.disconnected) {
          peer.reconnect();
        } else if (peer.open) {
          if (connection?.open && received) clearAttempt();
          connect(peer);
        }
      } catch {
        disconnect();
      }
    }

    void start();
    return () => {
      stopped = true;
      generation++;
      clearTimeout(retryTimer);
      clearAttempt();
      connection?.close();
      peer?.destroy();
    };
  }, [peerId]);

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
  const peerId = code.trim();
  const popupUrl =
    peerId && typeof window !== 'undefined'
      ? `${window.location.origin}/tools/soop-vod-playback-info-popup?peerId=${encodeURIComponent(peerId)}`
      : '';

  useEffect(() => {
    disposed.current = false;
    return () => {
      disposed.current = true;
      if (popupRef.current?.kind === 'pip') popupRef.current.win.close();
    };
  }, []);

  const openPopup = async () => {
    if (!peerId || opening) return;
    setMessage('');
    const existing = popupRef.current;
    if (existing && !existing.win.closed) {
      if (existing.peerId !== peerId) {
        const updated = { ...existing, peerId };
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
          const popup: Popup = { win, peerId, kind: 'pip' };
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
      popupRef.current = { win, peerId, kind: 'normal' };
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
          href="/userscript/soop-vod-playback-info-popup.user.js"
          rel="noopener noreferrer"
          target="_blank"
        >
          유저 스크립트 설치
        </a>
        <p className="mt-2 text-xs text-zinc-400">
          Tampermonkey 등 유저 스크립트 관리자가 필요합니다.
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
            disabled={!peerId || opening}
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
              key={pipPopup.peerId}
              peerId={pipPopup.peerId}
            />,
            pipPopup.win.document.body,
          )
        : null}
    </main>
  );
};

const RouteComponent = () => {
  const peerId = Route.useSearch().peerId?.trim();
  return peerId ? (
    <PlaybackInfoReceiver key={peerId} peerId={peerId} />
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
