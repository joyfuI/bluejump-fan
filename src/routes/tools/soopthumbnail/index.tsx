/**
 * SOOP Thumbnail directory context (update this block whenever behavior changes):
 * - This directory owns the `/tools/soopthumbnail` thumbnail maker family.
 * - `index.tsx` keeps the shared route shell, template tab metadata, base
 *   redirect, and browser-only helpers that are reused by individual template
 *   routes: font/asset loading, image uploads, date formatting, cover-crop
 *   drawing, optional character outline/shadow rendering scaled from PSD
 *   reference canvases, stroked/PSD-style text helpers, shared form
 *   controls/download/preview UI, and interactive character placement with
 *   partial outside-bounds movement/rotation.
 * - The current template tabs are `제갈금자`, `모구구`, and `하로하`; each
 *   template route owns its PSD-specific asset/font constants and draw order.
 * - `/tools/soopthumbnail` redirects to `/tools/soopthumbnail/dlsn9911`
 *   because `제갈금자` is the first template tab.
 * - Template route files should keep PSD-specific constants and render order
 *   local, then render through `SoopThumbnailToolLayout`.
 * - Keep this context block current whenever shared behavior or template
 *   routing changes so future agents do not have to reverse-engineer intent
 *   from canvas code alone.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { Download, ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export const soopThumbnailTemplates = [
  { id: 'dlsn9911', label: '제갈금자', to: '/tools/soopthumbnail/dlsn9911' },
  { id: '9mogu9', label: '모구구', to: '/tools/soopthumbnail/9mogu9' },
  { id: 'haroha', label: '하로하', to: '/tools/soopthumbnail/haroha' },
] as const;

export type SoopThumbnailTemplateId =
  (typeof soopThumbnailTemplates)[number]['id'];

export type CanvasSize = { height: number; width: number };
export type ImageBox = {
  height: number;
  rotation?: number;
  width: number;
  x: number;
  y: number;
};
export type LoadStatus = 'loading' | 'loaded' | 'error';
export type CharacterOutlineOptions = {
  color?: string;
  enabled: boolean;
  width: number;
};
export type CharacterShadowOptions = {
  angle?: number;
  blendMode?: GlobalCompositeOperation;
  blur?: number;
  color?: string;
  distance?: number;
  enabled: boolean;
  glow?: {
    blendMode?: GlobalCompositeOperation;
    color?: string;
    opacity?: number;
    size?: number;
  };
  opacity?: number;
};
export type EditableImageRenderOptions = {
  backgroundImage: HTMLImageElement | null;
  characterBox: ImageBox | null;
  characterImage: HTMLImageElement | null;
  characterOutline: CharacterOutlineOptions;
  characterShadow: CharacterShadowOptions;
};
type CharacterImageOptionsDefaults = { outline?: boolean; shadow?: boolean };

const DEFAULT_CHARACTER_OUTLINE_COLOR = '#ffffff';
const CHARACTER_OUTLINE_REFERENCE_CANVAS_SIZE = {
  height: 1080,
  width: 1920,
} as const satisfies CanvasSize;
const DEFAULT_CHARACTER_SHADOW = {
  angle: 136,
  blendMode: 'source-over',
  blur: 3,
  color: '#000000',
  distance: 5,
  glow: { blendMode: 'hard-light', color: '#292929', opacity: 0.32, size: 25 },
  opacity: 0.68,
} as const satisfies Required<Omit<CharacterShadowOptions, 'enabled'>>;
const CHARACTER_ROTATION_MIN = -180;
const CHARACTER_ROTATION_MAX = 180;
const CHARACTER_ROTATION_STEP = 1;
const CHARACTER_MAX_BOUNDS_RATIO = 2.5;
const CHARACTER_OUTSIDE_BOUNDS_RATIO = 0.4;
const CHARACTER_SHADOW_REFERENCE_CANVAS_SIZE = {
  height: 768,
  width: 1365,
} as const satisfies CanvasSize;
export const DEFAULT_THUMBNAIL_INNER_BACKGROUND = '#ffffff';

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

const padDatePart = (value: number) => String(value).padStart(2, '0');

export const formatTodayDate = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join('.');
};

export const getDownloadDate = (dateText: string) => {
  const digits = dateText.replace(/\D/g, '');
  return digits.length > 0 ? digits : 'date';
};

export const useTodayDateText = () => {
  const [dateText, setDateText] = useState('');

  useEffect(() => {
    setDateText(formatTodayDate());
  }, []);

  return [dateText, setDateText] as const;
};

export const useCharacterImageOptions = ({
  outline = false,
  shadow = false,
}: CharacterImageOptionsDefaults = {}) => {
  const [characterOutlineEnabled, onCharacterOutlineChange] = useState(outline);
  const [characterShadowEnabled, onCharacterShadowChange] = useState(shadow);

  return useMemo(
    () => ({
      characterOutlineEnabled,
      characterShadowEnabled,
      onCharacterOutlineChange,
      onCharacterShadowChange,
    }),
    [characterOutlineEnabled, characterShadowEnabled],
  );
};

const DEFAULT_THUMBNAIL_DOWNLOAD_ERROR_MESSAGE =
  'PNG 파일을 만들지 못했습니다.';

const downloadCanvasAsPng = (
  canvas: HTMLCanvasElement,
  fileName: string,
  onError: () => void,
) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      onError();
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  }, 'image/png');
};

type ThumbnailDrawTemplate<TOptions> = (
  context: CanvasRenderingContext2D,
  options: TOptions,
) => void;

const renderThumbnailToCanvas = <TOptions,>(
  canvas: HTMLCanvasElement,
  options: TOptions,
  drawTemplate: ThumbnailDrawTemplate<TOptions>,
) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  drawTemplate(context, options);
};

export const useThumbnailRenderer = <TOptions,>({
  assetStatus,
  canvasRef,
  drawTemplate,
  fileName,
  fontStatus,
  options,
}: {
  assetStatus: LoadStatus;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  drawTemplate: ThumbnailDrawTemplate<TOptions>;
  fileName: string;
  fontStatus: LoadStatus;
  options: TOptions | null;
}) => {
  const [downloadError, setDownloadError] = useState('');
  const isLoading = fontStatus === 'loading' || assetStatus === 'loading';
  const isReady =
    fontStatus === 'loaded' && assetStatus === 'loaded' && options !== null;

  useEffect(() => {
    if (!isReady || !canvasRef.current || !options) {
      return;
    }

    renderThumbnailToCanvas(canvasRef.current, options, drawTemplate);
  }, [canvasRef, drawTemplate, isReady, options]);

  const handleDownload = useCallback(() => {
    if (!isReady || !canvasRef.current || !options) {
      return;
    }

    setDownloadError('');
    renderThumbnailToCanvas(canvasRef.current, options, drawTemplate);

    downloadCanvasAsPng(canvasRef.current, fileName, () => {
      setDownloadError(DEFAULT_THUMBNAIL_DOWNLOAD_ERROR_MESSAGE);
    });
  }, [canvasRef, drawTemplate, fileName, isReady, options]);

  return { downloadError, handleDownload, isLoading, isReady };
};

export const getRgba = (hexColor: string, opacity: number) => {
  const normalizedColor = hexColor.replace('#', '');
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeCharacterRotation = (rotation: number) => {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  return clamp(
    Math.round(rotation),
    CHARACTER_ROTATION_MIN,
    CHARACTER_ROTATION_MAX,
  );
};

const getCharacterRotation = (box: ImageBox) =>
  normalizeCharacterRotation(box.rotation ?? 0);

const getDegreesAsRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const getImageNaturalSize = (image: HTMLImageElement) => ({
  height: image.naturalHeight || image.height,
  width: image.naturalWidth || image.width,
});

export const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.decoding = 'async';
    image.src = source;
  });

export const buildRoundedRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - resolvedRadius,
    y + height,
  );
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
};

export const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return;
  }

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
};

const drawCharacterLayerSource = (
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: ImageBox,
  padding = 0,
) => {
  const rotation = getCharacterRotation(box);
  const drawWidth = box.width + padding * 2;
  const drawHeight = box.height + padding * 2;

  if (rotation === 0) {
    context.drawImage(
      source,
      box.x - padding,
      box.y - padding,
      drawWidth,
      drawHeight,
    );
    return;
  }

  context.save();
  context.translate(box.x + box.width / 2, box.y + box.height / 2);
  context.rotate(getDegreesAsRadians(rotation));
  context.drawImage(
    source,
    -box.width / 2 - padding,
    -box.height / 2 - padding,
    drawWidth,
    drawHeight,
  );
  context.restore();
};

const characterOutlineOffsetsCache = new Map<
  number,
  Array<{ x: number; y: number }>
>();

const getCanvasScale = (canvasSize: CanvasSize, referenceSize: CanvasSize) =>
  Math.min(
    canvasSize.width / referenceSize.width,
    canvasSize.height / referenceSize.height,
  );

const getScaledCharacterOutlineWidth = (
  width: number,
  canvas: HTMLCanvasElement,
) =>
  width *
  getCanvasScale(
    { height: canvas.height, width: canvas.width },
    CHARACTER_OUTLINE_REFERENCE_CANVAS_SIZE,
  );

const getScaledCharacterShadowValue = (
  value: number,
  canvas: HTMLCanvasElement,
) =>
  value *
  getCanvasScale(
    { height: canvas.height, width: canvas.width },
    CHARACTER_SHADOW_REFERENCE_CANVAS_SIZE,
  );

const getPhotoshopShadowOffset = (angle: number, distance: number) => {
  const radians = getDegreesAsRadians(angle);

  return { x: -Math.cos(radians) * distance, y: Math.sin(radians) * distance };
};

const clampOpacity = (opacity: number) => Math.min(1, Math.max(0, opacity));

const getCharacterOutlineOffsets = (width: number) => {
  const outlineWidth = Math.max(0, width);
  const cacheKey = Math.round(outlineWidth * 1000) / 1000;
  const radius = Math.ceil(outlineWidth);
  const cachedOffsets = characterOutlineOffsetsCache.get(cacheKey);
  if (cachedOffsets) {
    return cachedOffsets;
  }

  const offsets: Array<{ x: number; y: number }> = [];
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x === 0 && y === 0) {
        continue;
      }

      if (x * x + y * y <= outlineWidth * outlineWidth) {
        offsets.push({ x, y });
      }
    }
  }

  characterOutlineOffsetsCache.set(cacheKey, offsets);
  return offsets;
};

const drawCharacterOutline = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: ImageBox,
  outline: CharacterOutlineOptions,
) => {
  if (!outline.enabled || typeof document === 'undefined') {
    return;
  }

  const outlineWidth = getScaledCharacterOutlineWidth(
    outline.width,
    context.canvas,
  );
  if (outlineWidth <= 0) {
    return;
  }

  const padding = Math.ceil(outlineWidth);
  const canvasWidth = Math.ceil(box.width + padding * 2);
  const canvasHeight = Math.ceil(box.height + padding * 2);
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }

  const outlineCanvas = document.createElement('canvas');
  outlineCanvas.width = canvasWidth;
  outlineCanvas.height = canvasHeight;

  const outlineContext = outlineCanvas.getContext('2d');
  if (!outlineContext) {
    return;
  }

  outlineContext.imageSmoothingEnabled = true;
  outlineContext.imageSmoothingQuality = 'high';

  for (const offset of getCharacterOutlineOffsets(outlineWidth)) {
    outlineContext.drawImage(
      image,
      padding + offset.x,
      padding + offset.y,
      box.width,
      box.height,
    );
  }

  outlineContext.globalCompositeOperation = 'source-in';
  outlineContext.fillStyle = outline.color ?? DEFAULT_CHARACTER_OUTLINE_COLOR;
  outlineContext.fillRect(0, 0, canvasWidth, canvasHeight);

  drawCharacterLayerSource(context, outlineCanvas, box, padding);
};

const drawCharacterAlphaEffect = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: ImageBox,
  {
    blendMode,
    blur,
    color,
    offsetX,
    offsetY,
    opacity,
  }: {
    blendMode: GlobalCompositeOperation;
    blur: number;
    color: string;
    offsetX: number;
    offsetY: number;
    opacity: number;
  },
) => {
  if (opacity <= 0) {
    return;
  }

  const padding = Math.ceil(
    blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)),
  );
  const canvasWidth = Math.ceil(box.width + padding * 2);
  const canvasHeight = Math.ceil(box.height + padding * 2);
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return;
  }

  const effectCanvas = document.createElement('canvas');
  effectCanvas.width = canvasWidth;
  effectCanvas.height = canvasHeight;

  const effectContext = effectCanvas.getContext('2d');
  if (!effectContext) {
    return;
  }

  effectContext.imageSmoothingEnabled = true;
  effectContext.imageSmoothingQuality = 'high';
  effectContext.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  effectContext.drawImage(
    image,
    padding + offsetX,
    padding + offsetY,
    box.width,
    box.height,
  );
  effectContext.filter = 'none';
  effectContext.globalCompositeOperation = 'source-in';
  effectContext.fillStyle = color;
  effectContext.fillRect(0, 0, canvasWidth, canvasHeight);

  context.save();
  context.globalCompositeOperation = blendMode;
  context.globalAlpha = opacity;
  drawCharacterLayerSource(context, effectCanvas, box, padding);
  context.restore();
};

const drawCharacterShadow = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  box: ImageBox,
  shadow: CharacterShadowOptions,
) => {
  if (!shadow.enabled || typeof document === 'undefined') {
    return;
  }

  const opacity = clampOpacity(
    shadow.opacity ?? DEFAULT_CHARACTER_SHADOW.opacity,
  );
  const blur = Math.max(
    0,
    getScaledCharacterShadowValue(
      shadow.blur ?? DEFAULT_CHARACTER_SHADOW.blur,
      context.canvas,
    ),
  );
  const distance = Math.max(
    0,
    getScaledCharacterShadowValue(
      shadow.distance ?? DEFAULT_CHARACTER_SHADOW.distance,
      context.canvas,
    ),
  );

  const offset = getPhotoshopShadowOffset(
    shadow.angle ?? DEFAULT_CHARACTER_SHADOW.angle,
    distance,
  );
  drawCharacterAlphaEffect(context, image, box, {
    blendMode: shadow.blendMode ?? DEFAULT_CHARACTER_SHADOW.blendMode,
    blur,
    color: shadow.color ?? DEFAULT_CHARACTER_SHADOW.color,
    offsetX: offset.x,
    offsetY: offset.y,
    opacity,
  });

  const glow = shadow.glow ?? DEFAULT_CHARACTER_SHADOW.glow;
  const glowSize = Math.max(
    0,
    getScaledCharacterShadowValue(
      glow.size ?? DEFAULT_CHARACTER_SHADOW.glow.size,
      context.canvas,
    ),
  );
  drawCharacterAlphaEffect(context, image, box, {
    blendMode: glow.blendMode ?? DEFAULT_CHARACTER_SHADOW.glow.blendMode,
    blur: glowSize,
    color: glow.color ?? DEFAULT_CHARACTER_SHADOW.glow.color,
    offsetX: 0,
    offsetY: 0,
    opacity: clampOpacity(
      glow.opacity ?? DEFAULT_CHARACTER_SHADOW.glow.opacity,
    ),
  });
};

export const setupThumbnailCanvas = (
  context: CanvasRenderingContext2D,
  canvasSize: CanvasSize,
) => {
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
};

export const drawEditableImageLayers = (
  context: CanvasRenderingContext2D,
  {
    backgroundImage,
    bounds,
    characterBox,
    characterImage,
    characterOutline,
    characterShadow,
    fillColor = DEFAULT_THUMBNAIL_INNER_BACKGROUND,
  }: {
    backgroundImage: HTMLImageElement | null;
    bounds: ImageBox;
    characterBox: ImageBox | null;
    characterImage: HTMLImageElement | null;
    characterOutline?: CharacterOutlineOptions;
    characterShadow?: CharacterShadowOptions;
    fillColor?: string;
  },
) => {
  context.fillStyle = fillColor;
  context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  if (backgroundImage) {
    drawCoverImage(
      context,
      backgroundImage,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );
  }

  if (characterImage && characterBox) {
    if (characterShadow) {
      drawCharacterShadow(
        context,
        characterImage,
        characterBox,
        characterShadow,
      );
    }

    if (characterOutline) {
      drawCharacterOutline(
        context,
        characterImage,
        characterBox,
        characterOutline,
      );
    }

    drawCharacterLayerSource(context, characterImage, characterBox);
  }
};

export const fitFontSize = (
  context: CanvasRenderingContext2D,
  text: string,
  startSize: number,
  minSize: number,
  maxWidth: number,
  fontFamily: string,
) => {
  let size = startSize;
  while (size > minSize) {
    context.font = `${size}px "${fontFamily}"`;
    if (context.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 2;
  }
  return size;
};

export type PsdCanvasTextStyle = {
  align: CanvasTextAlign;
  fillColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  outerStrokeColor?: string;
  outerStrokeWidth?: number;
  scaleX?: number;
  tracking?: number;
};

type PsdCanvasTextMeasureStyle = Pick<
  PsdCanvasTextStyle,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'scaleX' | 'tracking'
>;

export const getPsdCanvasFont = (
  style: Pick<PsdCanvasTextStyle, 'fontFamily' | 'fontSize' | 'fontWeight'>,
) =>
  `${style.fontWeight ? `${style.fontWeight} ` : ''}${style.fontSize}px "${
    style.fontFamily
  }"`;

export const measurePsdTextWidth = (
  context: CanvasRenderingContext2D,
  text: string,
  style: PsdCanvasTextMeasureStyle,
) => {
  context.save();
  context.font = getPsdCanvasFont(style);

  const characters = [...text];
  const tracking = style.tracking ?? 0;
  const width =
    characters.reduce(
      (totalWidth, character) =>
        totalWidth + context.measureText(character).width,
      0,
    ) +
    Math.max(0, characters.length - 1) * tracking;

  context.restore();
  return width * (style.scaleX ?? 1);
};

export const fitPsdTextFontSize = (
  context: CanvasRenderingContext2D,
  text: string,
  options: {
    fontFamily: string;
    maxWidth: number;
    minFontSize: number;
    scaleX?: number;
    startFontSize: number;
    tracking?: number;
  },
) => {
  const normalizedText = text.trim();
  let fontSize = options.startFontSize;

  while (normalizedText && fontSize > options.minFontSize) {
    const width = measurePsdTextWidth(context, normalizedText, {
      fontFamily: options.fontFamily,
      fontSize,
      scaleX: options.scaleX,
      tracking: options.tracking,
    });

    if (width <= options.maxWidth) {
      break;
    }
    fontSize -= 2;
  }

  return fontSize;
};

export const getPhotoshopTrackingPx = (fontSize: number, tracking: number) =>
  (fontSize * tracking) / 1000;

export const drawPsdText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: PsdCanvasTextStyle,
) => {
  const normalizedText = text.trim();
  if (!normalizedText) {
    return;
  }

  const scaleX = style.scaleX ?? 1;
  const tracking = style.tracking ?? 0;
  const characters = [...normalizedText];
  const unscaledRunWidth = measurePsdTextWidth(context, normalizedText, {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    scaleX: 1,
    tracking,
  });
  let cursor =
    style.align === 'center'
      ? -unscaledRunWidth / 2
      : style.align === 'right'
        ? -unscaledRunWidth
        : 0;

  context.save();
  context.translate(x, y);
  context.scale(scaleX, 1);
  context.font = getPsdCanvasFont(style);
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.miterLimit = 2;

  if (style.outerStrokeWidth && style.outerStrokeWidth > 0) {
    context.strokeStyle = style.outerStrokeColor ?? '#050505';
    context.lineWidth = style.outerStrokeWidth;

    for (const character of characters) {
      context.strokeText(character, cursor, 0);
      cursor += context.measureText(character).width + tracking;
    }
  }

  cursor =
    style.align === 'center'
      ? -unscaledRunWidth / 2
      : style.align === 'right'
        ? -unscaledRunWidth
        : 0;
  context.fillStyle = style.fillColor;

  for (const character of characters) {
    context.fillText(character, cursor, 0);
    cursor += context.measureText(character).width + tracking;
  }

  context.restore();
};

export type TextDropShadow = {
  blur: number;
  color: string;
  offsetX: number;
  offsetY: number;
  opacity: number;
  strokeWidth: number;
};

export type TextInnerShadow = {
  color: string;
  offsetX: number;
  offsetY: number;
  opacity: number;
};

export const drawOutlinedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    canvasSize: CanvasSize;
    dropShadow?: TextDropShadow;
    fillColor?: string;
    fontFamily: string;
    fontSize: number;
    innerShadow?: TextInnerShadow;
    maxWidth?: number;
    outerStrokeColor?: string;
    outerStrokeWidth: number;
  },
) => {
  if (!text) {
    return;
  }

  context.save();
  context.font = `${options.fontSize}px "${options.fontFamily}"`;
  context.textAlign = options.align;
  context.textBaseline = options.baseline ?? 'alphabetic';
  context.lineJoin = 'round';
  context.miterLimit = 2;

  if (options.dropShadow) {
    context.save();
    context.globalAlpha = options.dropShadow.opacity;
    context.filter = `blur(${options.dropShadow.blur}px)`;
    context.strokeStyle = options.dropShadow.color;
    context.fillStyle = options.dropShadow.color;
    context.lineWidth = options.dropShadow.strokeWidth;
    context.strokeText(
      text,
      x + options.dropShadow.offsetX,
      y + options.dropShadow.offsetY,
      options.maxWidth,
    );
    context.fillText(
      text,
      x + options.dropShadow.offsetX,
      y + options.dropShadow.offsetY,
      options.maxWidth,
    );
    context.restore();
  }

  context.strokeStyle = options.outerStrokeColor ?? '#050505';
  context.lineWidth = options.outerStrokeWidth;
  context.strokeText(text, x, y, options.maxWidth);

  context.fillStyle = options.fillColor ?? '#ffffff';
  context.fillText(text, x, y, options.maxWidth);

  if (options.innerShadow && typeof document !== 'undefined') {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = options.canvasSize.width;
    shadowCanvas.height = options.canvasSize.height;
    const shadowContext = shadowCanvas.getContext('2d');

    if (shadowContext) {
      shadowContext.font = context.font;
      shadowContext.textAlign = options.align;
      shadowContext.textBaseline = options.baseline ?? 'alphabetic';
      shadowContext.lineJoin = 'round';
      shadowContext.miterLimit = 2;
      shadowContext.fillStyle = getRgba(
        options.innerShadow.color,
        options.innerShadow.opacity,
      );
      shadowContext.fillText(text, x, y, options.maxWidth);
      shadowContext.globalCompositeOperation = 'destination-out';
      shadowContext.fillStyle = '#ffffff';
      shadowContext.fillText(
        text,
        x + options.innerShadow.offsetX,
        y + options.innerShadow.offsetY,
        options.maxWidth,
      );
      context.drawImage(shadowCanvas, 0, 0);
    }
  }

  context.restore();
};

export const useCanvasFonts = (
  fonts: ReadonlyArray<{ family: string; testSize?: number; url: string }>,
) => {
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let isCancelled = false;

    const loadFonts = async () => {
      try {
        const loadedFonts = await Promise.all(
          fonts.map(async (font) => {
            const fontFace = new FontFace(font.family, `url(${font.url})`);
            const loadedFont = await fontFace.load();
            return { ...font, loadedFont };
          }),
        );

        if (isCancelled) {
          return;
        }

        for (const font of loadedFonts) {
          document.fonts.add(font.loadedFont);
          await document.fonts.load(
            `${font.testSize ?? 64}px "${font.family}"`,
          );
        }

        if (!isCancelled) {
          setStatus('loaded');
        }
      } catch {
        if (!isCancelled) {
          setStatus('error');
        }
      }
    };

    setStatus('loading');
    void loadFonts();

    return () => {
      isCancelled = true;
    };
  }, [fonts]);

  return status;
};

export const useTemplateImages = <T extends string>(
  sources: Readonly<Record<T, string>>,
) => {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [images, setImages] = useState<Record<T, HTMLImageElement> | null>(
    null,
  );

  useEffect(() => {
    let isCancelled = false;

    const loadTemplateImages = async () => {
      try {
        const entries = Object.entries(sources) as Array<[T, string]>;
        const loadedEntries = await Promise.all(
          entries.map(async ([key, source]) => [key, await loadImage(source)]),
        );

        if (isCancelled) {
          return;
        }

        setImages(
          Object.fromEntries(loadedEntries) as Record<T, HTMLImageElement>,
        );
        setStatus('loaded');
      } catch {
        if (!isCancelled) {
          setImages(null);
          setStatus('error');
        }
      }
    };

    setStatus('loading');
    void loadTemplateImages();

    return () => {
      isCancelled = true;
    };
  }, [sources]);

  return { images, status };
};

export const useImageFileInput = (messages: {
  invalidType: string;
  loadFailed: string;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const clearImage = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    setImage(null);
    setName('');
    setError('');

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      setError('');

      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        setError(messages.invalidType);
        return;
      }

      const nextObjectUrl = URL.createObjectURL(file);
      const nextImage = new Image();

      nextImage.onload = () => {
        const previousObjectUrl = objectUrlRef.current;
        objectUrlRef.current = nextObjectUrl;
        if (previousObjectUrl) {
          URL.revokeObjectURL(previousObjectUrl);
        }

        setImage(nextImage);
        setName(file.name);
        setError('');
      };

      nextImage.onerror = () => {
        URL.revokeObjectURL(nextObjectUrl);
        setError(messages.loadFailed);
      };

      nextImage.decoding = 'async';
      nextImage.src = nextObjectUrl;
    },
    [messages.invalidType, messages.loadFailed],
  );

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    [],
  );

  return { clearImage, error, handleChange, image, inputRef, name };
};

export type ImageFileInputState = ReturnType<typeof useImageFileInput>;

export const DEFAULT_IMAGE_UPLOAD_MESSAGES = {
  invalidType: '이미지 파일만 업로드할 수 있습니다.',
  loadFailed: '이미지를 불러오지 못했습니다.',
} as const;

export const DEFAULT_CHARACTER_UPLOAD_MESSAGES = {
  invalidType: '이미지 파일만 업로드할 수 있습니다.',
  loadFailed: '캐릭터 이미지를 불러오지 못했습니다.',
} as const;

const FIELD_INPUT_CLASS =
  'h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300';

const FIELD_TEXTAREA_CLASS =
  'min-h-24 resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300';

type ThumbnailImageInputProps = {
  clearLabel?: string;
  id: string;
  input: ImageFileInputState;
  label: string;
  showClearButton?: boolean;
  variant?: 'primary' | 'secondary';
};

export const ThumbnailImageInput = ({
  clearLabel = '이미지 삭제',
  id,
  input,
  label,
  showClearButton = false,
  variant = 'primary',
}: ThumbnailImageInputProps) => {
  const labelClass =
    variant === 'primary'
      ? 'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200'
      : 'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-zinc-950 px-4 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:bg-zinc-900';

  return (
    <div>
      <div className={showClearButton ? 'flex gap-2' : undefined}>
        <label
          className={`${labelClass} ${showClearButton ? 'flex-1' : 'w-full'}`}
          htmlFor={id}
        >
          <ImagePlus className="h-4 w-4" />
          {label}
        </label>
        {showClearButton && input.image ? (
          <button
            aria-label={clearLabel}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-rose-300 hover:text-rose-200"
            onClick={input.clearImage}
            title={clearLabel}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input
        accept="image/*"
        className="sr-only"
        id={id}
        onChange={input.handleChange}
        ref={input.inputRef}
        type="file"
      />
      <p className="mt-2 truncate text-xs text-zinc-500">
        {input.name || '선택된 이미지 없음'}
      </p>
      {input.error ? (
        <p className="mt-2 text-sm text-rose-300">{input.error}</p>
      ) : null}
    </div>
  );
};

type ThumbnailTextInputProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>;

export const ThumbnailTextInput = ({
  label,
  onChange,
  value,
  ...inputProps
}: ThumbnailTextInputProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-zinc-300">{label}</span>
    <input
      className={FIELD_INPUT_CLASS}
      onChange={(event) => onChange(event.target.value)}
      type="text"
      value={value}
      {...inputProps}
    />
  </label>
);

type ThumbnailTextareaProps = {
  label: string;
  onChange: (value: string) => void;
  value: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>;

export const ThumbnailTextarea = ({
  label,
  onChange,
  value,
  ...textareaProps
}: ThumbnailTextareaProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-zinc-300">{label}</span>
    <textarea
      className={FIELD_TEXTAREA_CLASS}
      onChange={(event) => onChange(event.target.value)}
      value={value}
      {...textareaProps}
    />
  </label>
);

type ThumbnailCheckboxGroupOption = {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
};

type ThumbnailCheckboxGroupProps = {
  label: string;
  options: ThumbnailCheckboxGroupOption[];
};

const ThumbnailCheckboxGroup = ({
  label,
  options,
}: ThumbnailCheckboxGroupProps) => (
  <fieldset className="min-w-0 border-0 p-0">
    <legend className="mb-1.5 p-0 text-sm font-medium text-zinc-300">
      {label}
    </legend>
    <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-700 bg-zinc-950 p-2">
      {options.map((option) => (
        <label
          className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-amber-100"
          key={option.label}
        >
          <input
            checked={option.checked}
            className="h-4 w-4 accent-amber-300"
            onChange={(event) => option.onChange(event.target.checked)}
            type="checkbox"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

export const ThumbnailCharacterImageOptions = ({
  characterOutlineEnabled,
  characterRotation,
  characterShadowEnabled,
  onCharacterOutlineChange,
  onCharacterRotationChange,
  onCharacterRotationReset,
  onCharacterShadowChange,
}: {
  characterOutlineEnabled: boolean;
  characterRotation?: number;
  characterShadowEnabled: boolean;
  onCharacterOutlineChange: (value: boolean) => void;
  onCharacterRotationChange?: (value: number) => void;
  onCharacterRotationReset?: () => void;
  onCharacterShadowChange: (value: boolean) => void;
}) => {
  const hasRotationControl =
    characterRotation !== undefined && onCharacterRotationChange !== undefined;
  const normalizedRotation = normalizeCharacterRotation(characterRotation ?? 0);

  return (
    <div className="flex flex-col gap-3">
      <ThumbnailCheckboxGroup
        label="캐릭터 이미지 옵션"
        options={[
          {
            checked: characterOutlineEnabled,
            label: '테두리 적용',
            onChange: onCharacterOutlineChange,
          },
          {
            checked: characterShadowEnabled,
            label: '그림자 적용',
            onChange: onCharacterShadowChange,
          },
        ]}
      />

      {hasRotationControl ? (
        <fieldset className="min-w-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-sm font-medium text-zinc-300">
            캐릭터 회전
          </legend>
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-sm text-zinc-100">
                {normalizedRotation}°
              </span>
              <button
                aria-label="캐릭터 이미지 회전 초기화"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 transition hover:border-amber-300/70 hover:text-amber-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
                disabled={normalizedRotation === 0}
                onClick={() =>
                  onCharacterRotationReset
                    ? onCharacterRotationReset()
                    : onCharacterRotationChange(0)
                }
                title="회전 초기화"
                type="button"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <input
              aria-label="캐릭터 이미지 회전 각도"
              className="h-2 w-full accent-amber-300"
              max={CHARACTER_ROTATION_MAX}
              min={CHARACTER_ROTATION_MIN}
              onChange={(event) =>
                onCharacterRotationChange(Number(event.target.value))
              }
              step={CHARACTER_ROTATION_STEP}
              type="range"
              value={normalizedRotation}
            />
          </div>
        </fieldset>
      ) : null}
    </div>
  );
};

export const ThumbnailStatusMessage = ({
  children,
}: {
  children: ReactNode;
}) => (
  <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
    {children}
  </p>
);

export const ThumbnailDownloadButton = ({
  isLoading,
  isReady,
  onClick,
}: {
  isLoading: boolean;
  isReady: boolean;
  onClick: () => void;
}) => (
  <button
    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
    disabled={!isReady}
    onClick={onClick}
    type="button"
  >
    {isLoading ? (
      <Loader2 className="h-4 w-4 animate-spin" />
    ) : (
      <Download className="h-4 w-4" />
    )}
    PNG 다운로드
  </button>
);

export type CharacterResizeHandle =
  | 'bottom-left'
  | 'bottom-right'
  | 'top-left'
  | 'top-right';

type CharacterInteractionBase = {
  startBox: ImageBox;
  startPointerX: number;
  startPointerY: number;
};

type CharacterInteraction =
  | (CharacterInteractionBase & { mode: 'move' })
  | (CharacterInteractionBase & {
      mode: 'resize';
      resizeHandle: CharacterResizeHandle;
    });

const characterResizeHandles = [
  {
    ariaLabel: '캐릭터 이미지 왼쪽 위 크기 조절',
    className: '-left-2 -top-2 cursor-nwse-resize',
    position: 'top-left',
  },
  {
    ariaLabel: '캐릭터 이미지 오른쪽 위 크기 조절',
    className: '-right-2 -top-2 cursor-nesw-resize',
    position: 'top-right',
  },
  {
    ariaLabel: '캐릭터 이미지 왼쪽 아래 크기 조절',
    className: '-bottom-2 -left-2 cursor-nesw-resize',
    position: 'bottom-left',
  },
  {
    ariaLabel: '캐릭터 이미지 오른쪽 아래 크기 조절',
    className: '-bottom-2 -right-2 cursor-nwse-resize',
    position: 'bottom-right',
  },
] as const satisfies ReadonlyArray<{
  ariaLabel: string;
  className: string;
  position: CharacterResizeHandle;
}>;

const getCanvasPointerPosition = (
  event: PointerEvent<HTMLElement>,
  canvas: HTMLCanvasElement | null,
  canvasSize: CanvasSize,
) => {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: (event.clientX - rect.left) * (canvasSize.width / rect.width),
    y: (event.clientY - rect.top) * (canvasSize.height / rect.height),
  };
};

const getCharacterOutsideBoundsLimit = ({
  height,
  width,
}: {
  height: number;
  width: number;
}) => ({
  x: Math.max(0, width * CHARACTER_OUTSIDE_BOUNDS_RATIO),
  y: Math.max(0, height * CHARACTER_OUTSIDE_BOUNDS_RATIO),
});

const getImageBoxAspectRatio = (box: ImageBox) => {
  const aspectRatio = box.width / Math.max(box.height, 1);

  return Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
};

const getMaxCharacterWidth = (bounds: ImageBox, aspectRatio: number) =>
  Math.min(
    bounds.width * CHARACTER_MAX_BOUNDS_RATIO,
    bounds.height * CHARACTER_MAX_BOUNDS_RATIO * aspectRatio,
  );

const getMinCharacterWidth = (minSize: number, aspectRatio: number) =>
  Math.max(minSize, minSize * aspectRatio);

const clampImageBox = (
  box: ImageBox,
  bounds: ImageBox,
  minSize: number,
): ImageBox => {
  const aspectRatio = getImageBoxAspectRatio(box);
  const minWidth = getMinCharacterWidth(minSize, aspectRatio);
  const maxWidth = Math.max(
    minWidth,
    getMaxCharacterWidth(bounds, aspectRatio),
  );
  const width = clamp(box.width, minWidth, maxWidth);
  const height = width / aspectRatio;
  const outsideBoundsLimit = getCharacterOutsideBoundsLimit({ height, width });

  return {
    height,
    rotation: getCharacterRotation(box),
    width,
    x: clamp(
      box.x,
      bounds.x - outsideBoundsLimit.x,
      bounds.x + bounds.width - width + outsideBoundsLimit.x,
    ),
    y: clamp(
      box.y,
      bounds.y - outsideBoundsLimit.y,
      bounds.y + bounds.height - height + outsideBoundsLimit.y,
    ),
  };
};

const createDefaultImageBox = (
  image: HTMLImageElement,
  bounds: ImageBox,
  minSize: number,
): ImageBox => {
  const { height: sourceHeight, width: sourceWidth } =
    getImageNaturalSize(image);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { ...bounds, rotation: 0 };
  }

  const aspectRatio = sourceWidth / sourceHeight;
  const width = Math.min(bounds.height * aspectRatio, bounds.width);
  const height = width / aspectRatio;

  return clampImageBox(
    {
      height,
      width,
      x: bounds.x + bounds.width - width,
      y: bounds.y + bounds.height - height,
    },
    bounds,
    minSize,
  );
};

const resizeImageBox = (
  startBox: ImageBox,
  resizeHandle: CharacterResizeHandle,
  deltaX: number,
  deltaY: number,
  bounds: ImageBox,
  minSize: number,
): ImageBox => {
  const aspectRatio = getImageBoxAspectRatio(startBox);
  const isLeftHandle = resizeHandle.endsWith('left');
  const isTopHandle = resizeHandle.startsWith('top');
  const anchorX = isLeftHandle ? startBox.x + startBox.width : startBox.x;
  const anchorY = isTopHandle ? startBox.y + startBox.height : startBox.y;
  const widthFromHorizontal =
    startBox.width + (isLeftHandle ? -deltaX : deltaX);
  const widthFromVertical =
    (startBox.height + (isTopHandle ? -deltaY : deltaY)) * aspectRatio;
  const requestedWidth =
    Math.abs(widthFromHorizontal - startBox.width) >=
    Math.abs(widthFromVertical - startBox.width)
      ? widthFromHorizontal
      : widthFromVertical;
  const minWidth = getMinCharacterWidth(minSize, aspectRatio);
  const maxWidth = Math.max(
    minWidth,
    getMaxCharacterWidth(bounds, aspectRatio),
  );
  const width = clamp(requestedWidth, minWidth, maxWidth);
  const height = width / aspectRatio;

  return clampImageBox(
    {
      height,
      rotation: getCharacterRotation(startBox),
      width,
      x: isLeftHandle ? anchorX - width : anchorX,
      y: isTopHandle ? anchorY - height : anchorY,
    },
    bounds,
    minSize,
  );
};

export const useCharacterLayer = ({
  bounds,
  canvasRef,
  canvasSize,
  image,
  minSize = 80,
}: {
  bounds: ImageBox;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasSize: CanvasSize;
  image: HTMLImageElement | null;
  minSize?: number;
}) => {
  const interactionRef = useRef<CharacterInteraction | null>(null);
  const [box, setBox] = useState<ImageBox | null>(null);

  useEffect(() => {
    interactionRef.current = null;
    setBox(image ? createDefaultImageBox(image, bounds, minSize) : null);
  }, [bounds, image, minSize]);

  const startInteraction = useCallback(
    (
      mode: CharacterInteraction['mode'],
      event: PointerEvent<HTMLElement>,
      resizeHandle?: CharacterResizeHandle,
    ) => {
      const pointerPosition = getCanvasPointerPosition(
        event,
        canvasRef.current,
        canvasSize,
      );
      if (!pointerPosition || !box) {
        return;
      }

      const baseInteraction = {
        startBox: box,
        startPointerX: pointerPosition.x,
        startPointerY: pointerPosition.y,
      };

      if (mode === 'resize') {
        if (!resizeHandle) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        interactionRef.current = { ...baseInteraction, mode, resizeHandle };
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      interactionRef.current = { ...baseInteraction, mode };
    },
    [box, canvasRef, canvasSize],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const interaction = interactionRef.current;
      const pointerPosition = getCanvasPointerPosition(
        event,
        canvasRef.current,
        canvasSize,
      );
      if (!interaction || !pointerPosition) {
        return;
      }

      event.preventDefault();
      const deltaX = pointerPosition.x - interaction.startPointerX;
      const deltaY = pointerPosition.y - interaction.startPointerY;

      if (interaction.mode === 'move') {
        setBox(
          clampImageBox(
            {
              ...interaction.startBox,
              x: interaction.startBox.x + deltaX,
              y: interaction.startBox.y + deltaY,
            },
            bounds,
            minSize,
          ),
        );
        return;
      }

      setBox(
        resizeImageBox(
          interaction.startBox,
          interaction.resizeHandle,
          deltaX,
          deltaY,
          bounds,
          minSize,
        ),
      );
    },
    [bounds, canvasRef, canvasSize, minSize],
  );

  const finishInteraction = useCallback((event: PointerEvent<HTMLElement>) => {
    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const setRotation = useCallback((rotation: number) => {
    setBox((currentBox) =>
      currentBox
        ? { ...currentBox, rotation: normalizeCharacterRotation(rotation) }
        : currentBox,
    );
  }, []);

  const resetRotation = useCallback(() => {
    setRotation(0);
  }, [setRotation]);

  return {
    box,
    finishInteraction,
    handlePointerMove,
    resetRotation,
    rotation: normalizeCharacterRotation(box?.rotation ?? 0),
    setRotation,
    startInteraction,
  };
};

export const CharacterSelectionOverlay = ({
  box,
  canvasSize,
  finishInteraction,
  handlePointerMove,
  startInteraction,
}: {
  box: ImageBox;
  canvasSize: CanvasSize;
  finishInteraction: (event: PointerEvent<HTMLElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLElement>) => void;
  startInteraction: (
    mode: CharacterInteraction['mode'],
    event: PointerEvent<HTMLElement>,
    resizeHandle?: CharacterResizeHandle,
  ) => void;
}) => (
  <div
    aria-label="캐릭터 이미지 위치"
    className="absolute touch-none border-2 border-amber-300/90 shadow-[0_0_0_1px_rgba(24,24,27,0.8)]"
    onPointerCancel={finishInteraction}
    onPointerDown={(event) => startInteraction('move', event)}
    onPointerMove={handlePointerMove}
    onPointerUp={finishInteraction}
    role="presentation"
    style={{
      height: `${(box.height / canvasSize.height) * 100}%`,
      left: `${(box.x / canvasSize.width) * 100}%`,
      top: `${(box.y / canvasSize.height) * 100}%`,
      transform: `rotate(${getCharacterRotation(box)}deg)`,
      transformOrigin: 'center',
      width: `${(box.width / canvasSize.width) * 100}%`,
    }}
  >
    {characterResizeHandles.map((handle) => (
      <button
        aria-label={handle.ariaLabel}
        className={`${handle.className} absolute h-4 w-4 rounded-full border border-zinc-950 bg-amber-300`}
        key={handle.position}
        onPointerCancel={finishInteraction}
        onPointerDown={(event) =>
          startInteraction('resize', event, handle.position)
        }
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        type="button"
      />
    ))}
  </div>
);

type CharacterLayerSelection = Pick<
  ReturnType<typeof useCharacterLayer>,
  'finishInteraction' | 'handlePointerMove' | 'startInteraction'
>;

export const ThumbnailCanvasPreview = ({
  canvasRef,
  canvasSize,
  characterBox,
  characterControls,
  isLoading,
  isReady,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  canvasSize: CanvasSize;
  characterBox: ImageBox | null;
  characterControls: CharacterLayerSelection;
  isLoading: boolean;
  isReady: boolean;
}) => (
  <div className="relative bg-zinc-950">
    <div className="relative overflow-hidden rounded-md bg-zinc-950">
      <canvas
        aria-label="썸네일 미리보기"
        className="block h-auto w-full"
        height={canvasSize.height}
        ref={canvasRef}
        width={canvasSize.width}
      />
      {!isReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-sm text-zinc-300">
          {isLoading ? '템플릿 로딩 중...' : '템플릿 로딩 실패'}
        </div>
      ) : null}
    </div>
    {characterBox ? (
      <CharacterSelectionOverlay
        box={characterBox}
        canvasSize={canvasSize}
        finishInteraction={characterControls.finishInteraction}
        handlePointerMove={characterControls.handlePointerMove}
        startInteraction={characterControls.startInteraction}
      />
    ) : null}
  </div>
);

export const Route = createFileRoute('/tools/soopthumbnail/')({
  beforeLoad: () => {
    throw Route.redirect({
      replace: true,
      to: '/tools/soopthumbnail/dlsn9911',
    });
  },
  component: () => null,
});
