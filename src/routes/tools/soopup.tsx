/**
 * SOOPUP page context (keep this comment updated on every edit):
 * - Route: /tools/soopup
 * - Purpose: show SOOP post comments ranked by like count in near real-time.
 * - Data flow:
 *   1) Validate search params at route level via createStandardSchemaV1(searchParams)
 *      and read querystring userId/postId/cutline (nuqs).
 *   2) If query exists, fetch all paginated comments (parallel) via getPostComment.
 *   3) Mitigate timing issues by re-fetching page 1, checking latest lastPage,
 *      fetching newly appeared pages, and deduplicating by pCommentNo.
 *   4) Sort by likeCnt desc, then regDate asc, then pCommentNo asc.
 * - UI flow:
 *   - If no querystring: show URL input screen only.
 *   - If querystring exists: show ranking list only.
 *   - Optional highlight userId is stored in URL hash (#userId) and is used
 *     to center-scroll the matching row.
 *   - Optional cutline (>=1) draws a separator at the pass/fail rank boundary.
 *   - Floating settings button (top-right) clears querystring and returns to input.
 * - Current UX rules:
 *   - Header info is 2 lines:
 *     line1: auto-refresh + "게시물 보기"
 *     line2: comment aggregate + page count
 *   - Rank emphasis: 1st/2nd/3rd use gold/silver/bronze badges.
 *   - Tied scores are visually grouped with tight spacing.
 *   - Cutline rank badge is highlighted in red.
 *   - Like count changes animate smoothly (count up/down).
 *   - Rank position changes animate smoothly (FLIP-style move).
 *   - Highlight scroll follows target during FLIP to keep center alignment.
 *   - On scroll/resize, FLIP baseline rects are refreshed to avoid full-list drift.
 *   - DEV only: bottom-left floating button simulates rank changes.
 *   - Cutline input uses text+numeric keyboard so it can be fully cleared.
 * - Refresh interval: 10s (react-query refetchInterval/staleTime).
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Fragment,
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
  userId: string;
  userNick: string;
  likeCnt: number;
  regDate: string;
  profileImage: string;
};

type SoopupQueryData = {
  comments: RankedComment[];
  count: number;
  sourceLastPage: number;
};

const REFRESH_INTERVAL_MS = 10_000;
const FLIP_DURATION_MS = 700;
const DEFAULT_PROFILE_IMAGE =
  'https://profile.img.sooplive.co.kr/LOGO/default_avatar.jpg';
const searchParams = {
  userId: parseAsString,
  postId: parseAsInteger,
  cutline: parseAsInteger,
};

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

const parseHighlightFromHash = (hash: string) => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) {
    return '';
  }

  return decodeURIComponent(raw).trim();
};

const buildHighlightHash = (userId: string) =>
  `#${encodeURIComponent(userId.trim())}`;

const parseCutlineInput = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (!Number.isSafeInteger(numeric) || numeric < 1) {
    return null;
  }

  return numeric;
};

const compareRankedComments = (a: RankedComment, b: RankedComment) => {
  if (b.likeCnt !== a.likeCnt) {
    return b.likeCnt - a.likeCnt;
  }
  if (a.regDate !== b.regDate) {
    return a.regDate.localeCompare(b.regDate);
  }
  return a.key - b.key;
};

const normalizeProfileImage = (profileImage: string) => {
  if (!profileImage) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (profileImage.startsWith('//')) {
    return `https:${profileImage}`;
  }

  return profileImage;
};

const fetchAllComments = async (
  target: SoopTarget,
): Promise<SoopupQueryData> => {
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
          userId: comment.userId,
          userNick: comment.userNick,
          likeCnt: comment.likeCnt,
          regDate: comment.regDate,
          profileImage: normalizeProfileImage(comment.profileImage),
        });
      }
    }
  }

  const comments = Array.from(uniqueMap.values()).toSorted(
    compareRankedComments,
  );

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
  const queryClient = useQueryClient();
  const inputId = useId();
  const highlightInputId = useId();
  const cutlineInputId = `${highlightInputId}-cutline`;

  const itemRefs = useRef(new Map<number, HTMLLIElement>());
  const prevRectsRef = useRef(new Map<number, DOMRect>());
  const prevHighlightRef = useRef<{
    key: number | null;
    offsetTop: number | null;
  }>({ key: null, offsetTop: null });
  const highlightFollowRafRef = useRef<number | null>(null);

  const [inputUrl, setInputUrl] = useState('');
  const [highlightInput, setHighlightInput] = useState('');
  const [cutlineInput, setCutlineInput] = useState('');
  const [highlightUserId, setHighlightUserId] = useState('');

  const [queryUserId, setQueryUserId] = useQueryState(
    'userId',
    searchParams.userId,
  );
  const [queryPostId, setQueryPostId] = useQueryState(
    'postId',
    searchParams.postId,
  );
  const [queryCutline, setQueryCutline] = useQueryState(
    'cutline',
    searchParams.cutline,
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
  const parsedCutlineInput = useMemo(
    () => parseCutlineInput(cutlineInput),
    [cutlineInput],
  );
  const effectiveCutline =
    queryCutline && queryCutline >= 1 ? queryCutline : undefined;

  useEffect(() => {
    if (submittedUrl && !inputUrl) {
      setInputUrl(submittedUrl);
    }
  }, [inputUrl, submittedUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncFromHash = () => {
      const parsed = parseHighlightFromHash(window.location.hash);
      setHighlightUserId(parsed);
      if (!parsedTarget) {
        setHighlightInput(parsed);
      }
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [parsedTarget]);

  const query = useQuery({
    queryKey: ['soop-up-comments', parsedTarget?.userId, parsedTarget?.postId],
    queryFn: () => fetchAllComments(parsedTarget as SoopTarget),
    enabled: Boolean(parsedTarget),
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: REFRESH_INTERVAL_MS,
    retry: 1,
  });

  const displayedRanks = useMemo(() => {
    const comments = query.data?.comments;
    if (!comments?.length) {
      return [];
    }

    const ranks = new Array<number>(comments.length);
    let currentRank = 1;
    ranks[0] = currentRank;

    for (let i = 1; i < comments.length; i += 1) {
      if (comments[i].likeCnt !== comments[i - 1].likeCnt) {
        currentRank = i + 1;
      }
      ranks[i] = currentRank;
    }

    return ranks;
  }, [query.data?.comments]);
  const cutoffRank = useMemo(() => {
    if (!effectiveCutline || displayedRanks.length === 0) {
      return undefined;
    }

    let lastPassingRank: number | undefined;
    for (const rank of displayedRanks) {
      if (rank <= effectiveCutline) {
        lastPassingRank = rank;
      } else {
        break;
      }
    }

    return lastPassingRank;
  }, [displayedRanks, effectiveCutline]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let frameId: number | null = null;
    const snapshotRects = () => {
      frameId = null;
      if (!query.data?.comments?.length) {
        return;
      }

      const nextRects = new Map<number, DOMRect>();
      for (const comment of query.data.comments) {
        const element = itemRefs.current.get(comment.key);
        if (element) {
          nextRects.set(comment.key, element.getBoundingClientRect());
        }
      }

      if (nextRects.size > 0) {
        prevRectsRef.current = nextRects;
      }
    };

    const scheduleSnapshot = () => {
      if (frameId !== null) {
        return;
      }
      frameId = requestAnimationFrame(snapshotRects);
    };

    window.addEventListener('scroll', scheduleSnapshot, { passive: true });
    window.addEventListener('resize', scheduleSnapshot);

    return () => {
      window.removeEventListener('scroll', scheduleSnapshot);
      window.removeEventListener('resize', scheduleSnapshot);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [query.data?.comments]);

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
        element.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        element.style.transform = 'translateY(0)';
      });
    }

    prevRectsRef.current = nextRects;
  }, [query.data?.comments]);

  useEffect(() => {
    if (highlightFollowRafRef.current !== null) {
      cancelAnimationFrame(highlightFollowRafRef.current);
      highlightFollowRafRef.current = null;
    }

    const highlight = highlightUserId.trim().toLowerCase();
    if (!highlight) {
      prevHighlightRef.current = { key: null, offsetTop: null };
      return;
    }

    const comments = query.data?.comments;
    if (!comments?.length) {
      return;
    }

    const target = comments.find(
      (comment) => comment.userId.toLowerCase() === highlight,
    );
    if (!target) {
      prevHighlightRef.current = { key: null, offsetTop: null };
      return;
    }

    const element = itemRefs.current.get(target.key);
    if (!element) {
      return;
    }

    const currentOffsetTop = element.offsetTop;
    const prev = prevHighlightRef.current;
    prevHighlightRef.current = { key: target.key, offsetTop: currentOffsetTop };

    const isSameTarget = prev.key === target.key;
    const hasMoved =
      prev.offsetTop === null ||
      Math.abs(currentOffsetTop - prev.offsetTop) > 1;

    const centerScroll = () => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    requestAnimationFrame(centerScroll);
    const followStart = performance.now();
    const follow = (now: number) => {
      const elapsed = now - followStart;
      const followDuration =
        isSameTarget && !hasMoved ? 420 : FLIP_DURATION_MS + 80;

      if (elapsed > followDuration) {
        highlightFollowRafRef.current = null;
        return;
      }

      const rect = element.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const targetCenter = rect.top + rect.height / 2;
      const delta = targetCenter - viewportCenter;

      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta * 0.22, behavior: 'auto' });
      }

      highlightFollowRafRef.current = requestAnimationFrame(follow);
    };

    highlightFollowRafRef.current = requestAnimationFrame(follow);

    return () => {
      if (highlightFollowRafRef.current !== null) {
        cancelAnimationFrame(highlightFollowRafRef.current);
        highlightFollowRafRef.current = null;
      }
    };
  }, [highlightUserId, query.data?.comments]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = parseSoopPostUrl(inputUrl.trim());
    if (!parsed) {
      return;
    }

    await Promise.all([
      setQueryUserId(parsed.userId),
      setQueryPostId(parsed.postId),
      setQueryCutline(parsedCutlineInput ?? null),
    ]);

    if (typeof window !== 'undefined') {
      const nextHighlight = highlightInput.trim();
      if (nextHighlight) {
        window.location.hash = buildHighlightHash(nextHighlight);
      } else {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`,
        );
      }
      setHighlightUserId(nextHighlight);
    }

    setInputUrl(buildSoopPostUrl(parsed));
  };

  const handleOpenSettings = async () => {
    if (submittedUrl) {
      setInputUrl(submittedUrl);
    }
    setCutlineInput(effectiveCutline ? String(effectiveCutline) : '');
    await Promise.all([
      setQueryUserId(null),
      setQueryPostId(null),
      setQueryCutline(null),
    ]);
  };

  const handleSimulateRankChange = () => {
    if (!parsedTarget) {
      return;
    }

    queryClient.setQueryData(
      ['soop-up-comments', parsedTarget.userId, parsedTarget.postId],
      (oldData: SoopupQueryData | undefined) => {
        if (!oldData) {
          return oldData;
        }

        const randomized = oldData.comments.map((comment) => {
          const delta = Math.floor(Math.random() * 121) - 60;
          return { ...comment, likeCnt: Math.max(0, comment.likeCnt + delta) };
        });

        randomized.sort(compareRankedComments);
        return { ...oldData, comments: randomized };
      },
    );
  };

  const hasValidInput = Boolean(parsedInputTarget);
  const hasValidCutline = parsedCutlineInput !== null;

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

              <label className="sr-only" htmlFor={cutlineInputId}>
                커트라인 (선택)
              </label>
              <div className="relative sm:w-44">
                <input
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                  id={cutlineInputId}
                  inputMode="numeric"
                  onChange={(event) => setCutlineInput(event.target.value)}
                  pattern="[0-9]*"
                  placeholder="커트라인 (선택)"
                  type="text"
                  value={cutlineInput}
                />
              </div>

              <label className="sr-only" htmlFor={highlightInputId}>
                하이라이트 아이디 (선택)
              </label>
              <div className="relative sm:w-56">
                <input
                  className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
                  id={highlightInputId}
                  onChange={(event) => setHighlightInput(event.target.value)}
                  placeholder="하이라이트 ID (선택)"
                  type="text"
                  value={highlightInput}
                />
              </div>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                disabled={!hasValidInput || !hasValidCutline}
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
            {!hasValidCutline && cutlineInput.trim().length > 0 ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-rose-300 sm:text-sm">
                <AlertCircle className="h-4 w-4" />
                커트라인은 1 이상의 정수만 입력할 수 있습니다.
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
                <ul className="flex flex-col [overflow-anchor:none]">
                  {query.data.comments.map((comment, index) => {
                    const rank = displayedRanks[index] ?? index + 1;
                    const cutline = effectiveCutline;
                    const prevLikeCnt =
                      index > 0
                        ? query.data.comments[index - 1].likeCnt
                        : undefined;
                    const nextLikeCnt =
                      index < query.data.comments.length - 1
                        ? query.data.comments[index + 1].likeCnt
                        : undefined;
                    const prevRank =
                      index > 0
                        ? (displayedRanks[index - 1] ?? index)
                        : undefined;
                    const showCutline =
                      cutline !== undefined &&
                      prevRank !== undefined &&
                      prevRank <= cutline &&
                      rank > cutline;
                    const isTieWithPrev = prevLikeCnt === comment.likeCnt;
                    const isTieWithNext = nextLikeCnt === comment.likeCnt;

                    return (
                      <Fragment key={comment.key}>
                        {showCutline ? (
                          <li
                            aria-hidden
                            className="my-1 flex items-center gap-2"
                          >
                            <div className="h-px flex-1 border-t border-dashed border-slate-600" />
                            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                              탈락
                            </span>
                            <div className="h-px flex-1 border-t border-dashed border-slate-600" />
                          </li>
                        ) : null}
                        <li
                          className={`flex items-center gap-2 border bg-slate-950/80 p-2.5 sm:gap-3 sm:p-3 ${
                            showCutline ||
                            index === 0 ||
                            prevLikeCnt === comment.likeCnt
                              ? 'mt-0'
                              : 'mt-2'
                          } ${
                            isTieWithPrev
                              ? '-mt-px rounded-t-none'
                              : 'rounded-t-xl'
                          } ${
                            isTieWithNext ? 'rounded-b-none' : 'rounded-b-xl'
                          } ${isTieWithPrev ? 'border-t-0' : ''} ${
                            isTieWithNext ? 'border-b-0' : ''
                          } ${
                            highlightUserId.trim().toLowerCase() ===
                            comment.userId.toLowerCase()
                              ? 'border-sky-500/80 ring-1 ring-sky-500/40'
                              : 'border-slate-800'
                          }`}
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
                                cutoffRank !== undefined && rank === cutoffRank
                                  ? 'bg-rose-600 text-rose-50 ring-1 ring-rose-400/70'
                                  : rank === 1
                                    ? 'bg-yellow-400 text-slate-950'
                                    : rank === 2
                                      ? 'bg-slate-300 text-slate-950'
                                      : rank === 3
                                        ? 'bg-amber-700 text-amber-100'
                                        : 'bg-slate-800 text-slate-100'
                              }`}
                            >
                              #{rank}
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
                      </Fragment>
                    );
                  })}
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
          {import.meta.env.DEV ? (
            <button
              className="fixed bottom-4 left-4 z-20 inline-flex h-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/90 px-4 text-xs font-semibold text-slate-100 shadow-lg shadow-slate-950/40 transition hover:border-sky-500 hover:text-sky-300"
              onClick={handleSimulateRankChange}
              type="button"
            >
              순위 변동 테스트
            </button>
          ) : null}
        </>
      )}
    </main>
  );
};

export const Route = createFileRoute('/tools/soopup')({
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  component: RouteComponent,
});
