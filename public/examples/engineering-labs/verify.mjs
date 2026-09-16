import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const output = [];
const log = (s) => { output.push(s); console.log(s); };
function load(name, modules = {}, globals = {}) {
  const exports = {};
  const sandbox = {
    exports, module: { exports }, console: { log() {}, warn() {}, error() {} },
    process: { env: { NODE_ENV: 'production' } },
    require(id) {
      if (!(id in modules)) throw Error('Unexpected dependency: ' + id);
      return modules[id];
    },
    ...globals,
  };
  vm.runInNewContext(fs.readFileSync(path.join(dir, 'fixtures', name + '.cjs'), 'utf8'), sandbox);
  return sandbox.module.exports;
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function hooks() {
  const slots = []; let cursor = 0;
  return {
    begin() { cursor = 0; },
    useState(initial) { const i = cursor++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) {
      const i = cursor++, prev = slots[i];
      if (!prev || deps.some((v, j) => v !== prev.deps[j])) {
        prev?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      }
    },
  };
}
function jotai() {
  const values = new Map();
  const store = { get: a => values.get(a), set(a, value) { values.set(a, typeof value === 'function' ? value(values.get(a)) : value); } };
  return { atom(value) { const a = {}; values.set(a, value); return a; }, getDefaultStore: () => store, useAtomValue: a => store.get(a) };
}

// 执行原 createAtomFetcher 方法；Jotai 存储和 React Hook 调度替身不模拟真实 DOM。
{
  const react = hooks(); const api = load('atom', { jotai: jotai(), react });
  let calls = 0; const first = deferred();
  const f = api.createAtomFetcher({ initialData: '', fetch: () => { calls++; return first.promise; } });
  const a = f.getData('A'), b = f.getData('A');
  assert.equal(a, b); assert.equal(calls, 1); first.resolve('shared'); await a;
  assert.equal(await f.getData('A'), 'shared');
  log('atom/shared: same-promise=true, fetch-count=1');
  const old = deferred(), fresh = deferred(); let n = 0;
  const race = api.createAtomFetcher({ initialData: '', fetch: () => (++n === 1 ? old.promise : fresh.promise) });
  const p1 = race.getData('A'), p2 = race.forceGetData('A');
  fresh.resolve('NEW'); await p2; old.resolve('OLD'); await p1;
  assert.equal(await race.getData('A'), 'OLD');
  log('atom/refresh: NEW completed first, final-cache=OLD');
  const params = [];
  const h = api.createAtomFetcher({ initialData: '', fetch: key => { params.push(key); return Promise.resolve(key); } });
  react.begin(); h.useData('A'); await flush(); react.begin(); const state = h.useData('B');
  assert.deepEqual(params, ['A']); assert.equal(state.inited, false);
  log('atom/params: requested=A, B.inited=false');
  const failed = deferred(); let tries = 0;
  const retry = api.createAtomFetcher({ initialData: '', fetch: () => ++tries === 1 ? failed.promise : Promise.resolve('OK') });
  const attempt = retry.getData('A'); failed.reject(Error('controlled')); await attempt.catch(() => {});
  assert.equal(await retry.getData('A'), 'OK'); assert.equal(tries, 2);
  log('atom/failure: retry-fetch-count=2');
}

const { Observer } = load('observer');
function socketEnvironment() {
  const timers = [], sockets = [];
  class NativeSocket {
    sent = [];
    constructor(url) { this.url = url; sockets.push(this); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() { this.onclose?.(); }
  }
  const globals = { WebSocket: NativeSocket, setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; }, clearTimeout() {} };
  const { Websocket } = load('socket', {
    '../classUtils/guidUtil': { GuidUtil: { guid: () => 'example-message' } },
    '../observers/obser': { Observer }, './config': { REQUEST_TIMEOUT: 'timeout' },
  }, globals);
  return { Websocket, timers, sockets, globals };
}
{
  const e = socketEnvironment();
  const socket = new e.Websocket({ url: 'https://example.test/ws', onClose() {}, onOpen() {}, onMessage() {}, onError() {} });
  e.sockets[0].onclose(); assert.equal(e.timers.length, 0);
  log('socket/default-close: reconnect-timers=0');
  socket.sendAsPromise({ timeout: 3000 }); assert.equal(e.timers.length, 0);
  socket.sendAsPromise({}, 'second', 3000); assert.equal(e.timers[0].ms, 3000);
  assert.equal(e.sockets[0].onerror, undefined);
  log('socket/timeout: payload-field=0 timers, third-argument=1 timer');
  socket.setTryInterval(0); e.sockets[0].onclose(); assert.equal(e.timers.at(-1).ms, 0);
  log('socket/interval-zero: reconnect-delay=0');
}
{
  const e = socketEnvironment();
  const { default: Store } = load('store', {
    '@mbse-unity/utils': { Websocket: e.Websocket, Observer, getToken: () => 'synthetic-token', modal: { confirm() {} } },
    '@src/models': { EWebsocketMessageTypeEnum: { System: 1, LicenseEnter: 2, LicenseLeave: 3 } },
    '@src/routes/config': { navigateToLogin() {} }, '.': { default: { dispatch() {} } },
    './message/messageSlice': { wsMessage: x => x },
  }, { ...e.globals, location: { origin: 'https://example.test' }, window: { location: { reload() {} } } });
  const store = new Store(); store.init(); e.sockets[0].onclose();
  assert.equal(e.timers.length, 1); e.timers[0].fn(); assert.equal(e.sockets.length, 1);
  log('socket/store-retry: timer-fired=true, native-sockets=1');
}
{
  const react = hooks(), requests = new Map(), released = [];
  const { useModelingLicense } = load('guard', {
    react, 'react/jsx-runtime': { jsx() {} }, '@src/appManagement/pages/license': { NoLicense() {} },
    '@src/models': { ELicenseModuleEnum: {} },
    '@src/stores/wsStore': { wsStore: { consumeLicense(key) { const d = deferred(); requests.set(key, d); return d.promise; }, restoreLicense(key) { released.push(key); return Promise.resolve(); } } },
  });
  const render = key => { react.begin(); return useModelingLicense(key, false); };
  render('A'); render('B'); assert.deepEqual(released, ['A']);
  requests.get('B').resolve({ code: 403 }); await flush(); assert.equal(render('B'), false);
  requests.get('A').resolve({ code: 200 }); await flush(); assert.equal(render('B'), true);
  log('license/late-response: B denied, then A success => B.allowed=true');
}
{
  let received = '';
  const { viteBarrelResolutionPlugin } = load('barrel', {
    picocolors: { default: { cyan: x => x, yellow: x => x } },
    'vite-plugin-resolve-barrels': { resolveBarrelsPlugin: () => ({ transform(code) { received = code; return { code }; } }) },
  });
  const plugin = viteBarrelResolutionPlugin({ directories: ['common'] });
  plugin.transform("import Default, { item as alias } from '@src/common';", '/src/page.ts');
  assert.ok(received.includes("import Default from '@src/common'"));
  assert.ok(received.includes('item as alias'));
  assert.equal(plugin.transform("import { item } from '@/common';", '/src/page.ts'), null);
  log('barrel/wrapper: default-preserved=true, @/common=skipped');
  const { ResolverBuilder } = load('resolver', { path: { default: path } });
  const resolver = ResolverBuilder('demo', '/example/lib', { Known: 'known.ts' })();
  const result = resolver.transform("import { Known, Missing } from '@mbse-unity/demo'", '/example/page.ts');
  assert.ok(result.code.includes('Known')); assert.ok(!result.code.includes('Missing'));
  assert.equal(resolver.apply, 'serve');
  log('resolver/map: Known retained, Missing removed; apply=serve');
}
// 独立模型实验：演示分页漂移、嵌套异步完成和协同集合清理，不执行 Java 项目。
{
  let rows = [1, 2, 3, 4]; const first = rows.slice(0, 2); rows = rows.filter(n => n !== 1);
  const second = rows.slice(2, 4); assert.deepEqual([...first, ...second], [1, 2, 4]);
  log('pagination/offset: exported=1,2,4; skipped=3');
  const gate = deferred(); let childDone = false;
  await Promise.resolve().then(() => { gate.promise.then(() => { childDone = true; }); });
  assert.equal(childDone, false); gate.resolve(); await flush(); assert.equal(childDone, true);
  log('events/nested: outer-complete=true while child-complete=false');
  const groups = new Map([['P:B:0', new Set(['old'])]]), pending = [];
  const set = groups.get('P:B:0'); set.delete('old'); if (!set.size) pending.push('P:B:0');
  groups.get('P:B:0').add('new'); pending.forEach(k => groups.delete(k));
  assert.equal(groups.has('P:B:0'), false);
  log('sessions/check-then-remove: newly-added-session-lost=true');
  const parsed = JSON.parse('{"id":9007199254740993}'); assert.equal(String(parsed.id), '9007199254740992');
  log('contract/long: 9007199254740993 -> 9007199254740992');
}
{
  const source = fs.readFileSync(path.join(dir, 'fixtures/required.cjs'), 'utf8');
  const context = { module: { exports: {} } };
  assert.equal(vm.runInNewContext(source + '\nisFieldRequired("@Size(min=1)")', context, { timeout: 100 }), true);
  assert.throws(() => vm.runInNewContext(source + '\nisFieldRequired("@Size(min=0)")', { module: { exports: {} } }, { timeout: 100 }), /timed out/);
  log('contract/required: min=1 returns true; min=0 hits VM timeout');
}
log('PASS: 16 checks; source snapshots plus 4 explicitly labeled model experiments');
