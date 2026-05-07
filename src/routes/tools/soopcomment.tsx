/**
 * SOOP Comment Link Generator context (update this block whenever behavior changes):
 * - Single-screen tool with submit-based search.
 * - URL state policy (nuqs):
 *   - querystring keeps `url` and `targets` for shareable/reload-safe state.
 *   - when querystring has valid values, the page auto-runs the search.
 *   - submitted targets are normalized into comma-separated lowercase terms (trim + dedupe).
 * - Input contract:
 *   - post URL display format: https://www.sooplive.com/station/{userId}/post/{postId}
 *   - accepted input hosts: sooplive.com / sooplive.co.kr (with or without www)
 *   - targets: comma-separated search terms
 *   - default targets input: MEMBERS[].id joined by comma when query `targets` is empty
 * - Match policy:
 *   - userId: exact match
 *   - userNick: partial match
 * - Fetch policy:
 *   - request page 1, then request all remaining pages in parallel
 *   - SOOP comment API may return either old meta (lastPage) or new meta (totalPages)
 *   - derive page count from lastPage/totalPages with a minimum fallback of 1
 *   - merge pages and dedupe by pCommentNo
 * - Result policy:
 *   - sort by regDate desc, tie-break by pCommentNo desc
 *   - profile image normalizes protocol-relative URLs and falls back to default avatar
 * - Copy button uses `copyText` utility and writes display-domain comment URL:
 *   https://www.sooplive.com/station/{userId}/post/{postId}#comment_noti{pCommentNo}
 */

import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Copy, Link as LinkIcon, Search } from 'lucide-react';
import { createStandardSchemaV1, parseAsString, useQueryState } from 'nuqs';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import getPostComment, {
  type GetPostCommentResponse,
} from '@/api/getPostComment';
import { MEMBERS } from '@/data/constants';
import copyText from '@/utils/copyText';

type SoopTarget = { userId: string; postId: number };

type FilteredComment = {
  pCommentNo: number;
  userId: string;
  userNick: string;
  profileImage: string;
  regDate: string;
  comment: string;
};

const DEFAULT_TARGETS = MEMBERS.map((member) => member.id).join(',');

const searchParams = {
  url: parseAsString.withDefault(''),
  targets: parseAsString.withDefault(DEFAULT_TARGETS),
};

const parseSoopPostUrl = (raw: string): SoopTarget | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname !== 'www.sooplive.com' &&
    hostname !== 'sooplive.com' &&
    hostname !== 'www.sooplive.co.kr' &&
    hostname !== 'sooplive.co.kr'
  ) {
    return null;
  }

  const match = url.pathname.match(/^\/station\/([^/]+)\/post\/(\d+)\/?$/i);
  if (!match) return null;

  const postId = Number(match[2]);
  if (!Number.isSafeInteger(postId)) return null;

  return { userId: match[1], postId };
};

const buildPostUrl = (target: SoopTarget) =>
  `https://www.sooplive.com/station/${target.userId}/post/${target.postId}`;

const buildCommentLink = (target: SoopTarget, pCommentNo: number) =>
  `${buildPostUrl(target)}#comment_noti${pCommentNo}`;

const parseTargets = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

const normalizeProfileImage = (profileImage: string) => {
  if (!profileImage)
    return 'https://profile.img.sooplive.com/LOGO/default_avatar.jpg';
  if (profileImage.startsWith('//')) return `https:${profileImage}`;
  return profileImage;
};

const compareByRecent = (a: FilteredComment, b: FilteredComment) => {
  const timeDiff = b.regDate.localeCompare(a.regDate);
  if (timeDiff !== 0) return timeDiff;
  return b.pCommentNo - a.pCommentNo;
};

const getCommentLastPage = (meta: GetPostCommentResponse['meta']) => {
  const lastPage = 'lastPage' in meta ? meta.lastPage : meta.totalPages;
  return Number.isSafeInteger(lastPage) && lastPage > 0 ? lastPage : 1;
};

const fetchMatchedComments = async (target: SoopTarget, rawTargets: string) => {
  const targetTerms = parseTargets(rawTargets);
  if (!targetTerms.length) return [];

  const firstPage = await getPostComment(target.userId, target.postId, {
    page: 1,
  });
  const lastPage = getCommentLastPage(firstPage.meta);

  const restPages = Array.from(
    { length: lastPage - 1 },
    (_, index) => index + 2,
  );
  const restResponses = await Promise.all(
    restPages.map((page) =>
      getPostComment(target.userId, target.postId, { page }),
    ),
  );

  const deduped = new Map<number, FilteredComment>();
  for (const page of [firstPage, ...restResponses]) {
    for (const comment of page.data) {
      if (!comment.pCommentNo) continue;

      const lowerUserId = comment.userId.toLowerCase();
      const lowerUserNick = comment.userNick.toLowerCase();
      const byId = targetTerms.some((term) => term === lowerUserId);
      const byNick = targetTerms.some((term) => lowerUserNick.includes(term));
      if (!byId && !byNick) continue;

      deduped.set(comment.pCommentNo, {
        pCommentNo: comment.pCommentNo,
        userId: comment.userId,
        userNick: comment.userNick,
        profileImage: normalizeProfileImage(comment.profileImage),
        regDate: comment.regDate,
        comment: comment.comment,
      });
    }
  }

  return Array.from(deduped.values()).toSorted(compareByRecent);
};

const RouteComponent = () => {
  const [urlInput, setUrlInput] = useState('');
  const [targetInput, setTargetInput] = useState(DEFAULT_TARGETS);
  const [copiedNo, setCopiedNo] = useState<number | null>(null);
  const [submittedTarget, setSubmittedTarget] = useState<SoopTarget | null>(
    null,
  );

  const lastAutoFetchKeyRef = useRef('');
  const copyResetTimerRef = useRef<number | null>(null);

  const [queryUrl, setQueryUrl] = useQueryState('url', searchParams.url);
  const [queryTargets, setQueryTargets] = useQueryState(
    'targets',
    searchParams.targets,
  );

  useEffect(
    () => () => {
      if (copyResetTimerRef.current !== null) {
        clearTimeout(copyResetTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const parsed = parseSoopPostUrl(queryUrl);
    setUrlInput(parsed ? buildPostUrl(parsed) : queryUrl);
  }, [queryUrl]);

  useEffect(() => {
    setTargetInput(queryTargets || DEFAULT_TARGETS);
  }, [queryTargets]);

  const parsedTarget = useMemo(() => parseSoopPostUrl(urlInput), [urlInput]);
  const parsedInputTerms = useMemo(
    () => parseTargets(targetInput),
    [targetInput],
  );
  const hasTargets = parsedInputTerms.length > 0;

  const parsedQueryTarget = useMemo(
    () => parseSoopPostUrl(queryUrl),
    [queryUrl],
  );
  const queryTerms = useMemo(() => parseTargets(queryTargets), [queryTargets]);
  const autoFetchKey =
    parsedQueryTarget && queryTerms.length > 0
      ? `${parsedQueryTarget.userId}:${parsedQueryTarget.postId}:${queryTerms.join(',')}`
      : '';

  const {
    mutateAsync,
    isPending,
    isError,
    isSuccess,
    data: matchedComments,
  } = useMutation({
    mutationFn: ({
      target,
      targets,
    }: {
      target: SoopTarget;
      targets: string;
    }) => fetchMatchedComments(target, targets),
  });

  useEffect(() => {
    if (!autoFetchKey || !parsedQueryTarget) return;
    if (lastAutoFetchKeyRef.current === autoFetchKey) return;

    lastAutoFetchKeyRef.current = autoFetchKey;
    setCopiedNo(null);
    setSubmittedTarget(parsedQueryTarget);
    void mutateAsync({ target: parsedQueryTarget, targets: queryTargets });
  }, [autoFetchKey, mutateAsync, parsedQueryTarget, queryTargets]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!parsedTarget || !hasTargets) return;

    const nextUrl = buildPostUrl(parsedTarget);
    const normalizedTargets = parsedInputTerms.join(',');
    const nextKey = `${parsedTarget.userId}:${parsedTarget.postId}:${normalizedTargets}`;

    lastAutoFetchKeyRef.current = nextKey;
    setCopiedNo(null);
    setSubmittedTarget(parsedTarget);
    setUrlInput(nextUrl);

    await Promise.all([
      setQueryUrl(nextUrl),
      setQueryTargets(normalizedTargets),
    ]);
    await mutateAsync({ target: parsedTarget, targets: normalizedTargets });
  };

  const handleCopy = (link: string, pCommentNo: number) => {
    try {
      copyText(link);
      setCopiedNo(pCommentNo);
      if (copyResetTimerRef.current !== null) {
        clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedNo((prev) => (prev === pCommentNo ? null : prev));
      }, 1200);
    } catch {
      setCopiedNo(null);
    }
  };

  const isValidUrl = Boolean(parsedTarget);

  return (
    <main className="min-h-screen bg-slate-950 px-3 py-6 text-slate-100 sm:px-4">
      <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/30 backdrop-blur sm:p-5">
        <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">
          SOOP 댓글 링크 생성기
        </h1>

        <form className="mt-4 flex flex-col gap-2.5" onSubmit={handleSubmit}>
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500"
              onChange={(event) => setUrlInput(event.target.value)}
              placeholder="게시글 URL (https://www.sooplive.com/station/*****/post/*****)"
              type="url"
              value={urlInput}
            />
          </div>

          <input
            className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-500"
            onChange={(event) => setTargetInput(event.target.value)}
            placeholder="찾을 ID 또는 닉네임 (여러 개는 콤마로 구분)"
            type="text"
            value={targetInput}
          />

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            disabled={!isValidUrl || !hasTargets || isPending}
            type="submit"
          >
            <Search className="h-4 w-4" />
            {isPending ? '불러오는 중...' : '찾기'}
          </button>
        </form>

        {!isValidUrl && urlInput.trim().length > 0 ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-rose-300 sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            URL 형식이 올바르지 않습니다.
          </p>
        ) : null}

        {!hasTargets && targetInput.trim().length > 0 ? (
          <p className="mt-2 flex items-center gap-1 text-xs text-rose-300 sm:text-sm">
            <AlertCircle className="h-4 w-4" />
            ID 또는 닉네임을 1개 이상 입력해 주세요.
          </p>
        ) : null}

        {isError ? (
          <p className="mt-3 rounded-xl border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            댓글을 불러오지 못했습니다. URL과 네트워크 상태를 확인해 주세요.
          </p>
        ) : null}

        {isSuccess ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-slate-300">
              찾은 댓글{' '}
              <span className="font-semibold text-slate-100">
                {matchedComments.length}
              </span>
              개
            </p>

            {matchedComments.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-8 text-center text-sm text-slate-400">
                일치하는 댓글이 없습니다.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {matchedComments.map((item) => {
                  const link = submittedTarget
                    ? buildCommentLink(submittedTarget, item.pCommentNo)
                    : '';
                  const isCopied = copiedNo === item.pCommentNo;

                  return (
                    <li
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 sm:px-4"
                      key={item.pCommentNo}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <img
                            alt={item.userNick}
                            className="h-6 w-6 shrink-0 rounded-full border border-slate-700 object-cover"
                            loading="lazy"
                            src={item.profileImage}
                          />
                          <p className="truncate text-sm font-semibold text-slate-100 sm:text-base">
                            {item.userNick}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400 sm:text-sm">
                          {item.regDate}
                        </span>
                      </div>

                      <p className="mt-1 line-clamp-3 overflow-hidden text-ellipsis text-sm text-slate-300">
                        {item.comment}
                      </p>

                      <div className="mt-2 flex justify-end">
                        <button
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 transition hover:border-sky-500 hover:text-sky-300"
                          onClick={() => handleCopy(link, item.pCommentNo)}
                          type="button"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {isCopied ? '복사됨' : '링크 복사'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
};

export const Route = createFileRoute('/tools/soopcomment')({
  validateSearch: createStandardSchemaV1(searchParams, { partialOutput: true }),
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
