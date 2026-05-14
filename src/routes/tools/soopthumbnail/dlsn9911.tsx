/**
 * SOOP Thumbnail tool context (update this block whenever behavior changes):
 * - This route renders the browser-only canvas editor for the `제갈금자`
 *   template at `/tools/soopthumbnail/dlsn9911`.
 * - Shared editor mechanics and form/download/preview UI live in sibling
 *   `index.tsx`; keep this file focused on PSD-specific constants, title
 *   wrapping, and draw order.
 * - The source PSD and verification PNGs are 1365x768. Runtime rendering uses
 *   `/assets/dlsn9911/frame.png` for `일반` and
 *   `/assets/dlsn9911/frame_plus.png` for `구플`; these frame overlays are the
 *   source of truth for the outer border/date-tab art.
 * - PSD text layer references: `제목(일반)` bounds are approximately
 *   70,637..697,730; `제목(구플)` bounds are approximately 74,630..608,728;
 *   `날짜` bounds are approximately 985,29..1288,81. Its PSD text data uses
 *   FontSize 65, FauxBold, HorizontalScale 0.9, Tracking -10, and an `FrFX`
 *   outside/solid/normal stroke at 100% opacity, 5px, RGB(18,14,14). Canvas text
 *   cannot reproduce Photoshop's exact text engine, so this file uses a PSD-ish
 *   local text runner with x/y scaling, tracking, and a visually matched
 *   centered stroke. Browser-level synthetic bold was too heavy against the
 *   flattened verification PNG, so the date uses regular fill with a thicker
 *   outline. Date text is left-anchored inside the date tab so edits grow to
 *   the right instead of expanding around the center.
 * - `제목(일반)` uses PSD-like black outside stroke plus Hard Light outer glow.
 *   The small red offset text is drawn as filled text because it is visible as
 *   a filled shadow mass in the flattened verification PNG after the frame and
 *   gradient composite. `제목(구플)` instead follows the PSD Drop Shadow source
 *   (normal, RGB(240,255,0), 100%, angle 136, distance 12, size 16) plus the
 *   same Hard Light outer glow; the canvas paint color/opacity/blur are
 *   perceptually tuned because Photoshop layer effects do not map 1:1 to canvas
 *   compositing.
 * - Title text uses `/fonts/hakgyoansim_allimjang-b.otf`; date text uses
 *   `/fonts/hakgyoansim_byeoljari-l.otf`. Preview/download stay disabled if
 *   either font fails to load.
 * - The blank inner template background is white, matching the existing
 *   `모구구` empty-state policy. Uploaded backgrounds are centered cover-crops
 *   inside the rounded frame area. The background upload control stays above
 *   the `일반`/`구플` type selector in this template's control panel.
 * - Title input is a single multiline textarea. Only explicit user newlines
 *   create multiple title lines; long unbroken lines shrink instead of
 *   auto-wrapping. The title still renders at most two lines inside the
 *   lower-left PSD title area, and a cleared/blank title intentionally renders
 *   no title text.
 * - Blurred title shadows/glows are rendered on a temporary layer with the
 *   final text shape knocked out before compositing, so the diffusion remains
 *   underneath/outside the glyphs instead of tinting the white title fill.
 *   Multi-line titles are also painted in two passes: all shadow layers first,
 *   then all foreground strokes/fills.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useId, useMemo, useRef, useState } from 'react';

import {
  buildRoundedRectPath,
  type CanvasSize,
  DEFAULT_CHARACTER_UPLOAD_MESSAGES,
  DEFAULT_IMAGE_UPLOAD_MESSAGES,
  drawEditableImageLayers,
  type EditableImageRenderOptions,
  getDownloadDate,
  getPsdCanvasFont,
  measurePsdTextWidth,
  type SoopThumbnailTemplateId,
  SoopThumbnailToolLayout,
  setupThumbnailCanvas,
  ThumbnailCanvasPreview,
  ThumbnailCharacterImageOptions,
  ThumbnailDownloadButton,
  ThumbnailImageInput,
  ThumbnailStatusMessage,
  ThumbnailTextarea,
  ThumbnailTextInput,
  useCanvasFonts,
  useCharacterImageOptions,
  useCharacterLayer,
  useImageFileInput,
  useTemplateImages,
  useThumbnailRenderer,
  useTodayDateText,
} from './index';

const SOOP_THUMBNAIL_TEMPLATE_ID = 'dlsn9911' satisfies SoopThumbnailTemplateId;

type Dlsn9911TemplateType = 'normal' | 'plus';

type RenderOptions = EditableImageRenderOptions & {
  dateText: string;
  frameImage: HTMLImageElement;
  templateType: Dlsn9911TemplateType;
  titleText: string;
};

const CANVAS_SIZE = { height: 768, width: 1365 } as const satisfies CanvasSize;
const TITLE_FONT_FAMILY = 'SoopThumbnailDlsn9911Title';
const TITLE_FONT_URL = '/fonts/hakgyoansim_allimjang-b.otf';
const DATE_FONT_FAMILY = 'SoopThumbnailDlsn9911Date';
const DATE_FONT_URL = '/fonts/hakgyoansim_byeoljari-l.otf';
const TEMPLATE_FONTS = [
  { family: TITLE_FONT_FAMILY, testSize: 96, url: TITLE_FONT_URL },
  { family: DATE_FONT_FAMILY, testSize: 64, url: DATE_FONT_URL },
] as const;
const TEMPLATE_ASSET_BASE_URL = '/assets/dlsn9911';
const TEMPLATE_IMAGES = {
  normalFrame: `${TEMPLATE_ASSET_BASE_URL}/frame.png`,
  plusFrame: `${TEMPLATE_ASSET_BASE_URL}/frame_plus.png`,
} as const;

const INNER_FRAME = { height: 724, radius: 83, width: 1321, x: 24, y: 23 };
const CHARACTER_BOUNDS = {
  height: INNER_FRAME.height,
  width: INNER_FRAME.width,
  x: INNER_FRAME.x,
  y: INNER_FRAME.y,
};
const CHARACTER_MIN_SIZE = 64;
const CHARACTER_OUTLINE_COLOR = '#000000';
const CHARACTER_OUTLINE_WIDTH = 10;
const DEFAULT_TITLE_TEXT = '제목텍스트';
const TITLE_BOX = {
  bottomBaseline: 722,
  maxLines: 2,
  minFontSize: 28,
  startFontSize: 102,
  width: 1100,
  x: 70,
};
const DATE_TEXT = {
  baseline: 77,
  maxWidth: 380,
  minFontSize: 54,
  outerStrokeWidth: 10,
  scaleX: 1.04,
  scaleY: 0.98,
  startFontSize: 77,
  tracking: -0.5,
  x: 985,
};

type TitleEffectStyle = {
  dropShadow?: {
    blendMode: GlobalCompositeOperation;
    blur: number;
    color: string;
    offsetX: number;
    offsetY: number;
    opacity: number;
  };
  glow: {
    blendMode: GlobalCompositeOperation;
    blur: number;
    color: string;
    opacity: number;
  };
  offsetStroke?: {
    color: string;
    offsetX: number;
    offsetY: number;
    opacity: number;
    strokeWidth: number;
  };
  outerStrokeWidth: number;
  scaleX: number;
  scaleY: number;
};

const TITLE_STYLES: Record<Dlsn9911TemplateType, TitleEffectStyle> = {
  normal: {
    glow: {
      blendMode: 'hard-light',
      blur: 38,
      color: '#292929',
      opacity: 0.63,
    },
    offsetStroke: {
      color: '#a83230',
      offsetX: 8,
      offsetY: 9,
      opacity: 1,
      strokeWidth: 1,
    },
    outerStrokeWidth: 9,
    scaleX: 1.1,
    scaleY: 1.02,
  },
  plus: {
    glow: { blendMode: 'hard-light', blur: 38, color: '#292929', opacity: 0.8 },
    dropShadow: {
      blendMode: 'source-over',
      blur: 8,
      color: '#ccd400',
      offsetX: 6,
      offsetY: 6,
      opacity: 0.6,
    },
    outerStrokeWidth: 8,
    scaleX: 1.1,
    scaleY: 1.02,
  },
};

type PsdTextRunStyle = {
  align: CanvasTextAlign;
  fillColor?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  dropShadow?: {
    blendMode: GlobalCompositeOperation;
    blur: number;
    color: string;
    offsetX: number;
    offsetY: number;
    opacity: number;
  };
  glow?: {
    blendMode: GlobalCompositeOperation;
    blur: number;
    color: string;
    opacity: number;
  };
  offsetStroke?: {
    color: string;
    offsetX: number;
    offsetY: number;
    opacity: number;
    strokeWidth: number;
  };
  outerStrokeColor?: string;
  outerStrokeWidth: number;
  scaleX?: number;
  scaleY?: number;
  tracking?: number;
};

type TextPaintLayer = {
  fill?: boolean;
  fillColor?: string;
  filter?: string;
  globalCompositeOperation?: GlobalCompositeOperation;
  knockoutText?: boolean;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

type PsdTextRunPass = 'all' | 'foreground' | 'shadows';

const drawPsdTextLayer = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: PsdTextRunStyle,
  layer: TextPaintLayer,
) => {
  if (layer.knockoutText) {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.height = context.canvas.height;
    shadowCanvas.width = context.canvas.width;
    const shadowContext = shadowCanvas.getContext('2d');

    if (!shadowContext) {
      return;
    }

    drawPsdTextLayer(shadowContext, text, x, y, style, {
      ...layer,
      globalCompositeOperation: undefined,
      knockoutText: undefined,
      opacity: undefined,
    });

    shadowContext.globalCompositeOperation = 'destination-out';
    drawPsdTextLayer(shadowContext, text, x, y, style, {
      fill: true,
      fillColor: '#000000',
      strokeColor: '#000000',
      strokeWidth: style.outerStrokeWidth + 2,
    });
    shadowContext.globalCompositeOperation = 'source-over';

    context.save();
    context.globalAlpha = layer.opacity ?? 1;
    if (layer.globalCompositeOperation) {
      context.globalCompositeOperation = layer.globalCompositeOperation;
    }
    context.drawImage(shadowCanvas, 0, 0);
    context.restore();
    return;
  }

  const scaleX = style.scaleX ?? 1;
  const scaleY = style.scaleY ?? 1;
  const tracking = style.tracking ?? 0;
  const characters = [...text];

  context.save();
  context.translate(x + (layer.offsetX ?? 0), y + (layer.offsetY ?? 0));
  context.scale(scaleX, scaleY);
  context.font = getPsdCanvasFont(style);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.miterLimit = 2;

  if (layer.opacity !== undefined) {
    context.globalAlpha = layer.opacity;
  }
  if (layer.filter) {
    context.filter = layer.filter;
  }
  if (layer.globalCompositeOperation) {
    context.globalCompositeOperation = layer.globalCompositeOperation;
  }

  const runWidth = measurePsdTextWidth(context, text, {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    tracking: style.tracking,
  });
  let cursor =
    style.align === 'center'
      ? -runWidth / 2
      : style.align === 'right'
        ? -runWidth
        : 0;

  if (layer.strokeWidth && layer.strokeColor) {
    context.strokeStyle = layer.strokeColor;
    context.lineWidth = layer.strokeWidth;

    for (const character of characters) {
      context.strokeText(character, cursor, 0);
      cursor += context.measureText(character).width + tracking;
    }
  }

  if (layer.fill) {
    cursor =
      style.align === 'center'
        ? -runWidth / 2
        : style.align === 'right'
          ? -runWidth
          : 0;
    context.fillStyle = layer.fillColor ?? style.fillColor ?? '#ffffff';

    for (const character of characters) {
      context.fillText(character, cursor, 0);
      cursor += context.measureText(character).width + tracking;
    }
  }

  context.restore();
};

const drawPsdTextRun = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: PsdTextRunStyle,
  pass: PsdTextRunPass = 'all',
) => {
  if (!text) {
    return;
  }

  if (pass !== 'foreground' && style.dropShadow) {
    drawPsdTextLayer(context, text, x, y, style, {
      fill: true,
      fillColor: style.dropShadow.color,
      filter: `blur(${style.dropShadow.blur}px)`,
      globalCompositeOperation: style.dropShadow.blendMode,
      knockoutText: true,
      offsetX: style.dropShadow.offsetX,
      offsetY: style.dropShadow.offsetY,
      opacity: style.dropShadow.opacity,
      strokeColor: style.dropShadow.color,
      strokeWidth: style.outerStrokeWidth,
    });
  }

  if (pass !== 'foreground' && style.glow) {
    drawPsdTextLayer(context, text, x, y, style, {
      fill: true,
      fillColor: style.glow.color,
      filter: `blur(${style.glow.blur}px)`,
      globalCompositeOperation: style.glow.blendMode,
      knockoutText: true,
      opacity: style.glow.opacity,
      strokeColor: style.glow.color,
      strokeWidth: style.outerStrokeWidth,
    });
  }

  if (pass !== 'foreground' && style.offsetStroke) {
    drawPsdTextLayer(context, text, x, y, style, {
      fill: true,
      fillColor: style.offsetStroke.color,
      offsetX: style.offsetStroke.offsetX,
      offsetY: style.offsetStroke.offsetY,
      opacity: style.offsetStroke.opacity,
      strokeColor: style.offsetStroke.color,
      strokeWidth: style.offsetStroke.strokeWidth,
    });
  }

  if (pass === 'shadows') {
    return;
  }

  drawPsdTextLayer(context, text, x, y, style, {
    strokeColor: style.outerStrokeColor ?? '#050505',
    strokeWidth: style.outerStrokeWidth,
  });
  drawPsdTextLayer(context, text, x, y, style, {
    fill: true,
    fillColor: style.fillColor ?? '#ffffff',
  });
};

const getExplicitTitleLines = (text: string) => {
  const explicitLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (explicitLines.length <= TITLE_BOX.maxLines) {
    return explicitLines;
  }

  return [explicitLines[0], explicitLines.slice(1).join('')];
};

const layoutTitleText = (
  context: CanvasRenderingContext2D,
  titleText: string,
  titleStyle: (typeof TITLE_STYLES)[Dlsn9911TemplateType],
) => {
  const normalizedTitleText = titleText.trim();
  const lines = getExplicitTitleLines(normalizedTitleText);
  const maxLineWidth = TITLE_BOX.width / titleStyle.scaleX;

  for (
    let fontSize = TITLE_BOX.startFontSize;
    fontSize >= TITLE_BOX.minFontSize;
    fontSize -= 2
  ) {
    const linesFit = lines.every(
      (line) =>
        measurePsdTextWidth(context, line, {
          fontFamily: TITLE_FONT_FAMILY,
          fontSize,
        }) <= maxLineWidth,
    );

    if (linesFit) {
      return { fontSize, lines };
    }
  }

  return { fontSize: TITLE_BOX.minFontSize, lines };
};

const fitDateFontSize = (
  context: CanvasRenderingContext2D,
  dateText: string,
) => {
  let fontSize = DATE_TEXT.startFontSize;

  while (fontSize > DATE_TEXT.minFontSize) {
    const dateWidth =
      measurePsdTextWidth(context, dateText, {
        fontFamily: DATE_FONT_FAMILY,
        fontSize,
        tracking: DATE_TEXT.tracking,
      }) * DATE_TEXT.scaleX;

    if (dateWidth <= DATE_TEXT.maxWidth) {
      break;
    }
    fontSize -= 2;
  }

  return fontSize;
};

const drawDlsn9911Template = (
  context: CanvasRenderingContext2D,
  options: RenderOptions,
) => {
  setupThumbnailCanvas(context, CANVAS_SIZE);

  context.save();
  buildRoundedRectPath(
    context,
    INNER_FRAME.x,
    INNER_FRAME.y,
    INNER_FRAME.width,
    INNER_FRAME.height,
    INNER_FRAME.radius,
  );
  context.clip();
  drawEditableImageLayers(context, {
    backgroundImage: options.backgroundImage,
    bounds: INNER_FRAME,
    characterBox: options.characterBox,
    characterImage: options.characterImage,
    characterOutline: options.characterOutline,
    characterShadow: options.characterShadow,
  });
  context.restore();

  const titleStyle = TITLE_STYLES[options.templateType];
  const titleLayout = layoutTitleText(context, options.titleText, titleStyle);
  const titleLineHeight = titleLayout.fontSize * titleStyle.scaleY * 1.3;
  const firstTitleBaseline =
    TITLE_BOX.bottomBaseline - (titleLayout.lines.length - 1) * titleLineHeight;

  const titleTextRuns = titleLayout.lines.map((line, index) => ({
    line,
    y: firstTitleBaseline + titleLineHeight * index,
  }));

  const titleTextStyle = {
    align: 'left',
    dropShadow: titleStyle.dropShadow,
    fillColor: '#ffffff',
    fontFamily: TITLE_FONT_FAMILY,
    fontSize: titleLayout.fontSize,
    glow: titleStyle.glow,
    offsetStroke: titleStyle.offsetStroke,
    outerStrokeColor: '#000000',
    outerStrokeWidth: titleStyle.outerStrokeWidth,
    scaleX: titleStyle.scaleX,
    scaleY: titleStyle.scaleY,
  } satisfies PsdTextRunStyle;

  context.drawImage(
    options.frameImage,
    0,
    0,
    CANVAS_SIZE.width,
    CANVAS_SIZE.height,
  );

  titleTextRuns.forEach(({ line, y }) => {
    drawPsdTextRun(context, line, TITLE_BOX.x, y, titleTextStyle, 'shadows');
  });

  titleTextRuns.forEach(({ line, y }) => {
    drawPsdTextRun(context, line, TITLE_BOX.x, y, titleTextStyle, 'foreground');
  });

  const dateFontSize = fitDateFontSize(context, options.dateText);
  drawPsdTextRun(context, options.dateText, DATE_TEXT.x, DATE_TEXT.baseline, {
    align: 'left',
    fillColor: '#ffffff',
    fontFamily: DATE_FONT_FAMILY,
    fontSize: dateFontSize,
    outerStrokeColor: '#120e0e',
    outerStrokeWidth: DATE_TEXT.outerStrokeWidth,
    scaleX: DATE_TEXT.scaleX,
    scaleY: DATE_TEXT.scaleY,
    tracking: DATE_TEXT.tracking,
  });
};

const RouteComponent = () => {
  const backgroundInputId = useId();
  const characterInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [templateType, setTemplateType] =
    useState<Dlsn9911TemplateType>('normal');
  const [dateText, setDateText] = useTodayDateText();
  const [titleText, setTitleText] = useState(DEFAULT_TITLE_TEXT);
  const characterImageOptions = useCharacterImageOptions({ shadow: true });
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

  const frameImage =
    templateType === 'plus' ? images?.plusFrame : images?.normalFrame;
  const downloadFileName = useMemo(
    () =>
      `soop-thumbnail-${SOOP_THUMBNAIL_TEMPLATE_ID}-${templateType}-${getDownloadDate(dateText)}.png`,
    [dateText, templateType],
  );

  const renderOptions = useMemo<RenderOptions | null>(() => {
    if (!frameImage) {
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
      frameImage,
      templateType,
      titleText,
    };
  }, [
    background.image,
    character.image,
    characterImageOptions,
    characterLayer.box,
    dateText,
    frameImage,
    templateType,
    titleText,
  ]);

  const { downloadError, handleDownload, isLoading, isReady } =
    useThumbnailRenderer({
      assetStatus,
      canvasRef,
      drawTemplate: drawDlsn9911Template,
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

          <fieldset className="min-w-0 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-medium text-zinc-300">
              타입
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '일반', value: 'normal' },
                { label: '구플', value: 'plus' },
              ].map((option) => (
                <label
                  className={`flex h-10 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-semibold transition ${
                    templateType === option.value
                      ? 'border-amber-300 bg-amber-300 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-300/70 hover:text-amber-100'
                  }`}
                  key={option.value}
                >
                  <input
                    checked={templateType === option.value}
                    className="sr-only"
                    name="dlsn9911-template-type"
                    onChange={() =>
                      setTemplateType(option.value as Dlsn9911TemplateType)
                    }
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <ThumbnailTextInput
            label="날짜"
            onChange={setDateText}
            value={dateText}
          />

          <ThumbnailTextarea
            label="제목 텍스트"
            onChange={setTitleText}
            value={titleText}
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
              제갈금자 템플릿 폰트를 불러오지 못했습니다.
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

export const Route = createFileRoute('/tools/soopthumbnail/dlsn9911')({
  component: RouteComponent,
  headers: () => ({
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  }),
});
