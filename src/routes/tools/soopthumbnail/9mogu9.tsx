/**
 * SOOP Thumbnail tool context (update this block whenever behavior changes):
 * - This route renders the browser-only canvas editor for the `모구구`
 *   template at `/tools/soopthumbnail/9mogu9`.
 * - Shared navigation, default redirect, date formatting, font/image loading,
 *   shared form controls/download/preview UI, background upload, character
 *   upload/drag/resize/delete, cover-crop drawing, and stroked text drawing
 *   live in sibling `index.tsx`; keep repeated editor mechanics there instead
 *   of re-copying them into template files.
 * - The source PSD for the `모구구` template is 1920x1080 and is intentionally
 *   not parsed at runtime. The lower-left dark gradient panel comes from PSD
 *   layer `레이어 3`; the date bar is an isolated raster of PSD layer `사각형 2`
 *   with its layer-effect alpha fade preserved, not the raw solid vector fill.
 *   The frame, lower-left gradient, date bar, and skull marks are loaded from
 *   `/assets/9mogu9/*.png`; keep those files as the source of truth instead of
 *   inlining raster art in this route.
 * - Skull PNGs are drawn after the date text so the date stroke/max-width
 *   rendering cannot cover the right skull marker.
 * - Keep the PSD's pale-yellow outer template/border area from `frame.png`.
 *   Only the inner frame background is white when the user has not uploaded a
 *   background image.
 * - Text effects follow the PSD layer styles: title text uses a light yellow
 *   drop shadow, subtle dark inner shadow, and outside black stroke; date text
 *   keeps its PSD drop shadow disabled and uses only the black stroke plus
 *   weak inner shadow. Canvas cannot express Photoshop choke directly, so the
 *   title drop shadow is approximated with a shifted hard text layer using
 *   the PSD shadow size instead of the black stroke width.
 * - Font policy is strict: text rendering must use `/fonts/jalnan2.otf` through
 *   the `FontFace` API. There is no fallback font path; if the font fails to
 *   load, preview/download stay disabled.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  buildRoundedRectPath,
  type CanvasSize,
  DEFAULT_CHARACTER_UPLOAD_MESSAGES,
  DEFAULT_IMAGE_UPLOAD_MESSAGES,
  downloadRenderedThumbnail,
  drawEditableImageLayers,
  drawOutlinedText,
  type EditableImageRenderOptions,
  fitFontSize,
  getDownloadDate,
  renderThumbnailToCanvas,
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
  useCharacterLayer,
  useImageFileInput,
  useTemplateImages,
  useTodayDateText,
} from './index';

const SOOP_THUMBNAIL_TEMPLATE_ID = '9mogu9' satisfies SoopThumbnailTemplateId;

type RenderOptions = EditableImageRenderOptions & {
  darkPanelImage: HTMLImageElement;
  dateText: string;
  dateBarImage: HTMLImageElement;
  firstText: string;
  frameImage: HTMLImageElement;
  leftSkullImage: HTMLImageElement;
  rightSkullImage: HTMLImageElement;
  secondText: string;
};

const CANVAS_SIZE = { height: 1080, width: 1920 } as const satisfies CanvasSize;
const FONT_FAMILY = 'SoopThumbnailJalnan2';
const FONT_URL = '/fonts/jalnan2.otf';
const TEMPLATE_FONTS = [
  { family: FONT_FAMILY, testSize: 64, url: FONT_URL },
] as const;
const TEMPLATE_ASSET_BASE_URL = '/assets/9mogu9';
const TEMPLATE_IMAGES = {
  darkPanel: `${TEMPLATE_ASSET_BASE_URL}/dark_gradient.png`,
  dateBar: `${TEMPLATE_ASSET_BASE_URL}/date_bar.png`,
  frame: `${TEMPLATE_ASSET_BASE_URL}/frame.png`,
  leftSkull: `${TEMPLATE_ASSET_BASE_URL}/left_skull.png`,
  rightSkull: `${TEMPLATE_ASSET_BASE_URL}/right_skull.png`,
} as const;
const TEXT_SHADOW_GOLD = '#ffe8a2';
const TEXT_INNER_SHADOW = '#3b3b3b';

const FRAME = { height: 1044, radius: 44, width: 1884, x: 18, y: 18 };
const CHARACTER_BOUNDS = {
  height: FRAME.height,
  width: FRAME.width,
  x: FRAME.x,
  y: FRAME.y,
};
const DARK_PANEL = { x: -33, y: 496 };
const DATE_BAR = { x: 42, y: 610 };
const LEFT_SKULL = { x: 145, y: 624 };
const RIGHT_SKULL = { x: 608, y: 625 };
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

  context.drawImage(options.darkPanelImage, DARK_PANEL.x, DARK_PANEL.y);
  context.drawImage(options.dateBarImage, DATE_BAR.x, DATE_BAR.y);
  context.restore();

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

  context.drawImage(options.leftSkullImage, LEFT_SKULL.x, LEFT_SKULL.y);
  context.drawImage(options.rightSkullImage, RIGHT_SKULL.x, RIGHT_SKULL.y);

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

  context.drawImage(
    options.frameImage,
    0,
    0,
    CANVAS_SIZE.width,
    CANVAS_SIZE.height,
  );
};

const RouteComponent = () => {
  const backgroundInputId = useId();
  const characterInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dateText, setDateText] = useTodayDateText();
  const [firstText, setFirstText] = useState(DEFAULT_FIRST_TEXT);
  const [secondText, setSecondText] = useState(DEFAULT_SECOND_TEXT);
  const [characterOutlineEnabled, setCharacterOutlineEnabled] = useState(false);
  const [characterShadowEnabled, setCharacterShadowEnabled] = useState(false);
  const [downloadError, setDownloadError] = useState('');
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
        enabled: characterOutlineEnabled,
        width: CHARACTER_OUTLINE_WIDTH,
      },
      characterShadow: { enabled: characterShadowEnabled },
      darkPanelImage: images.darkPanel,
      dateBarImage: images.dateBar,
      dateText,
      firstText,
      frameImage: images.frame,
      leftSkullImage: images.leftSkull,
      rightSkullImage: images.rightSkull,
      secondText,
    };
  }, [
    background.image,
    character.image,
    characterOutlineEnabled,
    characterShadowEnabled,
    characterLayer.box,
    dateText,
    firstText,
    images,
    secondText,
  ]);

  const isReady =
    fontStatus === 'loaded' &&
    assetStatus === 'loaded' &&
    renderOptions !== null;

  useEffect(() => {
    if (!isReady || !canvasRef.current || !renderOptions) {
      return;
    }

    renderThumbnailToCanvas(
      canvasRef.current,
      renderOptions,
      drawMoguguTemplate,
    );
  }, [isReady, renderOptions]);

  const handleDownload = () => {
    downloadRenderedThumbnail({
      canvas: canvasRef.current,
      drawTemplate: drawMoguguTemplate,
      fileName: downloadFileName,
      isReady,
      options: renderOptions,
      setError: setDownloadError,
    });
  };

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
            characterOutlineEnabled={characterOutlineEnabled}
            characterShadowEnabled={characterShadowEnabled}
            onCharacterOutlineChange={setCharacterOutlineEnabled}
            onCharacterShadowChange={setCharacterShadowEnabled}
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
            isLoading={fontStatus === 'loading' || assetStatus === 'loading'}
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
          isLoading={fontStatus === 'loading' || assetStatus === 'loading'}
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
