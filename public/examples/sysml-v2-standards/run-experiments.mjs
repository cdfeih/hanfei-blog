// 本文原创的逻辑和架构推演，不是 SysML 解析器或标准符合性测试。
// 运行：node public/examples/sysml-v2-standards/run-experiments.mjs
import assert from 'node:assert/strict';

let count = 0;
function experiment(name, run) {
  run();
  console.log(`PASS ${++count} ${name}`);
}
const subset = (a, b) => [...a].every(value => b.has(value));

experiment('类型相同不证明属于同一角色的值集合', () => {
  const pumps = new Set(['P1', 'P2']);
  assert.equal(subset(new Set(['P1']), pumps), true);
  assert.equal(subset(new Set(['P3']), pumps), false);
});

experiment('两个子集不自动保证互斥', () => {
  const pumps = new Set(['P1', 'P2']);
  const active = new Set(['P1']);
  const standby = new Set(['P1']);
  assert.ok(subset(active, pumps) && subset(standby, pumps));
  assert.ok([...active].some(p => standby.has(p)));
});

experiment('两个子集不自动覆盖全集', () => {
  const pumps = new Set(['P1', 'P2', 'P3']);
  const active = new Set(['P1']);
  const standby = new Set(['P2']);
  assert.ok(subset(active, pumps) && subset(standby, pumps));
  assert.equal(new Set([...active, ...standby]).size, 2);
  assert.equal(pumps.size, 3);
});

experiment('数量契约：[2] 符合 [2..4]，[1] 不符合', () => {
  const accepts = n => n >= 2 && n <= 4;
  assert.equal(accepts(2), true);
  assert.equal(accepts(1), false);
});

experiment('假设为假时，蕴含为真不能当作工况验证通过', () => {
  const implies = (assumption, required) => !assumption || required;
  const table = [[true, true, true], [true, false, false],
    [false, true, true], [false, false, true]];
  for (const [a, r, expected] of table) assert.equal(implies(a, r), expected);
  const maxResponse = -0.12;
  const measured = 0.10;
  assert.equal(implies(maxResponse > 0, measured <= maxResponse), true);
  assert.equal(maxResponse > 0, false); // 配置仍然无效。
});

experiment('原创判据：区间跨过阈值时返回 inconclusive', () => {
  // 使用整数微秒避免浮点舍入干扰例子；这是本文选择的判据，不是标准算法。
  const verdict = ({ center, uncertainty, limit, acquisitionError = false }) => {
    if (acquisitionError) return 'error';
    assert.ok(uncertainty >= 0 && limit > 0);
    if (center + uncertainty <= limit) return 'pass';
    if (center - uncertainty > limit) return 'fail';
    return 'inconclusive';
  };
  assert.equal(verdict({ center: 100000, uncertainty: 1000, limit: 120000 }), 'pass');
  assert.equal(verdict({ center: 130000, uncertainty: 1000, limit: 120000 }), 'fail');
  assert.equal(verdict({ center: 119000, uncertainty: 3000, limit: 120000 }), 'inconclusive');
  assert.equal(verdict({ center: 0, uncertainty: 0, limit: 120000, acquisitionError: true }), 'error');
});

const revisions = {
  C1: { E1: { name: 'coolingUnit', responseSeconds: 0.10 } },
  C2: { E1: { name: 'primaryCoolingUnit', responseSeconds: 0.11 } },
  C3: {},
};
experiment('只按元素 ID 缓存会串版，带提交的键可以区分', () => {
  const bad = new Map();
  bad.set('E1', revisions.C1.E1);
  assert.notDeepEqual(bad.get('E1'), revisions.C2.E1);
  const key = (commit, element) => JSON.stringify(['P', commit, element]);
  const good = new Map();
  for (const commit of ['C1', 'C2']) good.set(key(commit, 'E1'), revisions[commit].E1);
  assert.equal(good.get(key('C1', 'E1')).name, 'coolingUnit');
  assert.equal(good.get(key('C2', 'E1')).name, 'primaryCoolingUnit');
});

experiment('固定读取提交后，分支推进和当前删除不改变原版本选择', () => {
  const branch = { head: 'C1' };
  const pinned = branch.head;
  branch.head = 'C2';
  assert.equal(revisions[pinned].E1.name, 'coolingUnit');
  assert.equal(revisions[branch.head].E1.name, 'primaryCoolingUnit');
  branch.head = 'C3';
  assert.equal(revisions[branch.head].E1, undefined);
  assert.ok(revisions[pinned].E1);
});

console.log(`\n${count} 项推演通过。未解析或执行 .sysml 文件，未验证 SE-MBSE 或标准 API 服务。`);
