/**
 * SOOP Thumbnail directory context (update this block whenever behavior changes):
 * - This directory owns the `/tools/soopthumbnail` thumbnail maker family.
 * - `index.tsx` keeps shared route shell, template tab metadata, and the
 *   default redirect only; individual template routes own their canvas
 *   rendering and PSD-specific assets.
 * - `/tools/soopthumbnail` redirects to `/tools/soopthumbnail/9mogu9` so the
 *   first template stays addressable by its own route while the base URL still
 *   works.
 * - Add future templates by appending to `soopThumbnailTemplates`, creating a
 *   sibling route file, and rendering it through `SoopThumbnailToolLayout`.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const soopThumbnailTemplates = [
  { id: '9mogu9', label: '모구구', to: '/tools/soopthumbnail/9mogu9' },
] as const;

export type SoopThumbnailTemplateId =
  (typeof soopThumbnailTemplates)[number]['id'];

type SoopThumbnailToolLayoutProps = {
  activeTemplateId: SoopThumbnailTemplateId;
  controls: ReactNode;
  preview: ReactNode;
};

export const SoopThumbnailToolLayout = ({
  activeTemplateId,
  controls,
  preview,
}: SoopThumbnailToolLayoutProps) => (
  <main className="min-h-screen bg-zinc-950 px-3 py-4 text-zinc-100 sm:px-4">
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <section className="flex flex-col gap-3 border-zinc-800 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-semibold text-xl text-zinc-50 tracking-normal">
            다시보기 썸네일 생성기
          </h1>
          <p className="mt-1 text-sm text-zinc-400">1920x1080 PNG</p>
        </div>

        <div
          aria-label="썸네일 종류"
          className="inline-flex w-full rounded-lg border border-zinc-800 bg-zinc-900 p-1 sm:w-auto"
          role="tablist"
        >
          {soopThumbnailTemplates.map((template) => {
            const isSelected = activeTemplateId === template.id;

            return (
              <Link
                aria-selected={isSelected}
                className={`flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-semibold transition sm:flex-none ${
                  isSelected
                    ? 'bg-amber-300 text-zinc-950'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
                key={template.id}
                role="tab"
                to={template.to}
              >
                {template.label}
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="h-fit rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          {controls}
        </section>

        <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900 p-2 sm:p-3">
          {preview}
        </section>
      </div>
    </div>
  </main>
);

export const Route = createFileRoute('/tools/soopthumbnail/')({
  beforeLoad: () => {
    throw Route.redirect({ replace: true, to: '/tools/soopthumbnail/9mogu9' });
  },
  component: () => null,
});
