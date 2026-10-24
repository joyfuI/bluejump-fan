import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createSender(source, sessionStorage) {
  const pageEvents = new Map();
  const timers = new Set();
  const state = { peers: [], popups: [], alerts: [], warnings: [], reloads: 0 };
  let timerId = 0;
  const schedule = () => {
    timers.add(++timerId);
    return timerId;
  };
  const pageWindow = {
    sessionStorage,
    location: {
      pathname: '/watch/123',
      reload() {
        state.reloads++;
        pageEvents.get('pagehide')();
      },
    },
    addEventListener: (name, callback) => pageEvents.set(name, callback),
    open() {
      const elements = new Map();
      const popupEvents = new Map();
      const popup = {
        closed: false,
        document: {
          head: {},
          body: {},
          querySelector(selector) {
            assert.ok(
              this.body.innerHTML.includes(`id="${selector.slice(1)}"`),
            );
            if (!elements.has(selector)) {
              const listeners = new Map();
              elements.set(selector, {
                addEventListener: (name, callback) =>
                  listeners.set(name, callback),
                click: () => listeners.get('click')(),
              });
            }
            return elements.get(selector);
          },
        },
        navigator: {
          clipboard: {
            writeText: async (value) => {
              state.copied = value;
            },
          },
        },
        alert: (message) => state.alerts.push(message),
        addEventListener: (name, callback) => popupEvents.set(name, callback),
        close() {
          this.closed = true;
          popupEvents.get('pagehide')();
        },
      };
      state.popups.push(popup);
      return popup;
    },
  };
  const context = {
    unsafeWindow: pageWindow,
    crypto: { randomUUID },
    console: { warn: (...args) => state.warnings.push(args) },
    document: {
      documentElement: {},
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    MutationObserver: class {
      observe() {}
    },
    setTimeout: schedule,
    setInterval: schedule,
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    GM: {
      xmlHttpRequest: () =>
        Object.assign(
          Promise.resolve({
            status: 200,
            response: { iceServers: [{ urls: 'stun:example.com' }] },
          }),
          { abort() {} },
        ),
    },
    window: {
      peerjs: {
        Peer: class {
          constructor(id) {
            this.id = id;
            this.handlers = new Map();
            state.peers.push(this);
          }
          on(name, callback) {
            this.handlers.set(name, callback);
          }
          destroy() {
            this.destroyed = true;
            this.handlers.get('close')?.();
          }
        },
      },
    },
  };
  runInNewContext(
    source.replace(
      /\}\)\(\);\s*$/,
      'globalThis.openConnectionWindow = openConnectionWindow;\n})();',
    ),
    context,
  );
  return {
    state,
    timers,
    hide: () => pageEvents.get('pagehide')(),
    async open() {
      context.openConnectionWindow();
      await new Promise(setImmediate);
      const peer = state.peers.at(-1);
      peer.open = true;
      peer.handlers.get('open')();
      return state.popups.at(-1);
    },
  };
}

for (const service of ['soop-vod', 'netflix']) {
  const source = readFileSync(
    new URL(
      `../public/userscript/${service}-playback-info-popup.user.js`,
      import.meta.url,
    ),
    'utf8',
  );
  const codeOf = (popup) =>
    popup.document.querySelector('#connection-code').value;

  test(`${service}: 새로고침 뒤 같은 연결코드를 등록하고 복사한다`, async () => {
    const storage = createStorage();
    const first = createSender(source, storage);
    const oldCode = codeOf(await first.open());
    first.hide();
    const next = createSender(source, storage);
    const popup = await next.open();
    assert.equal(codeOf(popup), oldCode);
    assert.equal(next.state.peers[0].id, oldCode);
    await popup.document.querySelector('#copy-code').click();
    assert.equal(next.state.copied, oldCode);
  });

  test(`${service}: 팝업만 닫고 다시 열어도 코드를 유지한다`, async () => {
    const sender = createSender(source, createStorage());
    const first = await sender.open();
    const oldCode = codeOf(first);
    first.close();
    assert.equal(sender.state.peers[0].destroyed, true);
    assert.equal(codeOf(await sender.open()), oldCode);
    assert.equal(sender.state.peers[1].id, oldCode);
  });

  test(`${service}: 재발급은 해당 키만 삭제하고 새로고침으로 연결을 정리한다`, async () => {
    const storage = createStorage();
    storage.setItem('unrelated', 'keep');
    const sender = createSender(source, storage);
    const popup = await sender.open();
    const oldCode = codeOf(popup);
    popup.document.querySelector('#regenerate-code').click();
    assert.deepEqual([...storage.values], [['unrelated', 'keep']]);
    assert.equal(sender.state.reloads, 1);
    assert.equal(sender.state.peers[0].destroyed, true);
    assert.equal(popup.closed, true);
    assert.equal(sender.timers.size, 0);
    const next = createSender(source, storage);
    assert.notEqual(codeOf(await next.open()), oldCode);
  });

  test(`${service}: 저장소 읽기나 쓰기가 차단돼도 메모리 코드로 연결한다`, async () => {
    for (const method of ['getItem', 'setItem']) {
      const storage = createStorage();
      storage[method] = () => {
        throw new Error('storage blocked');
      };
      const sender = createSender(source, storage);
      const popup = await sender.open();
      assert.equal(sender.state.peers[0].id, codeOf(popup));
      assert.equal(sender.state.warnings.length, 1);
    }
  });

  test(`${service}: 저장값 삭제에 실패하면 기존 연결을 유지하고 알린다`, async () => {
    const storage = createStorage();
    storage.removeItem = () => {
      throw new Error('storage blocked');
    };
    const sender = createSender(source, storage);
    const popup = await sender.open();
    popup.document.querySelector('#regenerate-code').click();
    assert.equal(sender.state.reloads, 0);
    assert.equal(sender.state.peers[0].destroyed, undefined);
    assert.equal(popup.closed, false);
    assert.equal(sender.state.alerts.length, 1);
    assert.equal([...storage.values.values()][0], codeOf(popup));
  });

  test(`${service}: 다른 탭과 코드가 겹쳐도 재발급할 수 있다`, async () => {
    const sender = createSender(source, createStorage());
    const popup = await sender.open();
    sender.state.peers[0].open = false;
    sender.state.peers[0].handlers.get('error')({ type: 'unavailable-id' });
    assert.match(
      popup.document.querySelector('#connection-status').textContent,
      /재발급/,
    );
    popup.document.querySelector('#regenerate-code').click();
    assert.equal(sender.state.reloads, 1);
    assert.equal(sender.timers.size, 0);
  });
}
