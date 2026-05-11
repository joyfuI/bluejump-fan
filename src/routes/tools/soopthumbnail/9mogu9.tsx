/**
 * SOOP Thumbnail tool context (update this block whenever behavior changes):
 * - This route renders the browser-only canvas editor for the `모구구`
 *   template. Shared route shell, tab metadata, and the base
 *   `/tools/soopthumbnail` redirect live in sibling `index.tsx`; keep future
 *   template navigation changes there and PSD/canvas-specific changes here.
 * - Current route/template id is `9mogu9`, matching
 *   `/tools/soopthumbnail/9mogu9`. When adding thumbnail types, create sibling
 *   route files and add their tab entries to `soopThumbnailTemplates` in
 *   `index.tsx`.
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
 *   the PSD shadow size instead of the black stroke width. Inner shadow uses
 *   a subtractive shifted text mask; the offset is intentionally opposite the
 *   visible shadow direction because the shifted mask is removed from the
 *   original glyph mask.
 * - Font policy is strict: text rendering must use `/fonts/Jalnan2.otf` through
 *   the `FontFace` API. There is no fallback font path; if the font fails to
 *   load, preview/download stay disabled.
 * - The default date is set on client mount, not during prerender, so static
 *   build output does not freeze the "today" value.
 * - Background images use automatic centered cover-crop only. User-controlled
 *   drag/zoom, JPG export, and PSD upload/parsing are intentionally out of
 *   scope for this version.
 * - Character uploads are a separate interactive canvas layer. They default to
 *   the frame height and bottom-right corner, are drawn after the background
 *   image and before the PSD panel/text, and are edited with a DOM selection
 *   overlay plus four corner resize handles. The user can clear this layer
 *   entirely; resize/delete UI never appears in the exported PNG.
 */

import { createFileRoute } from '@tanstack/react-router';
import { Download, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import {
  type ChangeEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type SoopThumbnailTemplateId, SoopThumbnailToolLayout } from './index';

const SOOP_THUMBNAIL_TEMPLATE_ID = '9mogu9' satisfies SoopThumbnailTemplateId;
type FontStatus = 'loading' | 'loaded' | 'error';
type AssetStatus = 'loading' | 'loaded' | 'error';

type RenderOptions = {
  backgroundImage: HTMLImageElement | null;
  characterBox: ImageBox | null;
  characterImage: HTMLImageElement | null;
  darkPanelImage: HTMLImageElement;
  dateText: string;
  dateBarImage: HTMLImageElement;
  firstText: string;
  frameImage: HTMLImageElement;
  leftSkullImage: HTMLImageElement;
  rightSkullImage: HTMLImageElement;
  secondText: string;
};

type ImageBox = { height: number; width: number; x: number; y: number };

type CharacterResizeHandle =
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

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const FONT_FAMILY = 'SoopThumbnailJalnan2';
const FONT_URL = '/fonts/Jalnan2.otf';
const TEMPLATE_ASSET_BASE_URL = '/assets/9mogu9';
const DARK_PANEL_IMAGE_URL = `${TEMPLATE_ASSET_BASE_URL}/dark_gradient.png`;
const DATE_BAR_IMAGE_URL = `${TEMPLATE_ASSET_BASE_URL}/date_bar.png`;
const FRAME_IMAGE_URL = `${TEMPLATE_ASSET_BASE_URL}/frame.png`;
const LEFT_SKULL_IMAGE_URL = `${TEMPLATE_ASSET_BASE_URL}/left_skull.png`;
const RIGHT_SKULL_IMAGE_URL = `${TEMPLATE_ASSET_BASE_URL}/right_skull.png`;
const TEMPLATE_EMPTY_INNER_BACKGROUND = '#ffffff';
const TEXT_SHADOW_GOLD = '#ffe8a2';
const TEXT_INNER_SHADOW = '#3b3b3b';

const FRAME = { height: 1044, radius: 44, width: 1884, x: 18, y: 18 };
const DARK_PANEL = { x: -33, y: 496 };
const DATE_BAR = { x: 42, y: 610 };
const LEFT_SKULL = { x: 145, y: 624 };
const RIGHT_SKULL = { x: 608, y: 625 };
const CHARACTER_MIN_SIZE = 80;
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

const DEFAULT_FIRST_TEXT = '#첫번째텍스트';
const DEFAULT_SECOND_TEXT = '#두번째텍스트';
const TITLE_DROP_SHADOW = {
  blur: 0,
  offsetX: 4,
  offsetY: 8,
  opacity: 0.63,
  strokeWidth: 12,
} as const;
const TITLE_INNER_SHADOW = { offsetX: 8, offsetY: -3, opacity: 0.22 } as const;
const DATE_INNER_SHADOW = { offsetX: 3, offsetY: -1, opacity: 0.15 } as const;

const padDatePart = (value: number) => String(value).padStart(2, '0');

const formatTodayDate = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join('.');
};

const getDownloadDate = (dateText: string) => {
  const digits = dateText.replace(/\D/g, '');
  return digits.length > 0 ? digits : 'date';
};

const getRgba = (hexColor: string, opacity: number) => {
  const normalizedColor = hexColor.replace('#', '');
  const red = Number.parseInt(normalizedColor.slice(0, 2), 16);
  const green = Number.parseInt(normalizedColor.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedColor.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getImageNaturalSize = (image: HTMLImageElement) => ({
  height: image.naturalHeight || image.height,
  width: image.naturalWidth || image.width,
});

const clampCharacterBox = (box: ImageBox): ImageBox => {
  const width = clamp(box.width, CHARACTER_MIN_SIZE, FRAME.width);
  const height = clamp(box.height, CHARACTER_MIN_SIZE, FRAME.height);

  return {
    height,
    width,
    x: clamp(box.x, FRAME.x, FRAME.x + FRAME.width - width),
    y: clamp(box.y, FRAME.y, FRAME.y + FRAME.height - height),
  };
};

const createDefaultCharacterBox = (image: HTMLImageElement): ImageBox => {
  const { height: sourceHeight, width: sourceWidth } =
    getImageNaturalSize(image);

  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { height: FRAME.height, width: FRAME.width, x: FRAME.x, y: FRAME.y };
  }

  const aspectRatio = sourceWidth / sourceHeight;
  const width = Math.min(FRAME.height * aspectRatio, FRAME.width);
  const height = width / aspectRatio;

  return clampCharacterBox({
    height,
    width,
    x: FRAME.x + FRAME.width - width,
    y: FRAME.y + FRAME.height - height,
  });
};

const resizeCharacterBox = (
  startBox: ImageBox,
  resizeHandle: CharacterResizeHandle,
  deltaX: number,
  deltaY: number,
): ImageBox => {
  const aspectRatio = startBox.width / Math.max(startBox.height, 1);
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
  const maxWidthByX = isLeftHandle
    ? anchorX - FRAME.x
    : FRAME.x + FRAME.width - anchorX;
  const maxHeightByY = isTopHandle
    ? anchorY - FRAME.y
    : FRAME.y + FRAME.height - anchorY;
  const maxWidth = Math.max(
    CHARACTER_MIN_SIZE,
    Math.min(maxWidthByX, maxHeightByY * aspectRatio),
  );
  const width = clamp(requestedWidth, CHARACTER_MIN_SIZE, maxWidth);
  const height = width / aspectRatio;

  return {
    height,
    width,
    x: isLeftHandle ? anchorX - width : anchorX,
    y: isTopHandle ? anchorY - height : anchorY,
  };
};

const getCanvasPointerPosition = (
  event: PointerEvent<HTMLElement>,
  canvas: HTMLCanvasElement | null,
) => {
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
    y: (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
  };
};

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${source}`));
    image.decoding = 'async';
    image.src = source;
  });

const buildRoundedRectPath = (
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

const drawCoverImage = (
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

const fitFontSize = (
  context: CanvasRenderingContext2D,
  text: string,
  startSize: number,
  minSize: number,
  maxWidth: number,
) => {
  let size = startSize;
  while (size > minSize) {
    context.font = `${size}px "${FONT_FAMILY}"`;
    if (context.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 2;
  }
  return size;
};

const drawOutlinedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    dropShadow?: {
      blur: number;
      offsetX: number;
      offsetY: number;
      opacity: number;
      strokeWidth: number;
    };
    fontSize: number;
    innerShadow?: { offsetX: number; offsetY: number; opacity: number };
    maxWidth: number;
    outerStrokeWidth: number;
  },
) => {
  if (!text) {
    return;
  }

  context.save();
  context.font = `${options.fontSize}px "${FONT_FAMILY}"`;
  context.textAlign = options.align;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.miterLimit = 2;

  if (options.dropShadow) {
    context.save();
    context.globalAlpha = options.dropShadow.opacity;
    context.filter = `blur(${options.dropShadow.blur}px)`;
    context.strokeStyle = TEXT_SHADOW_GOLD;
    context.fillStyle = TEXT_SHADOW_GOLD;
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

  context.strokeStyle = '#050505';
  context.lineWidth = options.outerStrokeWidth;
  context.strokeText(text, x, y, options.maxWidth);

  context.fillStyle = '#ffffff';
  context.fillText(text, x, y, options.maxWidth);

  if (options.innerShadow && typeof document !== 'undefined') {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = CANVAS_WIDTH;
    shadowCanvas.height = CANVAS_HEIGHT;
    const shadowContext = shadowCanvas.getContext('2d');

    if (shadowContext) {
      shadowContext.font = context.font;
      shadowContext.textAlign = options.align;
      shadowContext.textBaseline = 'alphabetic';
      shadowContext.lineJoin = 'round';
      shadowContext.miterLimit = 2;
      shadowContext.fillStyle = getRgba(
        TEXT_INNER_SHADOW,
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

const drawMoguguTemplate = (
  context: CanvasRenderingContext2D,
  options: RenderOptions,
) => {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

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
  context.fillStyle = TEMPLATE_EMPTY_INNER_BACKGROUND;
  context.fillRect(FRAME.x, FRAME.y, FRAME.width, FRAME.height);
  if (options.backgroundImage) {
    drawCoverImage(
      context,
      options.backgroundImage,
      FRAME.x,
      FRAME.y,
      FRAME.width,
      FRAME.height,
    );
  }
  if (options.characterImage && options.characterBox) {
    context.drawImage(
      options.characterImage,
      options.characterBox.x,
      options.characterBox.y,
      options.characterBox.width,
      options.characterBox.height,
    );
  }

  context.drawImage(options.darkPanelImage, DARK_PANEL.x, DARK_PANEL.y);
  context.drawImage(options.dateBarImage, DATE_BAR.x, DATE_BAR.y);
  context.restore();

  const dateFontSize = fitFontSize(context, options.dateText, 58, 38, 370);
  drawOutlinedText(context, options.dateText, 409, 676, {
    align: 'center',
    fontSize: dateFontSize,
    innerShadow: DATE_INNER_SHADOW,
    maxWidth: 370,
    outerStrokeWidth: 12,
  });

  context.drawImage(options.leftSkullImage, LEFT_SKULL.x, LEFT_SKULL.y);
  context.drawImage(options.rightSkullImage, RIGHT_SKULL.x, RIGHT_SKULL.y);

  const firstFontSize = fitFontSize(context, options.firstText, 118, 72, 1760);
  drawOutlinedText(context, options.firstText, 78, 826, {
    align: 'left',
    dropShadow: TITLE_DROP_SHADOW,
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
  );
  drawOutlinedText(context, options.secondText, 78, 972, {
    align: 'left',
    dropShadow: TITLE_DROP_SHADOW,
    fontSize: secondFontSize,
    innerShadow: TITLE_INNER_SHADOW,
    maxWidth: 1760,
    outerStrokeWidth: 18,
  });

  context.drawImage(options.frameImage, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
};

const renderThumbnail = (canvas: HTMLCanvasElement, options: RenderOptions) => {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  drawMoguguTemplate(context, options);
};

const RouteComponent = () => {
  const backgroundInputId = useId();
  const characterInputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const characterInputRef = useRef<HTMLInputElement | null>(null);
  const backgroundObjectUrlRef = useRef<string | null>(null);
  const characterObjectUrlRef = useRef<string | null>(null);
  const characterInteractionRef = useRef<CharacterInteraction | null>(null);

  const [fontStatus, setFontStatus] = useState<FontStatus>('loading');
  const [assetStatus, setAssetStatus] = useState<AssetStatus>('loading');
  const [darkPanelImage, setDarkPanelImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [dateBarImage, setDateBarImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [leftSkullImage, setLeftSkullImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [rightSkullImage, setRightSkullImage] =
    useState<HTMLImageElement | null>(null);
  const [dateText, setDateText] = useState('');
  const [firstText, setFirstText] = useState(DEFAULT_FIRST_TEXT);
  const [secondText, setSecondText] = useState(DEFAULT_SECOND_TEXT);
  const [backgroundImage, setBackgroundImage] =
    useState<HTMLImageElement | null>(null);
  const [backgroundName, setBackgroundName] = useState('');
  const [characterImage, setCharacterImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [characterBox, setCharacterBox] = useState<ImageBox | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [imageError, setImageError] = useState('');
  const [characterError, setCharacterError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const downloadFileName = useMemo(
    () =>
      `soop-thumbnail-${SOOP_THUMBNAIL_TEMPLATE_ID}-${getDownloadDate(dateText)}.png`,
    [dateText],
  );

  const isReady =
    fontStatus === 'loaded' &&
    assetStatus === 'loaded' &&
    darkPanelImage !== null &&
    dateBarImage !== null &&
    frameImage !== null &&
    leftSkullImage !== null &&
    rightSkullImage !== null;

  useEffect(() => {
    setDateText(formatTodayDate());
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadFont = async () => {
      try {
        const font = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
        const loadedFont = await font.load();
        if (isCancelled) {
          return;
        }

        document.fonts.add(loadedFont);
        await document.fonts.load(`64px "${FONT_FAMILY}"`);
        if (!isCancelled) {
          setFontStatus('loaded');
        }
      } catch {
        if (!isCancelled) {
          setFontStatus('error');
        }
      }
    };

    void loadFont();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadTemplateAssets = async () => {
      try {
        const [
          loadedDarkPanelImage,
          loadedDateBarImage,
          loadedFrameImage,
          loadedLeftSkullImage,
          loadedRightSkullImage,
        ] = await Promise.all([
          loadImage(DARK_PANEL_IMAGE_URL),
          loadImage(DATE_BAR_IMAGE_URL),
          loadImage(FRAME_IMAGE_URL),
          loadImage(LEFT_SKULL_IMAGE_URL),
          loadImage(RIGHT_SKULL_IMAGE_URL),
        ]);
        if (isCancelled) {
          return;
        }

        setDarkPanelImage(loadedDarkPanelImage);
        setDateBarImage(loadedDateBarImage);
        setFrameImage(loadedFrameImage);
        setLeftSkullImage(loadedLeftSkullImage);
        setRightSkullImage(loadedRightSkullImage);
        setAssetStatus('loaded');
      } catch {
        if (!isCancelled) {
          setAssetStatus('error');
        }
      }
    };

    void loadTemplateAssets();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      if (backgroundObjectUrlRef.current) {
        URL.revokeObjectURL(backgroundObjectUrlRef.current);
      }
      if (characterObjectUrlRef.current) {
        URL.revokeObjectURL(characterObjectUrlRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (
      !isReady ||
      !canvasRef.current ||
      !darkPanelImage ||
      !dateBarImage ||
      !frameImage ||
      !leftSkullImage ||
      !rightSkullImage
    ) {
      return;
    }

    renderThumbnail(canvasRef.current, {
      backgroundImage,
      characterBox,
      characterImage,
      darkPanelImage,
      dateText,
      dateBarImage,
      firstText,
      frameImage,
      leftSkullImage,
      rightSkullImage,
      secondText,
    });
  }, [
    backgroundImage,
    characterBox,
    characterImage,
    darkPanelImage,
    dateText,
    dateBarImage,
    firstText,
    frameImage,
    isReady,
    leftSkullImage,
    rightSkullImage,
    secondText,
  ]);

  const handleBackgroundChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setImageError('');

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const previousObjectUrl = backgroundObjectUrlRef.current;
      backgroundObjectUrlRef.current = nextObjectUrl;
      if (previousObjectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }

      setBackgroundImage(image);
      setBackgroundName(file.name);
      setImageError('');
    };

    image.onerror = () => {
      URL.revokeObjectURL(nextObjectUrl);
      setImageError('이미지를 불러오지 못했습니다.');
    };

    image.decoding = 'async';
    image.src = nextObjectUrl;
  };

  const handleCharacterChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    setCharacterError('');

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setCharacterError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const previousObjectUrl = characterObjectUrlRef.current;
      characterObjectUrlRef.current = nextObjectUrl;
      if (previousObjectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }

      setCharacterImage(image);
      setCharacterBox(createDefaultCharacterBox(image));
      setCharacterName(file.name);
      setCharacterError('');
    };

    image.onerror = () => {
      URL.revokeObjectURL(nextObjectUrl);
      setCharacterError('캐릭터 이미지를 불러오지 못했습니다.');
    };

    image.decoding = 'async';
    image.src = nextObjectUrl;
  };

  const clearCharacterImage = () => {
    if (characterObjectUrlRef.current) {
      URL.revokeObjectURL(characterObjectUrlRef.current);
      characterObjectUrlRef.current = null;
    }

    characterInteractionRef.current = null;
    setCharacterImage(null);
    setCharacterBox(null);
    setCharacterName('');
    setCharacterError('');

    if (characterInputRef.current) {
      characterInputRef.current.value = '';
    }
  };

  const startCharacterInteraction = (
    mode: CharacterInteraction['mode'],
    event: PointerEvent<HTMLElement>,
    resizeHandle?: CharacterResizeHandle,
  ) => {
    const pointerPosition = getCanvasPointerPosition(event, canvasRef.current);
    if (!pointerPosition || !characterBox) {
      return;
    }

    const baseInteraction = {
      startBox: characterBox,
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
      characterInteractionRef.current = {
        ...baseInteraction,
        mode,
        resizeHandle,
      };
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    characterInteractionRef.current = { ...baseInteraction, mode };
  };

  const handleCharacterPointerMove = (event: PointerEvent<HTMLElement>) => {
    const interaction = characterInteractionRef.current;
    const pointerPosition = getCanvasPointerPosition(event, canvasRef.current);
    if (!interaction || !pointerPosition) {
      return;
    }

    event.preventDefault();
    const deltaX = pointerPosition.x - interaction.startPointerX;
    const deltaY = pointerPosition.y - interaction.startPointerY;

    if (interaction.mode === 'move') {
      setCharacterBox(
        clampCharacterBox({
          ...interaction.startBox,
          x: interaction.startBox.x + deltaX,
          y: interaction.startBox.y + deltaY,
        }),
      );
      return;
    }

    setCharacterBox(
      resizeCharacterBox(
        interaction.startBox,
        interaction.resizeHandle,
        deltaX,
        deltaY,
      ),
    );
  };

  const finishCharacterInteraction = (event: PointerEvent<HTMLElement>) => {
    characterInteractionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      !isReady ||
      !darkPanelImage ||
      !dateBarImage ||
      !frameImage ||
      !leftSkullImage ||
      !rightSkullImage
    ) {
      return;
    }

    setDownloadError('');
    renderThumbnail(canvas, {
      backgroundImage,
      characterBox,
      characterImage,
      darkPanelImage,
      dateText,
      dateBarImage,
      firstText,
      frameImage,
      leftSkullImage,
      rightSkullImage,
      secondText,
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        setDownloadError('PNG 파일을 만들지 못했습니다.');
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadFileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }, 'image/png');
  };

  return (
    <SoopThumbnailToolLayout
      activeTemplateId={SOOP_THUMBNAIL_TEMPLATE_ID}
      controls={
        <div className="flex flex-col gap-4">
          <div>
            <label
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
              htmlFor={backgroundInputId}
            >
              <ImagePlus className="h-4 w-4" />
              배경 이미지
            </label>
            <input
              accept="image/*"
              className="sr-only"
              id={backgroundInputId}
              onChange={handleBackgroundChange}
              type="file"
            />
            <p className="mt-2 truncate text-xs text-zinc-500">
              {backgroundName || '선택된 이미지 없음'}
            </p>
            {imageError ? (
              <p className="mt-2 text-sm text-rose-300">{imageError}</p>
            ) : null}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-300">날짜</span>
            <input
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300"
              onChange={(event) => setDateText(event.target.value)}
              type="text"
              value={dateText}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-300">
              첫 번째 텍스트
            </span>
            <input
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300"
              onChange={(event) => setFirstText(event.target.value)}
              type="text"
              value={firstText}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-300">
              두 번째 텍스트
            </span>
            <input
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-300"
              onChange={(event) => setSecondText(event.target.value)}
              type="text"
              value={secondText}
            />
          </label>

          <div>
            <div className="flex gap-2">
              <label
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-300/60 bg-zinc-950 px-4 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:bg-zinc-900"
                htmlFor={characterInputId}
              >
                <ImagePlus className="h-4 w-4" />
                캐릭터 이미지
              </label>
              {characterImage ? (
                <button
                  aria-label="캐릭터 이미지 삭제"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-rose-300 hover:text-rose-200"
                  onClick={clearCharacterImage}
                  title="캐릭터 이미지 삭제"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <input
              accept="image/*"
              className="sr-only"
              id={characterInputId}
              onChange={handleCharacterChange}
              ref={characterInputRef}
              type="file"
            />
            <p className="mt-2 truncate text-xs text-zinc-500">
              {characterName || '선택된 캐릭터 없음'}
            </p>
            {characterError ? (
              <p className="mt-2 text-sm text-rose-300">{characterError}</p>
            ) : null}
          </div>

          {fontStatus === 'error' ? (
            <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
              Jalnan2.otf를 불러오지 못했습니다.
            </p>
          ) : null}

          {assetStatus === 'error' ? (
            <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
              PSD 템플릿 에셋을 불러오지 못했습니다.
            </p>
          ) : null}

          {downloadError ? (
            <p className="rounded-lg border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
              {downloadError}
            </p>
          ) : null}

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            disabled={!isReady}
            onClick={handleDownload}
            type="button"
          >
            {fontStatus === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PNG 다운로드
          </button>
        </div>
      }
      preview={
        <div className="relative overflow-hidden rounded-md bg-zinc-950">
          <canvas
            aria-label="썸네일 미리보기"
            className="block aspect-video h-auto w-full"
            height={CANVAS_HEIGHT}
            ref={canvasRef}
            width={CANVAS_WIDTH}
          />
          {characterImage && characterBox ? (
            <div
              aria-label="캐릭터 이미지 위치"
              className="absolute touch-none border-2 border-amber-300/90 shadow-[0_0_0_1px_rgba(24,24,27,0.8)]"
              onPointerCancel={finishCharacterInteraction}
              onPointerDown={(event) =>
                startCharacterInteraction('move', event)
              }
              onPointerMove={handleCharacterPointerMove}
              onPointerUp={finishCharacterInteraction}
              role="presentation"
              style={{
                height: `${(characterBox.height / CANVAS_HEIGHT) * 100}%`,
                left: `${(characterBox.x / CANVAS_WIDTH) * 100}%`,
                top: `${(characterBox.y / CANVAS_HEIGHT) * 100}%`,
                width: `${(characterBox.width / CANVAS_WIDTH) * 100}%`,
              }}
            >
              {characterResizeHandles.map((handle) => (
                <button
                  aria-label={handle.ariaLabel}
                  className={`${handle.className} absolute h-4 w-4 rounded-full border border-zinc-950 bg-amber-300`}
                  key={handle.position}
                  onPointerCancel={finishCharacterInteraction}
                  onPointerDown={(event) =>
                    startCharacterInteraction('resize', event, handle.position)
                  }
                  onPointerMove={handleCharacterPointerMove}
                  onPointerUp={finishCharacterInteraction}
                  type="button"
                />
              ))}
            </div>
          ) : null}
          {!isReady ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-sm text-zinc-300">
              {fontStatus === 'loading' || assetStatus === 'loading'
                ? '템플릿 로딩 중...'
                : '템플릿 로딩 실패'}
            </div>
          ) : null}
        </div>
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
