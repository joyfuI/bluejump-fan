// ==UserScript==
// @name         SOOP VOD 재생정보 팝업
// @namespace    https://blog.joyfui.com/
// @version      2
// @author       joyfuI
// @description  SOOP VOD 제목, 재생시간, 진행률을 별도 창에 표시하는 버튼을 추가합니다.
// @homepageURL  https://bluejump-fan.vercel.app/tools/soop-vod-playback-info-popup
// @downloadURL  https://gist.github.com/joyfuI/5898be2770fb1eac003f9abb164b7a08/raw/soop-vod-playback-info-popup.user.js
// @updateURL    https://gist.github.com/joyfuI/5898be2770fb1eac003f9abb164b7a08/raw/soop-vod-playback-info-popup.user.js
// @require      https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js
// @match        https://vod.sooplive.com/player/*
// @run-at       document-end
// @grant        unsafeWindow
// ==/UserScript==

(() => {
  // biome-ignore lint/suspicious/noRedundantUseStrict: 유저 스크립트는 ES 모듈이 아닌 일반 스크립트로 실행된다.
  'use strict';

  const pageWindow = unsafeWindow;

  let infoWindow = null;
  let updateTimer = null;

  // 관리 창은 닫혀도 같은 VOD 문서에서는 OBS URL을 계속 재사용한다.
  const externalPeerId = crypto.randomUUID();
  let connectionWindow = null;
  let externalPeer = null;
  let sendTimer = null;
  let retryTimer = null;
  let registrationTimer = null;
  const externalConnections = new Set();

  // ============================================================
  // VOD 제목 가져오기
  // ============================================================

  function getVodTitle() {
    const titleElement = document.querySelector(
      '.broadcast_information .column[number="2"] .broadcast_title',
    );

    if (!titleElement) {
      return '제목 불러오는 중...';
    }

    return (
      titleElement.getAttribute('title') ||
      titleElement.textContent ||
      '제목 없음'
    ).trim();
  }

  // ============================================================
  // 메인 video 요소 찾기
  // ============================================================

  function getMainVideo() {
    const videos = [...document.querySelectorAll('video')];

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

    updateTimer = setInterval(updateInfo, 200);
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
    win.document.title = 'SOOP VOD 재생정보';

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

                    font-size: 15px;
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
        console.warn('[SOOP VOD INFO] Document PiP 열기 실패', error);
      }
    }

    // --------------------------------------------------------
    // Document PiP 미지원 시 일반 팝업
    // --------------------------------------------------------

    if (!infoWindow) {
      infoWindow = pageWindow.open(
        '',
        'soopVodInfo',
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
    const count = [...externalConnections].filter((conn) => conn.open).length;
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

  function stopExternalConnection() {
    clearInterval(sendTimer);
    clearTimeout(retryTimer);
    clearTimeout(registrationTimer);
    sendTimer = retryTimer = registrationTimer = null;
    const peer = externalPeer;
    externalPeer = null;
    externalConnections.clear();
    peer?.destroy();
  }

  function retryExternalConnection(message) {
    if (!connectionWindow || connectionWindow.closed) return;
    updateConnectionStatus(message);
    if (retryTimer !== null) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      startExternalConnection();
    }, 3000);
  }

  function waitForRegistration(peer) {
    clearTimeout(registrationTimer);
    registrationTimer = setTimeout(() => {
      registrationTimer = null;
      if (externalPeer !== peer || peer.open) return;
      if ([...externalConnections].some((conn) => conn.open)) {
        peer.disconnect();
      } else {
        peer.destroy();
      }
      retryExternalConnection('연결 시간 초과 · 재연결 중');
    }, 10000);
  }

  function sendPlaybackInfo() {
    if (!connectionWindow || connectionWindow.closed) {
      stopExternalConnection();
      connectionWindow = null;
      return;
    }
    const info = getPlaybackInfo();
    for (const conn of externalConnections) {
      if (!conn.open) continue;
      try {
        conn.send(info);
      } catch (error) {
        console.warn('[SOOP VOD INFO] 재생정보 송신 실패', error);
        conn.close();
      }
    }
  }

  function startExternalConnection() {
    if (!connectionWindow || connectionWindow.closed) return;
    if (externalPeer && !externalPeer.destroyed) {
      if (externalPeer.disconnected) {
        externalPeer.reconnect();
        waitForRegistration(externalPeer);
      }
      return;
    }
    const peer = new window.peerjs.Peer(externalPeerId);
    externalPeer = peer;
    waitForRegistration(peer);

    peer.on('open', () => {
      if (externalPeer !== peer) return;
      clearTimeout(registrationTimer);
      clearTimeout(retryTimer);
      registrationTimer = retryTimer = null;
      updateConnectionStatus();
    });
    peer.on('connection', (conn) => {
      if (
        externalPeer !== peer ||
        !connectionWindow ||
        connectionWindow.closed
      ) {
        conn.close();
        return;
      }
      externalConnections.add(conn);
      conn.on('open', () => {
        if (externalPeer !== peer) return;
        sendPlaybackInfo();
        updateConnectionStatus();
      });
      conn.on('close', () => {
        externalConnections.delete(conn);
        if (externalPeer === peer) updateConnectionStatus();
      });
      conn.on('error', (error) => {
        console.warn('[SOOP VOD INFO] 수신 연결 오류', error);
        conn.close();
        externalConnections.delete(conn);
        if (externalPeer === peer) updateConnectionStatus();
      });
    });
    peer.on('disconnected', () => {
      if (externalPeer !== peer) return;
      clearTimeout(registrationTimer);
      registrationTimer = null;
      retryExternalConnection('서버 연결 끊김 · 재연결 중');
    });
    peer.on('error', (error) => {
      if (externalPeer !== peer) return;
      console.warn('[SOOP VOD INFO] 외부 연결 오류', error);
      retryExternalConnection(
        error.type === 'unavailable-id'
          ? '연결코드 등록 실패 · 같은 코드로 재시도 중'
          : '연결 오류 · 재연결 중',
      );
    });
    peer.on('close', () => {
      if (externalPeer !== peer) return;
      externalPeer = null;
      externalConnections.clear();
      clearTimeout(registrationTimer);
      registrationTimer = null;
      retryExternalConnection('연결 끊김 · 재연결 중');
    });
  }

  function openConnectionWindow() {
    if (connectionWindow && !connectionWindow.closed) {
      connectionWindow.focus();
      return;
    }
    stopExternalConnection();
    const win = pageWindow.open(
      '',
      'soopVodExternalConnection',
      'width=380,height=200,resizable=yes,scrollbars=no',
    );
    if (!win) {
      alert(
        '외부연결 창을 열 수 없습니다.\n브라우저의 팝업 차단 설정을 확인해주세요.',
      );
      return;
    }
    connectionWindow = win;
    win.document.title = 'SOOP VOD 외부연결';
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
            </div>
            <div id="connection-status" role="status">연결 준비 중...</div>
            <p>재생정보를 보내는 동안 이 창을 열어 두세요.<br>같은 VOD 페이지에서는 창을 다시 열어도 코드가 유지됩니다.</p>`;
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
        console.warn('[SOOP VOD INFO] 연결코드 복사 실패', error);
        if (!win.closed) {
          codeInput.select();
          win.alert('복사하지 못했습니다. 연결코드를 직접 복사해주세요.');
        }
      }
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
    sendTimer = setInterval(sendPlaybackInfo, 200);
    startExternalConnection();
  }

  // ============================================================
  // 제목 영역에 팝업 버튼 추가
  // ============================================================

  function addOpenButton(id, label, onClick) {
    // 이미 추가된 경우
    if (document.querySelector(`#${id}`)) {
      return;
    }

    /*
     * VOD 제목이 들어있는 영역
     *
     * 제목 영역 안에 넣기 때문에
     * 영상 위를 가리지 않고,
     * 전체화면에서도 나타나지 않음.
     */
    const titleArea = document.querySelector(
      '.broadcast_information .column[number="2"]',
    );

    // 아직 SOOP 페이지가 로딩 중인 경우
    if (!titleArea) {
      return;
    }

    const button = document.createElement('button');

    button.id = id;

    button.type = 'button';

    button.textContent = label;

    Object.assign(button.style, {
      marginLeft: id === 'soop-vod-external-popup-button' ? '4px' : '10px',

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

    button.addEventListener('click', onClick);

    titleArea.appendChild(button);
  }

  function addOpenButtons() {
    addOpenButton(
      'soop-vod-info-popup-button',
      '재생정보 팝업',
      openInfoWindow,
    );
    addOpenButton(
      'soop-vod-external-popup-button',
      '외부연결 팝업',
      openConnectionWindow,
    );
    const local = document.querySelector('#soop-vod-info-popup-button');
    const external = document.querySelector('#soop-vod-external-popup-button');
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
   * SOOP 페이지가 동적으로 DOM을 다시 생성할 수 있으므로
   * 제목 영역이 나타나거나 버튼이 사라지면 다시 추가.
   */
  const observer = new MutationObserver(() => {
    addOpenButtons();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
