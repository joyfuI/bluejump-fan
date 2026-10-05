/**
 * SOOP 모구구 썸네일 맥락 (관련 동작을 바꾸면 이 주석도 갱신):
 * - /tools/soopthumbnail/9mogu9의 브라우저 Canvas 편집기다. 공통 편집·로딩·
 *   미리보기·다운로드는 형제 index.tsx를 사용하고 PSD별 좌표·문자 효과·그리기 순서는 여기 둔다.
 * - 1920×1080 PSD를 기준으로 하며 런타임에는 /assets/9mogu9/frame.png만
 *   템플릿 그림으로 쓴다. 다른 PSD 이미지 레이어는 넣지 않고 배경·캐릭터는 사용자 업로드로 받는다.
 * - frame.png의 연노랑 외곽은 유지하고 배경 미업로드 시 내부 영역만 흰색으로 채운다.
 *   배경·캐릭터를 둥근 내부 영역에 잘라 그린 뒤 프레임, 날짜, 두 제목을 겹친다.
 * - PSD 문자 효과를 근사한다. 제목은 연노랑 드롭 섀도·약한 내부 그림자·검정 외곽선,
 *   날짜는 드롭 섀도 없이 검정 외곽선·약한 내부 그림자를 쓴다.
 *   Photoshop의 choke 효과는 Canvas에서 직접 지원하지 않아, 제목 그림자를
 *   블러 없는 이동된 문자 레이어로 그린다. 이때 외곽선 폭은 검정 테두리 대신 PSD 그림자 크기를 쓴다.
 * - /fonts/jalnan2.otf를 FontFace로 로드하며 대체 폰트를 쓰지 않는다.
 *   폰트나 프레임 로딩 실패 시 미리보기·다운로드를 막는다. 캐릭터 테두리·그림자는 기본 해제다.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useId, useMemo, useRef, useState } from 'react';

import {
  buildRoundedRectPath,
  type CanvasSize,
  DEFAULT_CHARACTER_UPLOAD_MESSAGES,
  DEFAULT_IMAGE_UPLOAD_MESSAGES,
  drawEditableImageLayers,
  drawFullCanvasImage,
  drawOutlinedText,
  type EditableImageRenderOptions,
  fitFontSize,
  getDownloadDate,
  type SoopThumbnailTemplateId,
  SoopThumbnailToolLayout,
  setupThumbnailCanvas,
  ThumbnailCanvasPreview,
  ThumbnailCharacterImageOptions,
  ThumbnailDownloadButton,
  ThumbnailImageInput,
  ThumbnailStatusMessage,
  ThumbnailTextInput,
  useCanvasFonts,
  useCharacterImageOptions,
  useCharacterLayer,
  useImageFileInput,
  useTemplateImages,
  useThumbnailRenderer,
  useTodayDateText,
} from './index';

const SOOP_THUMBNAIL_TEMPLATE_ID = '9mogu9' satisfies SoopThumbnailTemplateId;

type RenderOptions = EditableImageRenderOptions & {
  dateText: string;
  firstText: string;
  frameImage: HTMLImageElement;
  secondText: string;
};

const CANVAS_SIZE = { height: 1080, width: 1920 } as const satisfies CanvasSize;
const FONT_FAMILY = 'SoopThumbnailJalnan2';
const FONT_URL = '/fonts/jalnan2.otf';
const TEMPLATE_FONTS = [
  { family: FONT_FAMILY, testSize: 64, url: FONT_URL },
] as const;
const TEMPLATE_IMAGES = { frame: '/assets/9mogu9/frame.png' } as const;
const TEXT_SHADOW_GOLD = '#ffe8a2';
const TEXT_INNER_SHADOW = '#3b3b3b';

const FRAME = { height: 1044, radius: 44, width: 1884, x: 18, y: 18 };
const CHARACTER_BOUNDS = {
  height: FRAME.height,
  width: FRAME.width,
  x: FRAME.x,
  y: FRAME.y,
};
const CHARACTER_MIN_SIZE = 80;
const CHARACTER_OUTLINE_WIDTH = 10;
const DEFAULT_FIRST_TEXT = '#첫번째텍스트';
const DEFAULT_SECOND_TEXT = '#두번째텍스트';
const TITLE_DROP_SHADOW = {
  blur: 0,
  color: TEXT_SHADOW_GOLD,
  offsetX: 4,
  offsetY: 8,
  opacity: 0.63,
  strokeWidth: 12,
} as const;
const TITLE_INNER_SHADOW = {
  color: TEXT_INNER_SHADOW,
  offsetX: 8,
  offsetY: -3,
  opacity: 0.22,
} as const;
const DATE_INNER_SHADOW = {
  color: TEXT_INNER_SHADOW,
  offsetX: 3,
  offsetY: -1,
  opacity: 0.15,
} as const;

const drawMoguguTemplate = (
  context: CanvasRenderingContext2D,
  options: RenderOptions,
) => {
  setupThumbnailCanvas(context, CANVAS_SIZE);

  context.save();
  buildRoundedRectPath(
    context,
    FRAME.x,
    FRAME.y,
    FRAME.width,
    FRAME.height,
    FRAME.radius,
  );
  context.clip();
  drawEditableImageLayers(context, {
    backgroundImage: options.backgroundImage,
    bounds: FRAME,
    characterBox: options.characterBox,
    characterImage: options.characterImage,
    characterOutline: options.characterOutline,
    characterShadow: options.characterShadow,
  });

  context.restore();

  drawFullCanvasImage(context, options.frameImage, CANVAS_SIZE);

  const dateFontSize = fitFontSize(
    context,
    options.dateText,
    58,
    38,
    370,
    FONT_FAMILY,
  );
  drawOutlinedText(context, options.dateText, 409, 676, {
    align: 'center',
    canvasSize: CANVAS_SIZE,
    fontFamily: FONT_FAMILY,
    fontSize: dateFontSize,
    innerShadow: DATE_INNER_SHADOW,
    maxWidth: 370,
    outerStrokeWidth: 12,
  });

  const firstFontSize = fitFontSize(
    context,
    options.firstText,
    118,
    72,
    1760,
    FONT_FAMILY,
  );
  drawOutlinedText(context, options.firstText, 78, 826, {
    align: 'left',
    canvasSize: CANVAS_SIZE,
    dropShadow: TITLE_DROP_SHADOW,
    fontFamily: FONT_FAMILY,
    fontSize: firstFontSize,
    innerShadow: TITLE_INNER_SHADOW,
    maxWidth: 1760,
    outerStrokeWidth: 18,
  });

  const secondFontSize = fitFontSize(
    context,
    options.secondText,
    118,
    72,
    1760,
    FONT_FAMILY,
  );
  drawOutlinedText(context, options.secondText, 78, 972, {
    align: 'left',
    canvasSize: CANVAS_SIZE,
    dropShadow: TITLE_DROP_SHADOW,
    fontFamily: FONT_FAMILY,
    fontSize: secondFontSize,
    innerShadow: TITLE_INNER_SHADOW,
    maxWidth: 1760,
    outerStrokeWidth: 18,
  });
};

const RouteComponent = () => {
  const backgroundInputId = useId();
  const characterInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dateText, setDateText] = useTodayDateText();
  const [firstText, setFirstText] = useState(DEFAULT_FIRST_TEXT);
  const [secondText, setSecondText] = useState(DEFAULT_SECOND_TEXT);
  const characterImageOptions = useCharacterImageOptions();
  const fontStatus = useCanvasFonts(TEMPLATE_FONTS);
  const { images, status: assetStatus } = useTemplateImages(TEMPLATE_IMAGES);
  const background = useImageFileInput(DEFAULT_IMAGE_UPLOAD_MESSAGES);
  const character = useImageFileInput(DEFAULT_CHARACTER_UPLOAD_MESSAGES);
  const characterLayer = useCharacterLayer({
    bounds: CHARACTER_BOUNDS,
    canvasRef,
    canvasSize: CANVAS_SIZE,
    image: character.image,
    minSize: CHARACTER_MIN_SIZE,
  });

  const downloadFileName = useMemo(
    () =>
      `soop-thumbnail-${SOOP_THUMBNAIL_TEMPLATE_ID}-${getDownloadDate(dateText)}.png`,
    [dateText],
  );

  const renderOptions = useMemo<RenderOptions | null>(() => {
    if (!images) {
      return null;
    }

    return {
      backgroundImage: background.image,
      characterBox: characterLayer.box,
      characterImage: character.image,
      characterOutline: {
        enabled: characterImageOptions.characterOutlineEnabled,
        width: CHARACTER_OUTLINE_WIDTH,
      },
      characterShadow: {
        enabled: characterImageOptions.characterShadowEnabled,
      },
      dateText,
      firstText,
      frameImage: images.frame,
      secondText,
    };
  }, [
    background.image,
    character.image,
    characterImageOptions,
    characterLayer.box,
    dateText,
    firstText,
    images,
    secondText,
  ]);

  const { downloadError, handleDownload, isLoading, isReady } =
    useThumbnailRenderer({
      assetStatus,
      canvasRef,
      drawTemplate: drawMoguguTemplate,
      fileName: downloadFileName,
      fontStatus,
      options: renderOptions,
    });

  return (
    <SoopThumbnailToolLayout
      activeTemplateId={SOOP_THUMBNAIL_TEMPLATE_ID}
      controls={
        <div className="flex flex-col gap-4">
          <ThumbnailImageInput
            id={backgroundInputId}
            input={background}
            label="배경 이미지"
          />

          <ThumbnailTextInput
            label="날짜"
            onChange={setDateText}
            value={dateText}
          />

          <ThumbnailTextInput
            label="첫 번째 텍스트"
            onChange={setFirstText}
            value={firstText}
          />

          <ThumbnailTextInput
            label="두 번째 텍스트"
            onChange={setSecondText}
            value={secondText}
          />

          <ThumbnailImageInput
            clearLabel="캐릭터 이미지 삭제"
            id={characterInputId}
            input={character}
            label="캐릭터 이미지"
            showClearButton
            variant="secondary"
          />

          <ThumbnailCharacterImageOptions
            {...characterImageOptions}
            characterRotation={characterLayer.rotation}
            onCharacterRotationChange={characterLayer.setRotation}
            onCharacterRotationReset={characterLayer.resetRotation}
          />

          {fontStatus === 'error' ? (
            <ThumbnailStatusMessage>
              jalnan2.otf를 불러오지 못했습니다.
            </ThumbnailStatusMessage>
          ) : null}

          {assetStatus === 'error' ? (
            <ThumbnailStatusMessage>
              PSD 템플릿 에셋을 불러오지 못했습니다.
            </ThumbnailStatusMessage>
          ) : null}

          {downloadError ? (
            <ThumbnailStatusMessage>{downloadError}</ThumbnailStatusMessage>
          ) : null}

          <ThumbnailDownloadButton
            isLoading={isLoading}
            isReady={isReady}
            onClick={handleDownload}
          />
        </div>
      }
      preview={
        <ThumbnailCanvasPreview
          canvasRef={canvasRef}
          canvasSize={CANVAS_SIZE}
          characterBox={character.image ? characterLayer.box : null}
          characterControls={characterLayer}
          isLoading={isLoading}
          isReady={isReady}
        />
      }
    />
  );
};

export const Route = createFileRoute('/tools/soopthumbnail/9mogu9')({
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
