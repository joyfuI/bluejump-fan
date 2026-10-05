/**
 * SOOP 하로하 썸네일 맥락 (관련 동작을 바꾸면 이 주석도 갱신):
 * - /tools/soopthumbnail/haroha의 브라우저 Canvas 편집기다. 공통 편집·로딩·
 *   미리보기·다운로드는 형제 index.tsx를 사용하고 PSD별 좌표·문자 효과·그리기 순서는 여기 둔다.
 * - 1920×1080 PSD를 기준으로 한다. /assets/haroha/frame.png가 갈색 외곽,
 *   오른쪽 위 날짜 탭, 아래쪽 어두운 그라데이션의 기준이며 Canvas 도형으로 재현하지 않는다.
 *   PSD의 예시 캐릭터는 검증용일 뿐 출력에 넣지 않는다. 배경·캐릭터는 사용자 업로드로 받는다.
 * - 날짜는 /fonts/s-core_dream8.otf(PSD의 S-CoreDream-8Heavy),
 *   제목·태그는 /fonts/s-core_dream9.otf(S-CoreDream-9Black)를 쓴다.
 *   두 폰트나 프레임 로딩 실패 시 미리보기·다운로드를 막는다.
 *   캐릭터 테두리는 갈색으로 기본 적용하며 그림자는 기본 해제다.
 * - 배경·캐릭터 → 프레임 → 날짜 → 첫 제목·태그 → 둘째 제목 순서로 그린다.
 *   날짜는 탭 오른쪽 기준, 제목 두 개는 왼쪽 아래 기준이다. 첫 제목은 PSD 예시보다
 *   넓은 폭까지 허용하고, 태그는 축소 후 측정한 제목 폭·외곽선 바깥에 간격을 두고 오른쪽에 배치한다.
 * - 기존 PSD 대조 기록의 제목 외곽선은 바깥쪽 10px이다. Canvas 중앙 외곽선과
 *   가로 배율 0.9를 고려해 strokeText 폭을 10×2/0.9로 변환한다.
 * - 셋째·넷째 텍스트는 노란 캡슐 태그다. 폭은 글자 폭+좌우 여백을 최소·최대 폭으로
 *   제한하며, 높이 78px·반지름 39px는 PSD 도형 기준이다. Tracking -10은
 *   최종 글꼴 크기에서 1/1000 em을 px로 환산한다. 빈 태그는 도형·문자 모두 생략한다.
 *   최소 글꼴 크기에서도 넘치는 태그 글자를 캡슐 폭으로 자르거나 압축하지 않는다.
 * - 좌표 보정의 원본 검증 이미지는 '하로하 썸네일 템플릿.png'다.
 *   원본 PSD·검증 PNG는 저장소 외부 자료이므로 재조정 시 별도로 확보해 대조한다.
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
const TEMPLATE_IMAGES = { frame: '/assets/haroha/frame.png' } as const;
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
const DEFAULT_FIRST_TEXT = '첫번째텍스트';
const DEFAULT_SECOND_TEXT = '두번째텍스트';
const DEFAULT_THIRD_TEXT = '#세번째텍스트';
const DEFAULT_FOURTH_TEXT = '#네번째텍스트';
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

  drawFullCanvasImage(context, options.frameImage, CANVAS_SIZE);

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
