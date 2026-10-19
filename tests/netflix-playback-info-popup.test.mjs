import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL(
    '../public/userscript/netflix-playback-info-popup.user.js',
    import.meta.url,
  ),
  'utf8',
);

function createPlayer() {
  const elements = new Map();
  const state = { videos: [] };
  const pageWindow = {
    location: { pathname: '/browse' },
    addEventListener() {},
  };
  const context = {
    unsafeWindow: pageWindow,
    crypto: { randomUUID: () => 'test-peer-id' },
    document: {
      documentElement: {},
      querySelector: (selector) => elements.get(selector) ?? null,
      querySelectorAll: () => state.videos,
    },
    MutationObserver: class {
      constructor(callback) {
        state.onMutation = callback;
      }
      observe() {}
    },
  };
  // 설치용 IIFE의 비공개 읽기 함수를 노출해 실제 스크립트 코드를 검증한다.
  runInNewContext(
    source.replace(
      /\}\)\(\);\s*$/,
      'globalThis.readInfo = getPlaybackInfo;\n})();',
    ),
    context,
  );
  return {
    state,
    elements,
    document: context.document,
    location: pageWindow.location,
    readInfo: () => JSON.parse(JSON.stringify(context.readInfo())),
  };
}

test('팝업 버튼은 신고 버튼의 고정 폭 래퍼 바깥에 한 번만 추가한다', () => {
  const player = createPlayer();
  player.location.pathname = '/watch/123';
  player.state.videos = [{ clientWidth: 1280, clientHeight: 720 }];
  const controls = {
    children: [],
    prepend(element) {
      this.children.unshift(element);
      player.elements.set(`#${element.id}`, element);
    },
  };
  player.elements.set('button[data-uia="control-flag"]', {
    clientHeight: 44,
    closest: (selector) =>
      selector === '.watch-video--flag-container' ? controls : null,
  });
  player.document.createElement = () => ({
    style: {},
    children: [],
    setAttribute() {},
    addEventListener() {},
    appendChild(element) {
      const previous = this.children.at(-1);
      if (previous) previous.nextElementSibling = element;
      this.children.push(element);
      player.elements.set(`#${element.id}`, element);
    },
  });
  player.state.onMutation();
  player.state.onMutation();
  assert.equal(controls.children.length, 1);
  const group = controls.children[0];
  assert.equal(group.style.height, '44px');
  assert.equal(group.style.alignSelf, 'flex-start');
  assert.deepEqual(
    group.children.map((button) => button.textContent),
    ['재생정보 팝업', '외부연결 팝업'],
  );
});

test('메인 플레이어를 선택하고 기존 수신 형식으로 초 단위를 전달한다', () => {
  const player = createPlayer();
  player.location.pathname = '/watch/123';
  player.elements.set('[data-uia="video-title"]', {
    textContent: ' 테스트 영화 ',
  });
  player.state.videos = [
    { clientWidth: 100, clientHeight: 50, currentTime: 1, duration: 10 },
    { clientWidth: 1280, clientHeight: 720, currentTime: 65.5, duration: 3600 },
  ];
  assert.deepEqual(player.readInfo(), {
    title: '테스트 영화',
    currentTime: 65.5,
    duration: 3600,
  });
});

test('조작부가 사라져도 제목을 유지하고 회차 전환 시 이전 제목을 지운다', () => {
  const player = createPlayer();
  player.location.pathname = '/watch/123';
  player.elements.set('[data-uia="video-title"]', {
    textContent: '시리즈 1화',
  });
  player.state.onMutation();
  player.elements.clear();
  player.elements.set(
    '[data-uia="pause-ad-title-display-info-container"] span',
    { textContent: '1화: 에피소드명' },
  );
  assert.equal(player.readInfo().title, '시리즈 1화');

  player.elements.clear();
  player.location.pathname = '/watch/456';
  assert.equal(player.readInfo().title, '제목 불러오는 중...');
  player.elements.set(
    '[data-uia="pause-ad-title-display-info-container"] span',
    { textContent: '시리즈 2화' },
  );
  assert.equal(player.readInfo().title, '시리즈 2화');
  player.elements.clear();
  assert.equal(player.readInfo().title, '시리즈 2화');
});

test('시리즈 제목·회차·에피소드명 사이에 공백을 넣는다', () => {
  const player = createPlayer();
  player.location.pathname = '/watch/123';
  player.elements.set('[data-uia="video-title"]', {
    textContent: '사이버펑크: 엣지러너1화Let You Down',
    children: [
      { textContent: '사이버펑크: 엣지러너' },
      { textContent: '1화' },
      { textContent: 'Let You Down' },
    ],
  });
  assert.equal(
    player.readInfo().title,
    '사이버펑크: 엣지러너 1화 Let You Down',
  );
});

test('탐색 화면의 미리보기와 로딩 중 비정상 시간은 전송하지 않는다', () => {
  const player = createPlayer();
  player.state.videos = [
    { clientWidth: 1280, clientHeight: 720, currentTime: 60, duration: 120 },
  ];
  assert.deepEqual(player.readInfo(), {
    title: '재생 중인 영상 없음',
    currentTime: 0,
    duration: 0,
  });
  player.location.pathname = '/watch/123';
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    player.state.videos[0].currentTime = value;
    player.state.videos[0].duration = value;
    assert.deepEqual(player.readInfo(), {
      title: '제목 불러오는 중...',
      currentTime: 0,
      duration: 0,
    });
  }
});
