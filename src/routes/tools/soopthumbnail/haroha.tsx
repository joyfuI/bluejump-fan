/**
 * SOOP Thumbnail tool context (update this block whenever behavior changes):
 * - This route renders the browser-only canvas editor for the `하로하`
 *   template at `/tools/soopthumbnail/haroha`.
 * - Shared editor mechanics and form/download/preview UI live in sibling
 *   `index.tsx`; keep this file focused on PSD-specific constants, text
 *   fitting, and draw order.
 * - The source PSD and verification PNG are 1920x1080. Runtime rendering uses
 *   `/assets/haroha/frame.png` as the full-canvas overlay for the outer brown
 *   frame, upper-right date tab, and lower dark gradient. The overlay is the
 *   source of truth for frame art; do not recreate those shapes in canvas.
 * - The PSD's example character layer is treated as verification-only art.
 *   Background and character images remain user uploads, matching the existing
 *   `모구구` interaction model.
 * - Date text uses `/fonts/s-core_dream8.otf` (`S-CoreDream-8Heavy` in the
 *   PSD). Title and side-tag text use `/fonts/s-core_dream9.otf`
 *   (`S-CoreDream-9Black` in the PSD). Preview/download stay disabled if either
 *   font or the frame overlay fails to load.
 * - Text placement is manually matched to the PSD: date text is right-anchored
 *   to the date tab, first and second title lines sit at the lower-left, and
 *   optional third/fourth tag lines render inside yellow rounded pills beside
 *   the first title line. The first title can run much wider than the original
 *   PSD sample before shrinking; the tag group x-position follows the measured
 *   width of that first title text. The PSD title layer uses an outside stroke
 *   of 10px, converted for canvas's centered strokeText rendering and the
 *   title's 0.9 horizontal scale. Tag pills allow moderately wider labels than
 *   the PSD sample, are nudged slightly left from the measured title edge, and
 *   measure the current text plus horizontal padding instead of using a fixed
 *   width. Their height follows the PSD rounded-rectangle vector shape at
 *   78px, and the radius uses the maximum canvas capsule value of 39px.
 *   Photoshop Tracking -10 is converted from thousandths-of-em into canvas
 *   pixels at the final fitted font size. Blank tag values intentionally render
 *   no pill and no text.
 * - Use `C:/Users/jong9/Desktop/썸네일/로하/하로하 썸네일 템플릿.png` as the visual
 *   verification target when tuning coordinates.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useId, useMemo, useRef, useState } from 'react';

import {
  buildRoundedRectPath,
  type CanvasSize,
  DEFAULT_CHARACTER_UPLOAD_MESSAGES,
  DEFAULT_IMAGE_UPLOAD_MESSAGES,
  drawEditableImageLayers,
  drawPsdText,
  type EditableImageRenderOptions,
  fitPsdTextFontSize,
  getDownloadDate,
  getPhotoshopTrackingPx,
  measurePsdTextWidth,
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

const SOOP_THUMBNAIL_TEMPLATE_ID = 'haroha' satisfies SoopThumbnailTemplateId;

type RenderOptions = EditableImageRenderOptions & {
  dateText: string;
  firstText: string;
  fourthText: string;
  frameImage: HTMLImageElement;
  secondText: string;
  thirdText: string;
};

const CANVAS_SIZE = { height: 1080, width: 1920 } as const satisfies CanvasSize;
const DATE_FONT_FAMILY = 'SoopThumbnailHarohaHeavy';
const DATE_FONT_URL = '/fonts/s-core_dream8.otf';
const TITLE_FONT_FAMILY = 'SoopThumbnailHarohaBlack';
const TITLE_FONT_URL = '/fonts/s-core_dream9.otf';
const TEMPLATE_FONTS = [
  { family: DATE_FONT_FAMILY, testSize: 72, url: DATE_FONT_URL },
  { family: TITLE_FONT_FAMILY, testSize: 128, url: TITLE_FONT_URL },
] as const;
const TEMPLATE_ASSET_BASE_URL = '/assets/haroha';
const TEMPLATE_IMAGES = {
  frame: `${TEMPLATE_ASSET_BASE_URL}/frame.png`,
} as const;
const TEMPLATE_BROWN = '#2d241b';
const TEMPLATE_YELLOW = '#ffef94';
const TITLE_HORIZONTAL_SCALE = 0.9;
const TITLE_PSD_OUTSIDE_STROKE_WIDTH = 10;
const TITLE_CANVAS_STROKE_WIDTH =
  (TITLE_PSD_OUTSIDE_STROKE_WIDTH * 2) / TITLE_HORIZONTAL_SCALE;

const INNER_FRAME = { height: 994, width: 1834, x: 43, y: 43 };
const CHARACTER_BOUNDS = {
  height: INNER_FRAME.height,
  width: INNER_FRAME.width,
  x: INNER_FRAME.x,
  y: INNER_FRAME.y,
};
const CHARACTER_MIN_SIZE = 80;
const CHARACTER_OUTLINE_COLOR = '#2d241b';
const CHARACTER_OUTLINE_WIDTH = 10;
const DEFAULT_FIRST_TEXT = '첫 번째 텍스트';
const DEFAULT_SECOND_TEXT = '두 번째 텍스트';
const DEFAULT_THIRD_TEXT = '#세 번째 텍스트';
const DEFAULT_FOURTH_TEXT = '#네 번째 텍스트';
const DATE_TEXT = {
  baseline: 106,
  maxWidth: 370,
  minFontSize: 44,
  scaleX: 0.9,
  startFontSize: 66,
  x: 1853,
};
const FIRST_TITLE = {
  baseline: 800,
  maxWidth: 1100,
  minFontSize: 64,
  outerStrokeWidth: TITLE_CANVAS_STROKE_WIDTH,
  scaleX: TITLE_HORIZONTAL_SCALE,
  startFontSize: 110,
  x: 82,
};
const SECOND_TITLE = {
  baseline: 967,
  maxWidth: 1760,
  minFontSize: 72,
  outerStrokeWidth: TITLE_CANVAS_STROKE_WIDTH,
  scaleX: TITLE_HORIZONTAL_SCALE,
  startFontSize: 150,
  x: 82,
};
const TAG_PILL = {
  fillColor: TEMPLATE_YELLOW,
  gapFromFirstTitle: 8,
  height: 78,
  maxWidth: 678,
  minWidth: 96,
  paddingX: 26,
  radius: 39,
  textBaselineOffset: 61,
};
const TAG_TEXT = {
  maxWidth: 620,
  minFontSize: 34,
  photoshopTracking: -10,
  scaleX: 0.9,
  startFontSize: 56,
};
const TAG_ROWS = [
  { key: 'thirdText', y: 669 },
  { key: 'fourthText', y: 739 },
] as const satisfies ReadonlyArray<{
  key: 'fourthText' | 'thirdText';
  y: number;
}>;

const drawTagPill = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return;
  }

  let fontSize = TAG_TEXT.startFontSize;
  let tracking = getPhotoshopTrackingPx(fontSize, TAG_TEXT.photoshopTracking);

  while (fontSize > TAG_TEXT.minFontSize) {
    const width = measurePsdTextWidth(context, normalizedText, {
      fontFamily: TITLE_FONT_FAMILY,
      fontSize,
      scaleX: TAG_TEXT.scaleX,
      tracking,
    });

    if (width <= TAG_TEXT.maxWidth) {
      break;
    }

    fontSize -= 2;
    tracking = getPhotoshopTrackingPx(fontSize, TAG_TEXT.photoshopTracking);
  }

  const textWidth = measurePsdTextWidth(context, normalizedText, {
    fontFamily: TITLE_FONT_FAMILY,
    fontSize,
    scaleX: TAG_TEXT.scaleX,
    tracking,
  });
  const pillWidth = Math.min(
    Math.max(textWidth + TAG_PILL.paddingX * 2, TAG_PILL.minWidth),
    TAG_PILL.maxWidth,
  );

  buildRoundedRectPath(
    context,
    x,
    y,
    pillWidth,
    TAG_PILL.height,
    TAG_PILL.radius,
  );
  context.fillStyle = TAG_PILL.fillColor;
  context.fill();

  drawPsdText(
    context,
    normalizedText,
    x + TAG_PILL.paddingX,
    y + TAG_PILL.textBaselineOffset,
    {
      align: 'left',
      fillColor: TEMPLATE_BROWN,
      fontFamily: TITLE_FONT_FAMILY,
      fontSize,
      scaleX: TAG_TEXT.scaleX,
      tracking,
    },
  );
};

const drawHarohaTemplate = (
  context: CanvasRenderingContext2D,
  options: RenderOptions,
) => {
  setupThumbnailCanvas(context, CANVAS_SIZE);
  drawEditableImageLayers(context, {
    backgroundImage: options.backgroundImage,
    bounds: INNER_FRAME,
    characterBox: options.characterBox,
    characterImage: options.characterImage,
    characterOutline: options.characterOutline,
    characterShadow: options.characterShadow,
  });

  context.drawImage(
    options.frameImage,
    0,
    0,
    CANVAS_SIZE.width,
    CANVAS_SIZE.height,
  );

  const dateFontSize = fitPsdTextFontSize(context, options.dateText, {
    fontFamily: DATE_FONT_FAMILY,
    maxWidth: DATE_TEXT.maxWidth,
    minFontSize: DATE_TEXT.minFontSize,
    scaleX: DATE_TEXT.scaleX,
    startFontSize: DATE_TEXT.startFontSize,
  });
  drawPsdText(context, options.dateText, DATE_TEXT.x, DATE_TEXT.baseline, {
    align: 'right',
    fillColor: TEMPLATE_BROWN,
    fontFamily: DATE_FONT_FAMILY,
    fontSize: dateFontSize,
    scaleX: DATE_TEXT.scaleX,
  });

  const firstFontSize = fitPsdTextFontSize(context, options.firstText, {
    fontFamily: TITLE_FONT_FAMILY,
    maxWidth: FIRST_TITLE.maxWidth,
    minFontSize: FIRST_TITLE.minFontSize,
    scaleX: FIRST_TITLE.scaleX,
    startFontSize: FIRST_TITLE.startFontSize,
  });
  drawPsdText(context, options.firstText, FIRST_TITLE.x, FIRST_TITLE.baseline, {
    align: 'left',
    fillColor: TEMPLATE_YELLOW,
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: firstFontSize,
    outerStrokeColor: TEMPLATE_BROWN,
    outerStrokeWidth: FIRST_TITLE.outerStrokeWidth,
    scaleX: FIRST_TITLE.scaleX,
  });

  const firstTitleWidth = measurePsdTextWidth(
    context,
    options.firstText.trim(),
    {
      fontFamily: TITLE_FONT_FAMILY,
      fontSize: firstFontSize,
      scaleX: FIRST_TITLE.scaleX,
    },
  );
  const tagGroupX =
    FIRST_TITLE.x +
    firstTitleWidth +
    FIRST_TITLE.outerStrokeWidth / 2 +
    TAG_PILL.gapFromFirstTitle;

  for (const row of TAG_ROWS) {
    drawTagPill(context, options[row.key], tagGroupX, row.y);
  }

  const secondFontSize = fitPsdTextFontSize(context, options.secondText, {
    fontFamily: TITLE_FONT_FAMILY,
    maxWidth: SECOND_TITLE.maxWidth,
    minFontSize: SECOND_TITLE.minFontSize,
    scaleX: SECOND_TITLE.scaleX,
    startFontSize: SECOND_TITLE.startFontSize,
  });
  drawPsdText(
    context,
    options.secondText,
    SECOND_TITLE.x,
    SECOND_TITLE.baseline,
    {
      align: 'left',
      fillColor: TEMPLATE_YELLOW,
      fontFamily: TITLE_FONT_FAMILY,
      fontSize: secondFontSize,
      outerStrokeColor: TEMPLATE_BROWN,
      outerStrokeWidth: SECOND_TITLE.outerStrokeWidth,
      scaleX: SECOND_TITLE.scaleX,
    },
  );
};

const RouteComponent = () => {
  const backgroundInputId = useId();
  const characterInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dateText, setDateText] = useTodayDateText();
  const [firstText, setFirstText] = useState(DEFAULT_FIRST_TEXT);
  const [secondText, setSecondText] = useState(DEFAULT_SECOND_TEXT);
  const [thirdText, setThirdText] = useState(DEFAULT_THIRD_TEXT);
  const [fourthText, setFourthText] = useState(DEFAULT_FOURTH_TEXT);
  const characterImageOptions = useCharacterImageOptions({ outline: true });
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
        color: CHARACTER_OUTLINE_COLOR,
        enabled: characterImageOptions.characterOutlineEnabled,
        width: CHARACTER_OUTLINE_WIDTH,
      },
      characterShadow: {
        enabled: characterImageOptions.characterShadowEnabled,
      },
      dateText,
      firstText,
      fourthText,
      frameImage: images.frame,
      secondText,
      thirdText,
    };
  }, [
    background.image,
    character.image,
    characterImageOptions,
    characterLayer.box,
    dateText,
    firstText,
    fourthText,
    images,
    secondText,
    thirdText,
  ]);

  const { downloadError, handleDownload, isLoading, isReady } =
    useThumbnailRenderer({
      assetStatus,
      canvasRef,
      drawTemplate: drawHarohaTemplate,
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

          <ThumbnailTextInput
            label="세 번째 텍스트"
            onChange={setThirdText}
            value={thirdText}
          />

          <ThumbnailTextInput
            label="네 번째 텍스트"
            onChange={setFourthText}
            value={fourthText}
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
              하로하 템플릿 폰트를 불러오지 못했습니다.
            </ThumbnailStatusMessage>
          ) : null}

          {assetStatus === 'error' ? (
            <ThumbnailStatusMessage>
              하로하 PSD 템플릿 에셋을 불러오지 못했습니다.
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

export const Route = createFileRoute('/tools/soopthumbnail/haroha')({
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
