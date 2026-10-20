import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// 从博客根目录执行。TypeScript 只用来擦除类型，执行的函数来自固定提交的源码。
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = fileURLToPath(new URL('.', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'mbse-article-lab-'));
let passed = 0;
async function test(name, run) {
  await run();
  console.log(`PASS ${++passed} ${name}`);
}
function loadTs(name) {
  const source = readFileSync(join(root, 'source', `${name}.ts`), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const file = join(temp, `${name}.cjs`);
  writeFileSync(file, output);
  return require(file);
}
const encoder = new TextEncoder();
function response(text, { bytewise = false, close = true } = {}) {
  return new Response(new ReadableStream({
    start(controller) {
      const bytes = encoder.encode(text);
      if (bytewise) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      else controller.enqueue(bytes);
      if (close) controller.close();
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}
try {
  const manifest = JSON.parse(readFileSync(join(root, 'source-manifest.json'), 'utf8'));
  await test('原始源码与固定提交提取记录的 SHA-256 一致', () => {
    for (const file of manifest.files) {
      const bytes = readFileSync(join(root, 'source', file.local));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    }
  });
  const { readAssistantEvents } = loadTs('stream');
  const { getAssistantSelectedIds } = loadTs('context');
  await test('中文 UTF-8 每字节切块、CRLF、心跳不破坏事件顺序', async () => {
    const events = [];
    await readAssistantEvents(response(': heartbeat\r\n\r\ndata: {"type":"text","text":"建模完成"}\r\n\r\ndata: {"type":"complete"}\r\n\r\n', { bytewise: true }), e => events.push(e));
    assert.deepEqual(events, [{ type: 'text', text: '建模完成' }, { type: 'complete' }]);
  });
  for (const type of ['complete', 'error', 'confirmation', 'question']) {
    await test(`${type} 结束本次流，无需 HTTP 关闭，忽略后续帧`, async () => {
      const events = [];
      let timer;
      try {
        await Promise.race([
          readAssistantEvents(response(`data: {"type":"${type}"}\n\ndata: {"type":"text","text":"不应出现"}\n\n`, { close: false }), e => events.push(e)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('业务终态未释放')), 1000); }),
        ]);
      } finally { clearTimeout(timer); }
      assert.deepEqual(events, [{ type }]);
    });
  }
  await test('普通 EOF 不能冒充业务完成', async () => {
    await assert.rejects(readAssistantEvents(response('data: {"type":"text","text":"处理中"}\n\n'), () => {}), /执行结果待核对/);
  });
  await test('等待网络数据时取消，抛出 AbortError', async () => {
    const controller = new AbortController();
    const pending = readAssistantEvents(new Response(new ReadableStream(), {
      headers: { 'Content-Type': 'text/event-stream' },
    }), () => {}, controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
  });
  await test('非 SSE 错误响应不会作为模型文字展示', async () => {
    await assert.rejects(readAssistantEvents(new Response('{"message":"权限不足"}', {
      status: 403, headers: { 'Content-Type': 'application/json' },
    }), () => {}), /权限不足/);
  });
  await test('损坏 JSON 失败并释放流锁', async () => {
    const res = response('data: {broken}\n\n');
    await assert.rejects(readAssistantEvents(res, () => {}), /无法解析/);
    assert.equal(res.body.locked, false);
  });
  await test('业务 ID 保持字符串精度，拒绝 Long 溢出和虚拟节点', () => {
    assert.deepEqual(getAssistantSelectedIds([
      { dataId: '9223372036854775807' }, { dataId: '9223372036854775808' },
      { dataId: 'FAVORIATE-123' }, { dataId: '123' },
      { dataId: '01' }, { dataId: 'folder' }, { dataId: '0' }, {},
    ]), ['9223372036854775807', '123']);
    assert.notEqual(String(Number('9223372036854775807')), '9223372036854775807');
  });
  await test('原始 Java 回执：错误分类和压缩回执保留恢复入口', () => {
    const output = join(temp, 'java');
    mkdirSync(output);
    execFileSync('javac', ['-encoding', 'UTF-8', '-d', output,
      join(root, 'source', 'McpOperationReceipt.java'),
      join(root, 'source', 'ModelingResult.java'),
      join(root, 'ReceiptLab.java')], { stdio: 'pipe' });
    const result = execFileSync('java', ['-cp', output, 'ReceiptLab'], { encoding: 'utf8' });
    assert.match(result, /receipt checks: 8/);
  });
  console.log(`\n${passed} checks passed. 仅验证独立源码行为，不代表数据库、模型接口或整套系统集成通过。`);
} finally {
  const target = resolve(temp);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('mbse-article-lab-')) {
    throw new Error('拒绝清理实验临时目录以外的路径');
  }
  rmSync(target, { recursive: true, force: true });
}
