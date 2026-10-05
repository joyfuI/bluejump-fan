/**
 * SOOP 제갈금자 썸네일 맥락 (관련 동작을 바꾸면 이 주석도 갱신):
 * - /tools/soopthumbnail/dlsn9911의 브라우저 Canvas 편집기다. 공통 편집·로딩·
 *   미리보기·다운로드는 형제 index.tsx를 사용하고 PSD별 좌표·문자 효과·줄 배치는 여기 둔다.
 * - 1365×768 PSD를 기준으로 일반은 /assets/dlsn9911/frame.png,
 *   구플은 /assets/dlsn9911/frame_plus.png를 쓴다. 테두리·날짜 탭은 이 PNG가 기준이며
 *   Canvas 도형으로 재현하지 않는다. 원본 PSD·검증 PNG는 저장소 외부 자료다.
 * - 기존 PSD 대조 기록: 제목(일반) 영역은 약 (70,637)~(697,730),
 *   제목(구플)은 (74,630)~(608,728), 날짜는 (985,29)~(1288,81)이다.
 *   원본 날짜는 FontSize 65, FauxBold, HorizontalScale 0.9, Tracking -10,
 *   FrFX 외곽선(outside/solid/normal, 100%, 5px, RGB(18,14,14))이었다.
 *   실제 Canvas 값은 검증 PNG에 맞춘 보정값이다. 합성 볼드가 너무 두꺼워 날짜는
 *   일반 채움·두꺼운 중앙 외곽선을 쓰며, 날짜 탭 왼쪽에 고정해 입력이 오른쪽으로 늘어나게 한다.
 * - 일반 제목은 검정 외곽선·Hard Light 외부 광선과 빨간 오프셋 문자를 쓴다.
 *   빨간 문자는 검증 PNG의 채워진 그림자 덩어리를 재현하려고 외곽선만이 아닌 채움으로 그린다.
 *   구플 제목 그림자의 원본은 normal, RGB(240,255,0), 100%, 각도 136,
 *   거리 12, 크기 16이었다. Canvas의 색·불투명도·블러는 시각적으로 보정했으므로
 *   PSD 수치로 단순 치환하지 않는다. 구플에도 Hard Light 외부 광선을 적용한다.
 * - 제목 폰트는 /fonts/hakgyoansim_allimjang-b.otf, 날짜는
 *   /fonts/hakgyoansim_byeoljari-l.otf다. 두 폰트와 두 프레임을 모두 로드해야
 *   미리보기·다운로드를 허용한다. 캐릭터 그림자는 기본 적용, 테두리는 기본 해제다.
 * - 배경 미업로드 시 내부는 흰색이며 업로드 배경은 둥근 내부 영역에 중앙 cover로 채운다.
 *   배경·캐릭터 → 프레임 → 모든 제목 그림자 → 모든 제목 외곽선·채움 → 날짜 순서로 그린다.
 * - 제목은 명시한 줄바꿈만 사용하며 자동 줄바꿈하지 않는다. 빈 줄은 버리고,
 *   3줄 이상이면 첫 줄을 유지하고 나머지를 구분자 없이 둘째 줄에 이어 붙인다.
 *   긴 줄은 최소 글꼴 크기까지 축소하며, 그 이후에도 넘치면 추가 압축·자르기는 하지 않는다.
 *   빈 제목은 표시하지 않는다.
 * - 제목의 블러 그림자·광선은 임시 레이어에서 최종 글자·외곽선 영역을 제거한 뒤 합성한다.
 *   흰색 글자 안이 물들지 않도록 전체 줄의 그림자를 먼저, 외곽선·채움을 나중에 그린다.
 */

import { createFileRoute } from '@tanstack/react-router';
import {
  type ChangeEvent,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildRoundedRectPath,
  type CanvasSize,
  DEFAULT_CHARACTER_UPLOAD_MESSAGES,
  DEFAULT_IMAGE_UPLOAD_MESSAGES,
  drawEditableImageLayers,
  drawFullCanvasImage,
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

const TEMPLATE_TYPE_OPTIONS = [
  { label: '일반', value: 'normal' },
  { label: '구플', value: 'plus' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: Dlsn9911TemplateType;
}>;

const isDlsn9911TemplateType = (value: string): value is Dlsn9911TemplateType =>
  TEMPLATE_TYPE_OPTIONS.some((option) => option.value === value);

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

  drawFullCanvasImage(context, options.frameImage, CANVAS_SIZE);

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
  const handleTemplateTypeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      if (isDlsn9911TemplateType(value)) {
        setTemplateType(value);
      }
    },
    [],
  );
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
              {TEMPLATE_TYPE_OPTIONS.map((option) => (
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
                    onChange={handleTemplateTypeChange}
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
