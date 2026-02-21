/**
 * SOOPUP page context (keep this comment updated on every edit):
 * - Route: /tools/soopup
 * - Purpose: show SOOP post comments ranked by like count in near real-time.
 * - Data flow:
 *   1) Validate search params at route level via createStandardSchemaV1(searchParams)
 *      and read querystring userId/postId (nuqs).
 *   2) If query exists, fetch all paginated comments (parallel) via getPostComment.
 *   3) Mitigate timing issues by re-fetching page 1, checking latest lastPage,
 *      fetching newly appeared pages, and deduplicating by pCommentNo.
 *   4) Sort by likeCnt desc, then pCommentNo asc.
 * - UI flow:
 *   - If no querystring: show URL input screen only.
 *   - If querystring exists: show ranking list only.
 *   - Floating settings button (top-right) clears querystring and returns to input.
 * - Current UX rules:
 *   - Header info is 2 lines:
 *     line1: auto-refresh + "게시물 보기"
 *     line2: comment aggregate + page count
 *   - Rank emphasis: 1st/2nd/3rd use gold/silver/bronze badges.
 *   - Like count changes animate smoothly (count up/down).
 *   - Rank position changes animate smoothly (FLIP-style move).
 * - Refresh interval: 10s (react-query refetchInterval/staleTime).
 */

import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import {
  AlertCircle,
  Cog,
  ExternalLink,
  Link as LinkIcon,
  MessageCircle,
  RefreshCw,
  Search,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import {
  createStandardSchemaV1,
  parseAsInteger,
  parseAsString,
  useQueryState,
} from 'nuqs';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import getPostComment from '@/api/getPostComment';

type SoopTarget = { userId: string; postId: number };

type RankedComment = {
  key: number;
  userNick: string;
  likeCnt: number;
  profileImage: string;
};

const REFRESH_INTERVAL_MS = 10_000;
const DEFAULT_PROFILE_IMAGE =
  'https://profile.img.sooplive.co.kr/LOGO/default_avatar.jpg';
const searchParams = { userId: parseAsString, postId: parseAsInteger };

const parseSoopPostUrl = (raw: string): SoopTarget | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.hostname !== 'www.sooplive.co.kr') {
    return null;
  }

  const match = url.pathname.match(/^\/station\/([^/]+)\/post\/(\d+)\/?$/i);
  if (!match) {
    return null;
  }

  const postId = Number(match[2]);
  if (!Number.isSafeInteger(postId)) {
    return null;
  }

  return { userId: match[1], postId };
};

const buildSoopPostUrl = (target: SoopTarget) =>
  `https://www.sooplive.co.kr/station/${target.userId}/post/${target.postId}`;

const normalizeProfileImage = (profileImage: string) => {
  if (!profileImage) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (profileImage.startsWith('//')) {
    return `https:${profileImage}`;
  }

  return profileImage;
};

const fetchAllComments = async (target: SoopTarget) => {
  const firstPage = await getPostComment(target.userId, target.postId, {
    page: 1,
  });
  const initialLastPage = Math.max(firstPage.meta.lastPage, 1);

  const restPages = Array.from(
    { length: initialLastPage - 1 },
    (_, index) => index + 2,
  );
  const restResponses = await Promise.all(
    restPages.map((page) =>
      getPostComment(target.userId, target.postId, { page }),
    ),
  );

  const latestFirstPage = await getPostComment(target.userId, target.postId, {
    page: 1,
  });
  const latestLastPage = Math.max(latestFirstPage.meta.lastPage, 1);

  const extraPages =
    latestLastPage > initialLastPage
      ? Array.from(
          { length: latestLastPage - initialLastPage },
          (_, index) => initialLastPage + index + 1,
        )
      : [];

  const extraResponses = await Promise.all(
    extraPages.map((page) =>
      getPostComment(target.userId, target.postId, { page }),
    ),
  );

  const uniqueMap = new Map<number, RankedComment>();
  const pages = [
    firstPage,
    ...restResponses,
    latestFirstPage,
    ...extraResponses,
  ];

  for (const page of pages) {
    for (const comment of page.data) {
      if (!comment.pCommentNo) {
        continue;
      }

      const existing = uniqueMap.get(comment.pCommentNo);
      if (!existing || existing.likeCnt !== comment.likeCnt) {
        uniqueMap.set(comment.pCommentNo, {
          key: comment.pCommentNo,
          userNick: comment.userNick,
          likeCnt: comment.likeCnt,
          profileImage: normalizeProfileImage(comment.profileImage),
        });
      }
    }
  }

  const comments = Array.from(uniqueMap.values()).toSorted((a, b) => {
    if (b.likeCnt !== a.likeCnt) {
      return b.likeCnt - a.likeCnt;
    }

    return a.key - b.key;
  });

  return { comments, count: comments.length, sourceLastPage: latestLastPage };
};

const useAnimatedNumber = (value: number, durationMs = 800) => {
  const [display, setDisplay] = useState(value);
  const frameIdRef = useRef<number | null>(null);
  const displayRef = useRef(value);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (frameIdRef.current !== null) {
      cancelAnimationFrame(frameIdRef.current);
    }

    const from = displayRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const delta = to - from;

    const animate = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(from + delta * eased);
      setDisplay(nextValue);

      if (progress < 1) {
        frameIdRef.current = requestAnimationFrame(animate);
      } else {
        frameIdRef.current = null;
        setDisplay(to);
      }
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [durationMs, value]);

  return display;
};

const AnimatedLikeCount = ({ value }: { value: number }) => {
  const animatedValue = useAnimatedNumber(value);
  return <>{animatedValue.toLocaleString()}</>;
};

const RouteComponent = () => {
  const inputId = useId();
  const itemRefs = useRef(new Map<number, HTMLLIElement>());
  const prevRectsRef = useRef(new Map<number, DOMRect>());
  const [inputUrl, setInputUrl] = useState('');
  const [queryUserId, setQueryUserId] = useQueryState(
    'userId',
    searchParams.userId,
  );
  const [queryPostId, setQueryPostId] = useQueryState(
    'postId',
    searchParams.postId,
  );

  const parsedTarget = useMemo(() => {
    if (!queryUserId || !queryPostId) {
      return null;
    }

    if (!Number.isSafeInteger(queryPostId)) {
      return null;
    }

    return { userId: queryUserId, postId: queryPostId };
  }, [queryPostId, queryUserId]);
  const parsedInputTarget = useMemo(
    () => parseSoopPostUrl(inputUrl),
    [inputUrl],
  );
  const submittedUrl = useMemo(
    () => (parsedTarget ? buildSoopPostUrl(parsedTarget) : ''),
    [parsedTarget],
  );

  useEffect(() => {
    if (submittedUrl && !inputUrl) {
      setInputUrl(submittedUrl);
    }
  }, [inputUrl, submittedUrl]);

  const query = useQuery({
    queryKey: ['soop-up-comments', parsedTarget?.userId, parsedTarget?.postId],
    queryFn: () => fetchAllComments(parsedTarget as SoopTarget),
    enabled: Boolean(parsedTarget),
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
    retry: 1,
  });
  useLayoutEffect(() => {
    const comments = query.data?.comments;
    if (!comments?.length) {
      prevRectsRef.current.clear();
      return;
    }

    const nextRects = new Map<number, DOMRect>();
    for (const comment of comments) {
      const element = itemRefs.current.get(comment.key);
      if (element) {
        nextRects.set(comment.key, element.getBoundingClientRect());
      }
    }

    for (const comment of comments) {
      const element = itemRefs.current.get(comment.key);
      const prevRect = prevRectsRef.current.get(comment.key);
      const nextRect = nextRects.get(comment.key);
      if (!element || !prevRect || !nextRect) {
        continue;
      }

      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaY) < 1) {
        continue;
      }

      element.style.transition = 'none';
      element.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        element.style.transition =
          'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
        element.style.transform = 'translateY(0)';
      });
    }

    prevRectsRef.current = nextRects;
  }, [query.data?.comments]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = inputUrl.trim();
    const parsed = parseSoopPostUrl(trimmed);
    if (!parsed) {
      return;
    }

    await Promise.all([
      setQueryUserId(parsed.userId),
      setQueryPostId(parsed.postId),
    ]);
    setInputUrl(buildSoopPostUrl(parsed));
  };

  const handleOpenSettings = async () => {
    if (submittedUrl) {
      setInputUrl(submittedUrl);
    }

    await Promise.all([setQueryUserId(null), setQueryPostId(null)]);
  };

  const hasValidInput = Boolean(parsedInputTarget);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {!parsedTarget ? (
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center p-3 sm:p-4">
          <section className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
            <div className="mb-3 flex items-center gap-2 text-slate-200">
              <MessageCircle className="h-4 w-4 text-sky-400" />
              <h1 className="text-base font-semibold sm:text-lg">
                SOOP 댓글 실시간 업순
              </h1>
            </div>

            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={handleSubmit}
            >
              <label className="sr-only" htmlFor={inputId}>
                SOOP 게시글 URL
              </label>
              <div className="relative flex-1">
                <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                  id={inputId}
                  onChange={(event) => setInputUrl(event.target.value)}
                  placeholder="https://www.sooplive.co.kr/station/*****/post/*****"
                  type="url"
                  value={inputUrl}
                />
              </div>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={!hasValidInput}
                type="submit"
              >
                <Search className="h-4 w-4" />
                불러오기
              </button>
            </form>

            {!hasValidInput && inputUrl.trim().length > 0 ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-rose-300 sm:text-sm">
                <AlertCircle className="h-4 w-4" />
                URL 형식이 올바르지 않습니다.
              </p>
            ) : null}
          </section>
        </div>
      ) : (
        <>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-xl shadow-slate-950/30 backdrop-blur sm:p-4">
              <div className="mb-3 flex flex-col gap-2 text-xs text-slate-400 sm:text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`}
                    />
                    10초마다 자동 갱신
                  </span>
                  <a
                    className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                    href={submittedUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    게시물 보기
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {query.data ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200">
                      <Trophy className="h-3.5 w-3.5" />
                      {query.data.count.toLocaleString()}개 댓글 집계
                    </span>
                    <span>페이지 수: {query.data.sourceLastPage}</span>
                  </div>
                ) : null}
              </div>

              {query.isPending ? (
                <p className="py-12 text-center text-sm text-slate-300">
                  댓글을 불러오는 중...
                </p>
              ) : null}

              {query.isError ? (
                <div className="rounded-xl border border-rose-900/50 bg-rose-950/40 p-3 text-sm text-rose-200">
                  댓글 데이터를 불러오지 못했습니다. URL 또는 네트워크 상태를
                  확인해 주세요.
                </div>
              ) : null}

              {query.data ? (
                <ul className="flex flex-col gap-2">
                  {query.data.comments.map((comment, index) => (
                    <li
                      className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 sm:gap-3 sm:p-3"
                      key={comment.key}
                      ref={(element) => {
                        if (element) {
                          itemRefs.current.set(comment.key, element);
                        } else {
                          itemRefs.current.delete(comment.key);
                        }
                      }}
                    >
                      <div className="flex w-11 shrink-0 justify-center sm:w-12">
                        <span
                          className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 text-xs font-extrabold leading-none sm:min-w-9 sm:text-sm ${
                            index === 0
                              ? 'bg-yellow-400 text-slate-950'
                              : index === 1
                                ? 'bg-slate-300 text-slate-950'
                                : index === 2
                                  ? 'bg-amber-700 text-amber-100'
                                  : 'bg-slate-800 text-slate-100'
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </div>
                      <img
                        alt={comment.userNick}
                        className="h-9 w-9 shrink-0 rounded-full border border-slate-700 object-cover sm:h-10 sm:w-10"
                        loading="lazy"
                        src={comment.profileImage}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100 sm:text-base">
                          {comment.userNick}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-sky-300 sm:text-sm">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <AnimatedLikeCount value={comment.likeCnt} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          <button
            aria-label="설정 열기"
            className="fixed right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 text-slate-100 shadow-lg shadow-slate-950/40 transition hover:border-sky-500 hover:text-sky-300"
            onClick={handleOpenSettings}
            type="button"
          >
            <Cog className="h-5 w-5" />
          </button>
        </>
      )}
    </main>
  );
};

export const Route = createFileRoute('/tools/soopup')({
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  component: RouteComponent,
});
