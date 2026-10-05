/**
 * 열혈팬 출석체크 맥락 (관련 동작을 바꾸면 이 주석도 갱신):
 * - 로그인 없이 공개 방송만 지원한다. SOOP 라이브 정보 API의 CORS 제한 때문에
 *   접속 정보는 외부 서버에서 조회하고 채팅 WebSocket은 브라우저가 SOOP에 직접 연결한다.
 * - VITE_SOOP_CHAT_API_URL은 외부 서버의 기본 URL이며 빌드 시 반영된다.
 *   GET {기본 URL}/channel?streamerId={ID}는 성공 시 ChannelInfo,
 *   실패 시 비2xx 상태와 직렬화된 { code, message, reason? } 오류를 반환해야 한다.
 *   오류 복원은 방송 종료·접근 제한 시 라이브러리의 자동 재연결을 멈추는 데 필요하다.
 *   서버는 사이트 Origin을 CORS로 허용하고 재연결마다 최신 접속 정보를 제공해야 한다.
 * - 참고: https://github.com/joyfuI/soop-chat-webtool/tree/main/apps/gamepinball-helper
 *   라이브러리: https://github.com/joyfuI/soop-chat (soop-chat/browser 사용).
 * - 유효한 userId 쿼리가 있으면 자동 시작한다. 중지/취소는 쿼리를 지우고 입력 화면으로 돌아간다.
 * - 열혈팬 목록은 시작 시 SOOP API에서 직접 한 번 조회한다. ID 정규화·중복 제거 후
 *   API 순서대로 최대 20명을 표시하며 재연결 중에는 목록을 다시 조회하지 않는다.
 * - 매칭 ID는 끝의 (숫자)를 제거하고 소문자로 바꾼다. 원본 접속 ID는 별도로 추적하여
 *   같은 계정의 여러 접속 중 하나만 퇴장해도 나머지 접속의 시청 상태를 유지한다.
 * - 시청 상태는 chatUser/채팅으로 관측한 접속 기준이며 전체 시청자 명단을 보장하지 않는다.
 *   재연결·방송 종료·접근 제한 시 시청 상태를 지우고, 재연결 후 다시 수집한다.
 * - 연결 이후 채팅을 한 번 받은 팬은 퇴장·재연결·방송 종료 후에도 출석 완료를 유지한다.
 *   기록은 현재 세션의 메모리에만 두며 중지/새 시작/새로고침하면 초기화한다.
 * - 팬별 최신 채팅 하나를 마지막 수신부터 5초간 표시한다. 본문/줄 수 제한과 툴팁은 없다.
 *   말풍선은 행의 세로 중앙에서 겹칠 수 있으며 최신 수신 순번이 위에 보인다.
 *   행/열에 별도 쌓임 맥락(stacking context)이나 overflow:hidden을 만들면 이 규칙이 깨질 수 있다.
 */

import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  CircleCheck,
  CircleMinus,
  Eye,
  LoaderCircle,
  MessageCircle,
  Play,
  Square,
} from 'lucide-react';
import { createStandardSchemaV1, parseAsString, useQueryState } from 'nuqs';
import {
  type ChangeEvent,
  type SubmitEvent,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  BroadcastOfflineError,
  type ChannelInfo,
  ChannelResolutionError,
  deserializeChannelResolutionError,
  RestrictedRoomError,
  SoopChat,
} from 'soop-chat/browser';

import fetchJson from '@/utils/fetchJson';

type TopFan = { userId: string; userNick: string; profileImage: string };
type Fan = TopFan & {
  watching: boolean;
  attended: boolean;
  message: { text: string; sequence: number } | null;
};
type Phase =
  | 'idle'
  | 'loading'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'ended';

const DEFAULT_AVATAR =
  'https://profile.img.sooplive.com/LOGO/default_avatar.jpg';
const BUBBLE_DURATION_MS = 5_000;
const STATUS = {
  absent: {
    icon: CircleMinus,
    label: '시청 중이 아님',
    color: 'text-slate-500',
  },
  watching: { icon: Eye, label: '시청 중', color: 'text-sky-400' },
  completed: {
    icon: CircleCheck,
    label: '출석체크 완료',
    color: 'text-emerald-400',
  },
};
const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  loading: '열혈팬 목록 불러오는 중',
  connecting: '채팅 연결 중',
  connected: '채팅 연결됨',
  reconnecting: '다시 연결하는 중',
  ended: '연결 종료',
};

const searchParams = { userId: parseAsString };
const normalizeUserId = (userId: string) =>
  userId.replace(/\(\d+\)$/, '').toLowerCase();
const isValidStreamerId = (value: string) => /^[a-z0-9_]+$/i.test(value);

const normalizeProfileImage = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_AVATAR;
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    return ['http:', 'https:'].includes(url.protocol)
      ? url.href
      : DEFAULT_AVATAR;
  } catch {
    return DEFAULT_AVATAR;
  }
};

const getChannelUrl = () => {
  const base = import.meta.env.VITE_SOOP_CHAT_API_URL?.trim();
  if (!base)
    throw new Error('VITE_SOOP_CHAT_API_URL 환경변수를 설정해 주세요.');
  try {
    const url = new URL('channel', `${base.replace(/\/+$/, '')}/`);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url;
  } catch {
    // 아래에서 설정 오류로 안내한다.
  }
  throw new Error('VITE_SOOP_CHAT_API_URL에 올바른 서버 주소를 설정해 주세요.');
};

const getTopFans = async (streamerId: string, signal: AbortSignal) => {
  let data: unknown;
  try {
    data = await fetchJson<unknown>(
      `https://api-channel.sooplive.com/v1.1/channel/${encodeURIComponent(streamerId)}/topfans/detail`,
      { signal, cache: 'no-store', credentials: 'omit' },
    );
  } catch {
    throw new Error(
      '열혈팬 목록을 가져오지 못했습니다. 스트리머 아이디를 확인하고 다시 시도해 주세요.',
    );
  }
  if (!Array.isArray(data))
    throw new Error('열혈팬 목록의 응답이 올바르지 않습니다.');
  const fans = new Map<string, Fan>();
  for (const entry of data) {
    const fan = entry as Partial<TopFan> | null;
    if (
      !fan ||
      typeof fan.userId !== 'string' ||
      !fan.userId ||
      typeof fan.userNick !== 'string'
    ) {
      throw new Error('열혈팬 목록의 응답이 올바르지 않습니다.');
    }
    const userId = normalizeUserId(fan.userId);
    if (!fans.has(userId)) {
      fans.set(userId, {
        userId,
        userNick: fan.userNick || fan.userId,
        profileImage: normalizeProfileImage(fan.profileImage),
        watching: false,
        attended: false,
        message: null,
      });
    }
  }
  return [...fans.values()].slice(0, 20);
};

const errorMessage = (error: unknown) => {
  if (error instanceof BroadcastOfflineError)
    return '스트리머가 현재 방송 중이 아닙니다.';
  if (error instanceof RestrictedRoomError) {
    return '로그인이나 비밀번호가 필요한 방송입니다. 공개 방송만 지원합니다.';
  }
  if (error instanceof ChannelResolutionError)
    return '방송 접속 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  return error instanceof Error
    ? error.message
    : '연결에 실패했습니다. 다시 시도해 주세요.';
};

const handleAvatarError = (event: SyntheticEvent<HTMLImageElement>) => {
  if (event.currentTarget.src !== DEFAULT_AVATAR)
    event.currentTarget.src = DEFAULT_AVATAR;
};

const FanRow = ({ fan }: { fan: Fan }) => {
  const status = fan.attended
    ? STATUS.completed
    : fan.watching
      ? STATUS.watching
      : STATUS.absent;
  const StatusIcon = status.icon;
  return (
    <li
      className="grid min-h-16 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-slate-800/80 px-2 lg:min-h-[clamp(48px,calc((100svh_-_232px)/10),80px)]"
      data-user-id={fan.userId}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-label={status.label}
          className={`shrink-0 ${status.color}`}
          role="img"
        >
          <StatusIcon aria-hidden className="h-5 w-5 transition-colors" />
        </span>
        <img
          alt=""
          className="h-9 w-9 shrink-0 rounded-full bg-slate-800 object-cover ring-1 ring-slate-700"
          onError={handleAvatarError}
          src={fan.profileImage}
        />
        <span className="min-w-0 truncate text-sm font-medium text-slate-100 sm:text-base">
          {fan.userNick}
        </span>
      </div>
      <div className="relative min-w-0 self-stretch">
        {fan.message ? (
          <div
            aria-label={`${fan.userNick}의 채팅`}
            className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-xl bg-sky-100 px-3 py-2 text-sm leading-5 text-slate-950 shadow-lg shadow-black/20 motion-safe:animate-[topfan-message_160ms_ease-out]"
            key={fan.message.sequence}
            role="status"
            style={{ zIndex: fan.message.sequence }}
          >
            <span
              aria-hidden
              className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-sky-100"
            />
            <span className="relative whitespace-pre-wrap [overflow-wrap:anywhere]">
              {fan.message.text}
            </span>
          </div>
        ) : null}
      </div>
    </li>
  );
};

const RouteComponent = () => {
  const [userId, setUserId] = useQueryState('userId', searchParams.userId);
  const [input, setInput] = useState(userId ?? '');
  const [retry, setRetry] = useState(0);
  const [fans, setFans] = useState<Fan[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const inputId = useId();

  // biome-ignore lint/correctness/useExhaustiveDependencies: 같은 ID의 실패 후에도 retry 변경으로 새 세션을 시작한다.
  useEffect(() => {
    const streamerId = userId?.trim().toLowerCase();
    setFans([]);
    setNotice(null);
    setPhase('idle');
    if (!streamerId) return;
    setInput(userId ?? '');
    if (!isValidStreamerId(streamerId)) {
      setNotice(
        '스트리머 아이디만 입력해 주세요. 영문, 숫자, 밑줄을 사용할 수 있습니다.',
      );
      return;
    }

    let active = true;
    let chat: SoopChat | null = null;
    let sequence = 0;
    const controller = new AbortController();
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const presence = new Map<string, Set<string>>();
    const listeners: (() => void)[] = [];
    const cleanup = () => {
      active = false;
      controller.abort();
      for (const off of listeners) off();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      presence.clear();
      void chat?.disconnect();
      window.removeEventListener('pagehide', cleanup);
      if (cleanupRef.current === cleanup) cleanupRef.current = null;
    };
    cleanupRef.current = cleanup;
    window.addEventListener('pagehide', cleanup);

    const clearPresence = () => {
      presence.clear();
      setFans((current) =>
        current.map((fan) =>
          fan.watching ? { ...fan, watching: false } : fan,
        ),
      );
    };
    const connect = async () => {
      try {
        const channelUrl = getChannelUrl();
        setPhase('loading');
        const initialFans = await getTopFans(streamerId, controller.signal);
        if (!active) return;
        const fanIds = new Set(initialFans.map((fan) => fan.userId));
        setFans(initialFans);
        setPhase('connecting');
        chat = new SoopChat({
          streamerId,
          resolveChannel: async (id, { signal }) => {
            channelUrl.searchParams.set('streamerId', id);
            let response: Response;
            try {
              response = await fetch(channelUrl, {
                signal,
                cache: 'no-store',
                credentials: 'omit',
              });
            } catch (error) {
              if (signal.aborted) throw error;
              throw new Error(
                '외부 채팅 서버에 연결할 수 없습니다. 서버 주소와 CORS 설정을 확인해 주세요.',
              );
            }
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok)
              throw deserializeChannelResolutionError(payload, {
                streamerId: id,
              });
            if (!payload)
              throw new Error('방송 접속 정보의 응답이 올바르지 않습니다.');
            return payload as ChannelInfo;
          },
        });
        listeners.push(
          chat.on('chatUser', ({ data }) => {
            if (!active) return;
            const changed = new Set<string>();
            const rawIds =
              data.action === 'join'
                ? data.users.map((user) => user.userId)
                : [data.userId];
            for (const rawId of rawIds) {
              const id = normalizeUserId(rawId);
              if (!fanIds.has(id)) continue;
              const sessions = presence.get(id) ?? new Set<string>();
              if (data.action === 'join') sessions.add(rawId);
              else sessions.delete(rawId);
              if (sessions.size) presence.set(id, sessions);
              else presence.delete(id);
              changed.add(id);
            }
            if (changed.size) {
              setFans((current) =>
                current.map((fan) =>
                  changed.has(fan.userId)
                    ? { ...fan, watching: presence.has(fan.userId) }
                    : fan,
                ),
              );
            }
          }),
          chat.on('chatMessage', ({ data }) => {
            const id = normalizeUserId(data.senderId);
            if (!active || !fanIds.has(id)) return;
            const sessions = presence.get(id) ?? new Set<string>();
            sessions.add(data.senderId);
            presence.set(id, sessions);
            const message = { text: data.message, sequence: ++sequence };
            clearTimeout(timers.get(id));
            timers.set(
              id,
              setTimeout(() => {
                if (!active) return;
                setFans((current) =>
                  current.map((fan) =>
                    fan.userId === id &&
                    fan.message?.sequence === message.sequence
                      ? { ...fan, message: null }
                      : fan,
                  ),
                );
                timers.delete(id);
              }, BUBBLE_DURATION_MS),
            );
            setFans((current) =>
              current.map((fan) =>
                fan.userId === id
                  ? { ...fan, watching: true, attended: true, message }
                  : fan,
              ),
            );
          }),
          chat.on('stateChange', ({ current }) => {
            if (active && current === 'connected') {
              setPhase('connected');
              setNotice(null);
            }
          }),
          chat.on('reconnecting', () => {
            if (!active) return;
            clearPresence();
            setPhase('reconnecting');
          }),
          chat.on('ended', ({ reason }) => {
            if (!active) return;
            clearPresence();
            setPhase('ended');
            setNotice(
              reason === 'offline'
                ? '방송이 종료되었습니다. 출석 결과는 중지할 때까지 유지됩니다.'
                : '공개 방송에 접속할 수 없어 연결을 종료했습니다. 출석 결과는 유지됩니다.',
            );
          }),
          chat.on('error', (error) => {
            if (active) setNotice(errorMessage(error));
          }),
        );
        await chat.connect();
      } catch (error) {
        if (!active) return;
        cleanup();
        setFans([]);
        setPhase('idle');
        setNotice(errorMessage(error));
      }
    };
    void connect();
    return cleanup;
  }, [userId, retry]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) =>
    setInput(event.target.value);
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = input.trim().toLowerCase();
    if (!isValidStreamerId(id)) {
      setNotice(
        '스트리머 아이디만 입력해 주세요. 영문, 숫자, 밑줄을 사용할 수 있습니다.',
      );
      return;
    }
    setInput(id);
    if (userId === id) setRetry((value) => value + 1);
    else void setUserId(id);
  };
  const handleStop = () => {
    cleanupRef.current?.();
    setFans([]);
    setPhase('idle');
    setNotice(null);
    void setUserId(null);
  };
  const showingList = !['idle', 'loading'].includes(phase);
  const pending = phase === 'loading' || phase === 'connecting';
  const completed = fans.filter((fan) => fan.attended).length;
  const split = Math.ceil(fans.length / 2);

  return (
    <main className="min-h-svh bg-slate-950 text-slate-100">
      <style>
        {
          '@keyframes topfan-message { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }'
        }
      </style>
      {!showingList ? (
        <section className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-6 py-12">
          <MessageCircle aria-hidden className="mb-5 h-9 w-9 text-sky-400" />
          <h1 className="text-3xl font-bold tracking-tight">열혈팬 출석체크</h1>
          <form className="mt-8" onSubmit={handleSubmit}>
            <label
              className="mb-2 block text-sm font-medium text-slate-300"
              htmlFor={inputId}
            >
              스트리머 ID
            </label>
            <input
              autoCapitalize="none"
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-base outline-none transition-colors placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15 disabled:opacity-60"
              disabled={pending}
              id={inputId}
              onChange={handleInputChange}
              placeholder="SOOP 스트리머 아이디"
              spellCheck={false}
              value={input}
            />
            <button
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-400 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400 disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? (
                <LoaderCircle
                  aria-hidden
                  className="h-4 w-4 motion-safe:animate-spin"
                />
              ) : (
                <Play aria-hidden className="h-4 w-4" />
              )}
              {pending ? PHASE_LABEL[phase] : '시작'}
            </button>
          </form>
          {pending ? (
            <button
              className="mt-3 self-center rounded px-4 py-2 text-sm text-slate-400 hover:text-slate-100"
              onClick={handleStop}
              type="button"
            >
              취소
            </button>
          ) : null}
          {notice ? (
            <p
              className="mt-4 flex items-start gap-2 text-sm leading-6 text-rose-300"
              role="alert"
            >
              <AlertCircle aria-hidden className="mt-1 h-4 w-4 shrink-0" />
              {notice}
            </p>
          ) : null}
          <p className="mt-6 text-xs leading-5 text-slate-500">
            공개 방송에 연결하며, 채팅을 입력한 열혈팬의 출석이 완료됩니다.
          </p>
        </section>
      ) : (
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6">
          <header className="flex items-center justify-between gap-4 border-b border-slate-800 py-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                열혈팬 출석체크
              </h1>
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                <span className="truncate">{userId?.trim()}</span>
                <span aria-hidden>·</span>
                <span
                  className="flex shrink-0 items-center gap-1.5"
                  role="status"
                >
                  {phase === 'connecting' || phase === 'reconnecting' ? (
                    <LoaderCircle
                      aria-hidden
                      className="h-3 w-3 motion-safe:animate-spin"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${phase === 'connected' ? 'bg-sky-400' : 'bg-slate-500'}`}
                    />
                  )}
                  {PHASE_LABEL[phase]}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <p aria-live="polite" className="text-sm text-slate-400">
                <span className="hidden sm:inline">출석 </span>
                <strong className="text-lg font-bold tabular-nums text-emerald-400">
                  {completed}
                </strong>
                <span className="mx-1.5 text-slate-600">/</span>
                {fans.length}
              </p>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-medium transition-colors hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
                onClick={handleStop}
                type="button"
              >
                <Square aria-hidden className="h-3.5 w-3.5" />
                {pending ? '취소' : '중지'}
              </button>
            </div>
          </header>
          {notice ? (
            <p className="mt-3 text-sm text-amber-200" role="status">
              {notice}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-3 text-xs text-slate-400">
            {Object.values(STATUS).map((status) => (
              <span
                className="inline-flex items-center gap-1.5"
                key={status.label}
              >
                <status.icon
                  aria-hidden
                  className={`h-3.5 w-3.5 ${status.color}`}
                />
                {status.label}
              </span>
            ))}
          </div>
          {fans.length ? (
            <div className="isolate grid gap-x-8 pb-4 lg:grid-cols-2">
              {[fans.slice(0, split), fans.slice(split)].map(
                (column, index) => (
                  <ol
                    aria-label={`열혈팬 ${index + 1}열`}
                    className="space-y-1.5"
                    key={index === 0 ? 'first' : 'second'}
                  >
                    {column.map((fan) => (
                      <FanRow fan={fan} key={fan.userId} />
                    ))}
                  </ol>
                ),
              )}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">
              등록된 열혈팬이 없습니다.
            </p>
          )}
        </div>
      )}
    </main>
  );
};

export const Route = createFileRoute('/tools/topfanattendance')({
  component: RouteComponent,
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
