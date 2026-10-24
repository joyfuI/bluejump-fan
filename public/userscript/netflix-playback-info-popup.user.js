// ==UserScript==
// @name         Netflix 재생정보 팝업
// @namespace    https://blog.joyfui.com/
// @version      2
// @author       joyfuI
// @description  Netflix 제목, 재생시간, 진행률을 별도 창에 표시하는 버튼을 추가합니다.
// @homepageURL  https://bluejump-fan.vercel.app/tools/soop-vod-playback-info-popup
// @downloadURL  https://gist.github.com/joyfuI/5898be2770fb1eac003f9abb164b7a08/raw/netflix-playback-info-popup.user.js
// @updateURL    https://gist.github.com/joyfuI/5898be2770fb1eac003f9abb164b7a08/raw/netflix-playback-info-popup.user.js
// @match        https://www.netflix.com/*
// @noframes
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js
// @grant        unsafeWindow
// @grant        GM.xmlHttpRequest
// @connect      soop-chat-api.joyfui.workers.dev
// ==/UserScript==

(() => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: 유저 스크립트는 ES 모듈이 아닌 일반 스크립트로 실행된다.
  'use strict';

  const pageWindow = unsafeWindow;

  let infoWindow = null;
  let updateTimer = null;
  let currentVideoId = null;
  let cachedVodTitle = '';

  // 같은 탭에서는 새로고침해도 OBS URL을 계속 재사용한다.
  const externalPeerIdKey = 'netflix-playback-info-popup:peer-id';
  let externalPeerId = crypto.randomUUID();
  try {
    externalPeerId =
      pageWindow.sessionStorage.getItem(externalPeerIdKey) || externalPeerId;
    pageWindow.sessionStorage.setItem(externalPeerIdKey, externalPeerId);
  } catch (error) {
    console.warn('[Netflix INFO] 연결코드 저장 실패 · 메모리에서 유지', error);
  }
  const turnApi = 'https://soop-chat-api.joyfui.workers.dev/turn';
  let connectionWindow = null;
  let externalPeer = null;
  const externalConnections = new Map();
  let sendTimer = null;
  let retryTimer = null;
  let attemptTimer = null;
  let turnRequest = null;
  let connectionGeneration = 0;

  // ============================================================
  // VOD 제목 가져오기
  // ============================================================

  function getVodTitle() {
    const videoId = pageWindow.location.pathname.match(/^\/watch\/(\d+)/)?.[1];
    if (videoId !== currentVideoId) {
      currentVideoId = videoId;
      cachedVodTitle = '';
    }
    if (!videoId) return '재생 중인 영상 없음';

    const titleElement =
      document.querySelector('[data-uia="video-title"]') ||
      (!cachedVodTitle &&
        document.querySelector(
          '[data-uia="pause-ad-title-display-info-container"] span',
        ));
    const title = titleElement?.children?.length
      ? [...titleElement.children]
          .map((element) => element.textContent.trim())
          .filter(Boolean)
          .join(' ')
      : titleElement?.textContent?.trim();
    // 조작부가 숨겨지면 제목 DOM도 사라지므로 영상별로 마지막 제목을 유지한다.
    if (title) cachedVodTitle = title;
    return cachedVodTitle || '제목 불러오는 중...';
  }

  // ============================================================
  // 메인 video 요소 찾기
  // ============================================================

  function getMainVideo() {
    if (!/^\/watch\/\d+/.test(pageWindow.location.pathname)) return null;
    // 탐색 화면의 자동 재생 미리보기는 전송하지 않는다.
    const videos = [
      ...document.querySelectorAll('.watch-video--player-view video'),
    ];

    if (videos.length === 0) {
      return null;
    }

    // video가 여러 개라면 화면상 가장 큰 것을 메인 플레이어로 간주
    videos.sort((a, b) => {
      const areaA = a.clientWidth * a.clientHeight;

      const areaB = b.clientWidth * b.clientHeight;

      return areaB - areaA;
    });

    return videos[0];
  }

  // ============================================================
  // 초 → HH:MM:SS
  // ============================================================

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return '--:--:--';
    }

    seconds = Math.max(0, Math.floor(seconds));

    const hours = Math.floor(seconds / 3600);

    const minutes = Math.floor((seconds % 3600) / 60);

    const secs = seconds % 60;

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(secs).padStart(2, '0'),
    ].join(':');
  }

  // ============================================================
  // 팝업 내용 갱신
  // ============================================================

  function updateInfo() {
    if (!infoWindow || infoWindow.closed) {
      stopUpdate();
      return;
    }

    const video = getMainVideo();

    let currentTime = 0;
    let duration = 0;
    let progress = 0;

    if (video) {
      if (Number.isFinite(video.currentTime)) {
        currentTime = video.currentTime;
      }

      if (Number.isFinite(video.duration)) {
        duration = video.duration;
      }

      if (duration > 0) {
        progress = currentTime / duration;
      }
    }

    progress = Math.max(0, Math.min(1, progress));

    const popupDocument = infoWindow.document;

    const titleElement = popupDocument.querySelector('#vod-title');

    const timeElement = popupDocument.querySelector('#vod-time');

    const progressFill = popupDocument.querySelector('#progress-fill');

    const progressThumb = popupDocument.querySelector('#progress-thumb');

    // 제목
    if (titleElement) {
      const title = getVodTitle();

      titleElement.textContent = title;

      titleElement.title = title;
    }

    // 시간
    if (timeElement) {
      timeElement.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    }

    // 재생 완료 영역
    if (progressFill) {
      progressFill.style.width = `${progress * 100}%`;
    }

    // 현재 위치
    if (progressThumb) {
      progressThumb.style.left = `${progress * 100}%`;
    }
  }

  // ============================================================
  // 갱신 타이머
  // ============================================================

  function startUpdate() {
    stopUpdate();

    updateInfo();

    updateTimer = setInterval(updateInfo, 500);
  }

  function stopUpdate() {
    if (updateTimer !== null) {
      clearInterval(updateTimer);
      updateTimer = null;
    }
  }

  // ============================================================
  // 팝업 UI
  // ============================================================

  function buildPopup(win) {
    win.document.title = 'Netflix 재생정보';

    win.document.head.innerHTML = `
            <meta charset="UTF-8">

            <style>
                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    width: 100%;
                    height: 100%;

                    margin: 0;
                    padding: 0;

                    overflow: hidden;

                    background: #17181c;
                    color: #f5f5f5;

                    font-family:
                        Pretendard,
                        "Noto Sans KR",
                        -apple-system,
                        BlinkMacSystemFont,
                        "Segoe UI",
                        sans-serif;
                }


                body {
                    display: flex;
                    align-items: center;

                    /*
                     * 팝업 내부는 표시 전용
                     */
                    pointer-events: none;
                    user-select: none;
                }


                /* ================================================
                   전체 영역
                   ================================================ */

                #vod-info {
                    width: 100%;

                    padding:
                        16px
                        22px
                        17px;
                }


                /* ================================================
                   제목 / 시간
                   ================================================ */

                #info-row {
                    display: flex;
                    align-items: center;

                    width: 100%;

                    gap: 24px;

                    margin-bottom: 14px;
                }


                #vod-title {
                    flex: 1;
                    min-width: 0;

                    overflow: hidden;

                    white-space: nowrap;
                    text-overflow: ellipsis;

                    font-size: 17px;
                    font-weight: 650;
                    line-height: 1.3;
                }


                #vod-time {
                    flex: 0 0 auto;

                    white-space: nowrap;

                    color: #dddddd;

                    font-family:
                        "SFMono-Regular",
                        Consolas,
                        "Liberation Mono",
                        monospace;

                    font-size: 17px;
                    font-weight: 600;

                    font-variant-numeric:
                        tabular-nums;
                }


                /* ================================================
                   진행바
                   ================================================ */

                #progress-area {
                    display: flex;
                    align-items: center;

                    width: 100%;
                    height: 16px;
                }


                #progress-track {
                    position: relative;

                    width: 100%;
                    height: 5px;

                    background: #45474f;

                    border-radius: 999px;
                }


                #progress-fill {
                    position: absolute;

                    left: 0;
                    top: 0;

                    width: 0%;
                    height: 100%;

                    background: #ffffff;

                    border-radius: 999px;
                }


                #progress-thumb {
                    position: absolute;

                    left: 0%;
                    top: 50%;

                    width: 13px;
                    height: 13px;

                    transform:
                        translate(-50%, -50%);

                    background: #ffffff;

                    border-radius: 50%;

                    box-shadow:
                        0 1px 4px
                        rgba(0, 0, 0, 0.5);
                }
            </style>
        `;

    win.document.body.innerHTML = `
            <div id="vod-info">

                <div id="info-row">

                    <div id="vod-title">
                        제목 불러오는 중...
                    </div>

                    <div id="vod-time">
                        --:--:-- / --:--:--
                    </div>

                </div>


                <div id="progress-area">

                    <div id="progress-track">

                        <div id="progress-fill"></div>

                        <div id="progress-thumb"></div>

                    </div>

                </div>

            </div>
        `;

    // 팝업이 닫히면 타이머 정리
    win.addEventListener('pagehide', () => {
      stopUpdate();

      if (infoWindow === win) {
        infoWindow = null;
      }
    });
  }

  // ============================================================
  // 재생정보 팝업 열기
  // ============================================================

  async function openInfoWindow() {
    // 이미 열려 있으면 기존 창 사용
    if (infoWindow && !infoWindow.closed) {
      infoWindow.focus?.();
      updateInfo();

      return;
    }

    // --------------------------------------------------------
    // Document Picture-in-Picture
    // --------------------------------------------------------

    if (pageWindow.documentPictureInPicture) {
      try {
        infoWindow = await pageWindow.documentPictureInPicture.requestWindow({
          width: 680,
          height: 110,
        });
      } catch (error) {
        console.warn('[Netflix INFO] Document PiP 열기 실패', error);
      }
    }

    // --------------------------------------------------------
    // Document PiP 미지원 시 일반 팝업
    // --------------------------------------------------------

    if (!infoWindow) {
      infoWindow = pageWindow.open(
        '',
        'netflixInfo',
        ['width=680', 'height=140', 'resizable=yes', 'scrollbars=no'].join(','),
      );
    }

    if (!infoWindow) {
      alert(
        '재생정보 창을 열 수 없습니다.\n' +
          '브라우저의 팝업 차단 설정을 확인해주세요.',
      );

      return;
    }

    buildPopup(infoWindow);
    startUpdate();
  }

  // ============================================================
  // 외부 연결 관리 (수신 페이지와 메시지 형식을 함께 유지)
  // ============================================================

  function getPlaybackInfo() {
    const video = getMainVideo();
    return {
      title: getVodTitle(),
      currentTime: Number.isFinite(video?.currentTime)
        ? Math.max(0, video.currentTime)
        : 0,
      duration: Number.isFinite(video?.duration)
        ? Math.max(0, video.duration)
        : 0,
    };
  }

  function updateConnectionStatus(message) {
    if (!connectionWindow || connectionWindow.closed) return;
    const count = [...externalConnections.keys()].filter(
      (connection) => connection.open,
    ).length;
    connectionWindow.document.querySelector('#connection-status').textContent =
      message ||
      (externalPeer?.open
        ? count
          ? `연결됨 (${count}개)`
          : '연결 대기 중'
        : '연결 준비 중...');
    connectionWindow.document.querySelector('#copy-code').disabled =
      !externalPeer?.open;
  }

  function destroyExternalPeer() {
    connectionGeneration++;
    clearTimeout(retryTimer);
    retryTimer = null;
    clearTimeout(attemptTimer);
    attemptTimer = null;
    turnRequest?.abort();
    turnRequest = null;
    const peer = externalPeer;
    externalPeer = null;
    for (const [connection, timeout] of externalConnections) {
      clearTimeout(timeout);
      if (connection.open) connection.close({ flush: true });
      connection.close();
    }
    externalConnections.clear();
    peer?.destroy();
  }

  function stopExternalConnection() {
    clearInterval(sendTimer);
    sendTimer = null;
    destroyExternalPeer();
  }

  function retryExternalConnection(message) {
    if (!connectionWindow || connectionWindow.closed) return;
    if (retryTimer !== null) return;
    clearTimeout(attemptTimer);
    attemptTimer = null;
    // 시그널링 단절 중에도 이미 연결된 수신자에게는 계속 송신한다.
    if (![...externalConnections.keys()].some((connection) => connection.open))
      destroyExternalPeer();
    updateConnectionStatus(message);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void startExternalConnection();
    }, 3000);
  }

  function sendPlaybackInfo(target) {
    if (!connectionWindow || connectionWindow.closed) {
      stopExternalConnection();
      connectionWindow = null;
      return;
    }
    const info = getPlaybackInfo();
    for (const connection of target ? [target] : externalConnections.keys()) {
      if (!connection.open) continue;
      try {
        connection.send(info);
      } catch (error) {
        console.warn('[Netflix INFO] 재생정보 송신 실패', error);
        connection.close();
      }
    }
  }

  function isIceServers(value) {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((server) => {
        if (typeof server !== 'object' || server === null) return false;
        const urls =
          typeof server.urls === 'string' ? [server.urls] : server.urls;
        return (
          Array.isArray(urls) &&
          urls.length > 0 &&
          urls.every(
            (url) =>
              typeof url === 'string' &&
              /^(stun|stuns|turn|turns):\S+$/.test(url),
          ) &&
          (!urls.some((url) => /^turns?:/.test(url)) ||
            (typeof server.username === 'string' &&
              server.username.length > 0 &&
              typeof server.credential === 'string' &&
              server.credential.length > 0))
        );
      })
    );
  }

  async function requestExternalIceServers() {
    // Netflix의 Origin은 TURN API의 CORS 허용 대상이 아니므로 GM 요청을 사용한다.
    const request = GM.xmlHttpRequest({
      method: 'GET',
      url: turnApi,
      responseType: 'json',
      timeout: 10000,
      anonymous: true,
    });
    turnRequest = request;
    try {
      const response = await request;
      if (response.status < 200 || response.status >= 300)
        throw new Error('TURN 발급 요청 실패');
      if (!isIceServers(response.response?.iceServers))
        throw new Error('TURN 서버 응답 형식 오류');
      return response.response.iceServers;
    } finally {
      if (turnRequest === request) turnRequest = null;
    }
  }

  async function refreshExternalIceServers(peer) {
    if (externalPeer !== peer || turnRequest) return;
    const generation = connectionGeneration;
    try {
      const iceServers = await requestExternalIceServers();
      if (externalPeer !== peer || generation !== connectionGeneration) return;
      // 장시간 켜 둔 송신자의 TURN이 만료돼도 기존 수신 연결은 유지한다.
      peer.options.config.iceServers = iceServers;
    } catch (error) {
      if (externalPeer !== peer || generation !== connectionGeneration) return;
      console.warn('[Netflix INFO] TURN 재발급 실패', error);
    }
  }

  async function startExternalConnection() {
    if (!connectionWindow || connectionWindow.closed) return;
    if (externalPeer?.open) return;
    const generation = ++connectionGeneration;
    updateConnectionStatus('연결 준비 중...');
    clearTimeout(attemptTimer);
    attemptTimer = setTimeout(() => {
      externalPeer?.disconnect();
      retryExternalConnection('연결 시간 초과 · 재시도 중');
    }, 10000);
    try {
      if (externalPeer) {
        if (externalPeer.disconnected) externalPeer.reconnect();
        return;
      }
      const iceServers = await requestExternalIceServers();
      if (generation !== connectionGeneration) return;
      const peer = new window.peerjs.Peer(externalPeerId, {
        config: { iceServers },
      });
      externalPeer = peer;
      peer.on('open', () => {
        if (externalPeer !== peer) return;
        clearTimeout(attemptTimer);
        attemptTimer = null;
        clearTimeout(retryTimer);
        retryTimer = null;
        updateConnectionStatus();
      });
      peer.on('connection', (connection) => {
        if (externalPeer !== peer) {
          connection.close();
          return;
        }
        const remove = () => {
          clearTimeout(externalConnections.get(connection));
          if (!externalConnections.delete(connection)) return;
          connection.close();
          if (externalPeer === peer) updateConnectionStatus();
        };
        const timeout = setTimeout(() => {
          remove();
          void refreshExternalIceServers(peer);
        }, 10000);
        externalConnections.set(connection, timeout);
        connection.on('open', () => {
          if (externalPeer !== peer || !externalConnections.has(connection))
            return;
          clearTimeout(timeout);
          sendPlaybackInfo(connection);
          updateConnectionStatus();
        });
        connection.on('close', remove);
        connection.on('error', (error) => {
          remove();
          if (error.type === 'negotiation-failed')
            void refreshExternalIceServers(peer);
        });
      });
      peer.on('disconnected', () => {
        if (externalPeer !== peer) return;
        retryExternalConnection('서버 재연결 중');
      });
      peer.on('error', (error) => {
        if (externalPeer !== peer) return;
        console.warn('[Netflix INFO] 외부 연결 오류', error);
        retryExternalConnection(
          error.type === 'unavailable-id'
            ? '연결코드 사용 중 · 다른 탭을 닫거나 재발급하세요'
            : '연결 오류 · 재연결 중',
        );
      });
      peer.on('close', () => {
        if (externalPeer !== peer) return;
        retryExternalConnection('연결 끊김 · 재연결 중');
      });
    } catch (error) {
      if (generation !== connectionGeneration) return;
      console.warn('[Netflix INFO] 외부 연결 준비 실패', error);
      retryExternalConnection('연결 준비 실패 · 재시도 중');
    }
  }

  function openConnectionWindow() {
    if (connectionWindow && !connectionWindow.closed) {
      connectionWindow.focus();
      return;
    }
    stopExternalConnection();
    const win = pageWindow.open(
      '',
      'netflixExternalConnection',
      'width=380,height=200,resizable=yes,scrollbars=no',
    );
    if (!win) {
      alert(
        '외부연결 창을 열 수 없습니다.\n브라우저의 팝업 차단 설정을 확인해주세요.',
      );
      return;
    }
    connectionWindow = win;
    win.document.title = 'Netflix 외부연결';
    win.document.head.innerHTML = `
            <meta charset="UTF-8">
            <style>
                * { box-sizing: border-box; }
                body { margin: 0; padding: 14px; background: #17181c; color: #f5f5f5;
                    font: 14px/1.5 Pretendard, "Noto Sans KR", sans-serif; }
                label { display: block; margin-bottom: 8px; font-weight: 600; }
                .code-row { display: flex; gap: 8px; }
                input { flex: 1; min-width: 0; padding: 8px; border: 1px solid #45474f;
                    border-radius: 5px; background: #202126; color: #fff; font: 12px monospace; }
                button { padding: 8px 12px; border: 1px solid #45474f; border-radius: 5px;
                    background: #303138; color: #fff; cursor: pointer; }
                button:disabled { opacity: .5; cursor: default; }
                #connection-status { margin-top: 16px; }
                p { color: #aaa; font-size: 12px; }
            </style>`;
    win.document.body.innerHTML = `
            <label for="connection-code">연결코드</label>
            <div class="code-row">
                <input id="connection-code" readonly>
                <button id="copy-code" type="button" disabled>복사</button>
                <button id="regenerate-code" type="button">재발급</button>
            </div>
            <div id="connection-status" role="status">연결 준비 중...</div>
            <p>재생정보를 보내는 동안 이 창을 열어 두세요.<br>새로고침해도 연결코드는 유지됩니다.<br>재발급하면 원본 페이지가 새로고침되며 OBS URL 갱신이 필요합니다.</p>`;
    const codeInput = win.document.querySelector('#connection-code');
    const copyButton = win.document.querySelector('#copy-code');
    codeInput.value = externalPeerId;
    copyButton.addEventListener('click', async () => {
      try {
        if (win.navigator.clipboard) {
          await win.navigator.clipboard.writeText(externalPeerId);
        } else {
          codeInput.select();
          if (!win.document.execCommand('copy')) throw new Error('복사 실패');
        }
        if (!win.closed) copyButton.textContent = '복사됨';
      } catch (error) {
        console.warn('[Netflix INFO] 연결코드 복사 실패', error);
        if (!win.closed) {
          codeInput.select();
          win.alert('복사하지 못했습니다. 연결코드를 직접 복사해주세요.');
        }
      }
    });
    win.document
      .querySelector('#regenerate-code')
      .addEventListener('click', () => {
        try {
          pageWindow.sessionStorage.removeItem(externalPeerIdKey);
        } catch (error) {
          console.warn('[Netflix INFO] 연결코드 재발급 실패', error);
          win.alert(
            '연결코드를 재발급하지 못했습니다. 브라우저의 저장소 설정을 확인해주세요.',
          );
          return;
        }
        pageWindow.location.reload();
      });
    win.addEventListener(
      'pagehide',
      () => {
        if (connectionWindow !== win) return;
        connectionWindow = null;
        stopExternalConnection();
      },
      { once: true },
    );
    sendTimer = setInterval(sendPlaybackInfo, 500);
    void startExternalConnection();
  }

  // ============================================================
  // 상단 조작부에 팝업 버튼 추가
  // ============================================================

  function addOpenButton(id, label, onClick) {
    // 이미 추가된 경우
    if (document.querySelector(`#${id}`)) {
      return;
    }

    const buttonArea = document.querySelector(
      '#netflix-playback-popup-buttons',
    );

    if (!buttonArea) {
      return;
    }

    const button = document.createElement('button');

    button.id = id;

    button.type = 'button';

    button.textContent = label;

    Object.assign(button.style, {
      alignSelf: 'center',
      flexShrink: '0',

      padding: '4px 9px',

      background: '#202126',
      color: '#ffffff',

      border: '1px solid rgba(255,255,255,0.2)',

      borderRadius: '5px',

      fontSize: '12px',
      fontWeight: '600',

      lineHeight: '1.4',

      cursor: 'pointer',

      verticalAlign: 'middle',

      whiteSpace: 'nowrap',
    });

    button.addEventListener('mouseenter', () => {
      button.style.background = '#303138';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#202126';
    });

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      void onClick();
    });
    button.addEventListener('keydown', (event) => event.stopPropagation());
    button.addEventListener('keyup', (event) => event.stopPropagation());

    buttonArea.appendChild(button);
  }

  function addOpenButtons() {
    getVodTitle();
    if (!getMainVideo()) {
      document.querySelector('#netflix-playback-popup-buttons')?.remove();
      return;
    }
    const flagButton = document.querySelector(
      'button[data-uia="control-flag"]',
    );
    const controls = flagButton?.closest('.watch-video--flag-container');
    if (!controls) return;
    if (!document.querySelector('#netflix-playback-popup-buttons')) {
      const buttonArea = document.createElement('span');
      buttonArea.id = 'netflix-playback-popup-buttons';
      buttonArea.setAttribute('role', 'group');
      buttonArea.setAttribute('aria-label', '재생정보 도구');
      Object.assign(buttonArea.style, {
        display: 'inline-flex',
        alignItems: 'center',
        alignSelf: 'flex-start',
        flexShrink: '0',
        gap: '6px',
        height: `${flagButton.clientHeight}px`,
        marginRight: '14px',
      });
      controls.prepend(buttonArea);
    }
    addOpenButton('netflix-info-popup-button', '재생정보 팝업', openInfoWindow);
    addOpenButton(
      'netflix-external-popup-button',
      '외부연결 팝업',
      openConnectionWindow,
    );
    const local = document.querySelector('#netflix-info-popup-button');
    const external = document.querySelector('#netflix-external-popup-button');
    if (local && external && local.nextElementSibling !== external)
      local.after(external);
  }

  // ============================================================
  // 시작
  // ============================================================

  addOpenButtons();

  pageWindow.addEventListener('pagehide', () => {
    const win = connectionWindow;
    connectionWindow = null;
    stopExternalConnection();
    win?.close();
  });

  /*
   * Netflix는 탐색·회차 전환과 조작부 표시 때 DOM을 다시 생성하므로
   * 조작부가 나타나거나 버튼이 사라지면 다시 추가.
   */
  const observer = new MutationObserver(() => {
    addOpenButtons();
  });

  observer.observe(document.documentElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
})();
