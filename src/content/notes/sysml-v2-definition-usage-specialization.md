---
title: SysML v2 标准解读（二）：Definition、Usage 与特化，不能只按类和对象理解
slug: sysml-v2-definition-usage-specialization
description: 通过双泵冷却单元，区分类型、上下文角色和实际值，解释 typing、subsetting 与 redefinition 的差异，以及它们对多重性和平台数据模型的影响。
status: published
publishedAt: 2026-10-02
topics:
  - modeling
  - architecture
kind: architecture
---

第一次看到 `part def Pump` 和 `part primary : Pump`，软件工程师很容易把它们翻译成“类 Pump”和“对象 primary”。

这个类比能帮助入门，却很快遇到困难：如果写成 `part pumps : Pump[2..4]`，一个声明为什么允许对应多个值？如果 Usage 里面还能继续声明和重定义特征，它是否只是一次构造函数调用？

这一篇用一个冷却单元回答这些问题。依据是 2026 年 3 月文档修订的 SysML 2.0 与 KerML 1.0；解释和例子由本文自行组织。

## 1. 先区分定义、角色和值

标准里的 Definition 用来分类，Usage 描述特定上下文中的使用；多重性约束这个特征在每个相关上下文中允许有多少个值。[SysML 2.0 §7.6.1、§7.6.3](https://www.omg.org/spec/SysML/2.0/Language/PDF#page=63)

考虑：

```text
package CoolingRoles {
    part def Pump;

    part def CoolingUnit {
        part pumps : Pump[2..4];
    }
}
```

可以用三层问题来理解：

| 问题 | 本例中的回答 |
| --- | --- |
| 它们属于什么种类 | `Pump` |
| 冷却单元通过什么角色关联它们 | `pumps` |
| 某个具体冷却单元关联哪些实际泵 | 该冷却单元的 `pumps` 取值 |

`pumps` 这个模型元素不是四台实际设备的简写身份，也不是“现在立即创建四台设备”的运行指令。这里连数量都还没有固定，只限制在 2 到 4 之间。

这个区别能直接帮助需求讨论。如果用户问“这台实物泵的序列号存在哪里”，我们就应该继续设计具体设备与标识的表达，而不能只把 `pumps` 的显示名称改成一个序列号。

## 2. 不要把三种关系都叫继承

KerML 区分 FeatureTyping、Subsetting 和 Redefinition；它们分别有 `:`、`:>`、`:>>` 等记号。Definition 之间的 subclassification 也可使用 `:>`，因此不能仅凭箭头形状判断关系类别。[KerML 1.0 §7.3.3、§7.3.4.3—§7.3.4.5](https://www.omg.org/spec/KerML/1.0/PDF#page=57)

下面用一个原创模型观察差异：

```text
package CoolingSpecialization {
    part def Pump;
    part def ElectricPump :> Pump;

    part def CoolingUnit {
        part pumps : Pump[2..4];
        part activePumps : Pump[1..2] subsets pumps;
    }

    part def CompactCoolingUnit :> CoolingUnit {
        part redefines pumps : ElectricPump[2];
    }
}
```

这里至少有四件不同的事：

- `ElectricPump` 是更具体的泵类型；
- `pumps` 的值要符合 `Pump` 类型；
- `activePumps` 从当前单元的泵中选取值；
- 紧凑型单元用更具体的声明约束继承来的 `pumps` 角色。

对于平台而言，它们不能都压缩成一个没有类别的 `parentId`。

## 3. 用集合快照理解 subsetting，但别停在集合类比

假设某个冷却单元当前关联两台泵，记为 `P1` 和 `P2`。

```text
pumps       = { P1, P2 }
activePumps = { P1 }
```

这是一份便于推演的值快照，不是 SysML 语法。它满足下面的包含关系：

```text
activePumps 的每个值，都同时是 pumps 的值
```

如果把活动泵改成 `P3`，但 `pumps` 仍然只有 `P1`、`P2`，问题在于值之间的约束被破坏。把 `P3` 也声明为 `Pump` 类型，并不能解决它不属于当前单元泵集合的问题。

所以类型检查与子集检查并不相同：

- 类型检查问：这个值是不是合适种类的东西？
- 子集检查问：这个值是否也出现在被约束的另一个角色中？

这个集合视角只用于当前例子的直观推演。完整语言还涉及上下文、顺序、唯一性和时间等条件，不能把所有 Feature 简化成一张无上下文的全局集合表。

## 4. subsetting 不会自动产生互斥和覆盖

假设设计人员进一步增加：

```text
part standbyPumps : Pump[1..2] subsets pumps;
```

很多人会直觉认为：活动泵和备用泵已经把全部泵分完，而且一台泵只能出现在其中一个集合。

仅根据两个子集关系，得不出这两个结论。

以下两种赋值分别暴露了缺口：

```text
场景 A：
pumps       = { P1, P2 }
activePumps = { P1 }
standbyPumps = { P1 }

场景 B：
pumps       = { P1, P2, P3 }
activePumps = { P1 }
standbyPumps = { P2 }
```

场景 A 中两个角色发生重叠；场景 B 中 `P3` 没有被任何一个角色覆盖。它们都不违反“各自是 pumps 子集”这个单独条件。

如果工程要求“恰好划分成活动与备用两组”，还需要表达互斥和覆盖条件。这个推理来自集合关系本身，不是再给图上多画两条箭头就能补齐。

也要区分业务是否真的要求互斥。设备在切换期间可能有不同角色；如果有时间因素，约束的适用时点也要说清楚。

## 5. redefinition 的关键是上下文替换

重新定义会在相应上下文中替代被重新定义的继承特征，并且仍需满足相应的特化约束；它不等于给对象任意新增一个同名字段。[KerML 1.0 §7.3.4.5](https://www.omg.org/spec/KerML/1.0/PDF#page=61)

回到 `CompactCoolingUnit`：

```text
part redefines pumps : ElectricPump[2];
```

我的理解方式是：一般冷却单元允许 2 到 4 台泵；紧凑型单元将这个既有角色具体化为恰好两台电动泵。

这里有两个独立的收紧：

1. 值的种类从一般泵收紧到电动泵；
2. 数量从一个范围收紧为 2。

如果随意改成 `[1]`，就与一般单元至少需要两台泵的约束冲突。如果改成一个与泵不兼容的类型，也不是合法的“覆盖”。“子类型可以重写”不能被理解成“子类型可以否认父类型的契约”。

在编辑器中，我会把这类操作做成针对已有特征的特化，而不是先创建一份同名元素，再期待名称相同就能自动解释成重新定义。

## 6. 模型元素的归属和系统组成也别混淆

还有两个经常混在一起的“包含”：

- 一个 Usage 元素在模型中被哪个定义或包拥有；
- 一个实际系统对象是否构成另一个实际对象的一部分。

例如某个包保存了一个设备引用，并不表示“包”成了设备的物理容器。模型组织关系和被建模系统里的组成关系，需要在不同层次理解。

对于 SE-MBSE 这类平台，我建议至少在设计讨论中分开说：

- 模型所有权：复制、移动、删除模型元素会影响哪些成员；
- 领域组成：系统分解表达了什么；
- 图形容纳：一个方框画在另一个方框内部；
- 引用关系：另一个视图或模型元素是否指向同一对象。

它们可能有关联，但不能默认等同。尤其不能根据图形容器关系直接推断领域所有权。

## 7. 如何把理解转成工具检查

围绕本例，我会安排以下检查，而不是只验证序列化结果是否包含几个字段：

| 变更 | 应检查的语义问题 |
| --- | --- |
| 为 `pumps` 指定类型 | 目标是否可解析，是否属于合适类别 |
| 为 `activePumps` 建立子集关系 | 来源和目标的上下文、类型与值约束是否相容 |
| 重新定义 `pumps` | 是否指向正确的继承特征，多重性是否兼容 |
| 修改基本定义 | 依赖它的 Usage 是否仍然一致 |
| 导出后重新导入 | 关系类别与目标身份是否保留 |

这些是我依据语义差异提出的实现检查点，不是在声明 SE-MBSE 已完成全部检查，也不是标准规定的唯一算法。

## 8. 一个更准确的入门模型

我会这样记住这组概念：

> Definition 给出分类依据，Usage 给出上下文中的角色；typing 限定值的种类，subsetting 限定角色之间的取值关系，redefinition 在特定上下文中进一步具体化继承契约。

这个理解能解释多重性，也能解释为什么 Usage 本身仍然有可以特化的结构。它比“类和对象”多走一步，却能避免后续大量存储和交互设计误判。

本文的 `.sysml` 示例与集合推演分别放在[配套示例说明](/examples/sysml-v2-standards/README.md)中。集合推演有可运行的 JavaScript 检查；它不是 SysML 求值器。SysML 示例仅做了人工条款核对，尚未通过独立编译器验证。

上一篇：[怎样阅读标准](/notes/sysml-v2-reading-the-standard/) · 下一篇：[需求满足与验证](/notes/sysml-v2-requirements-verification/)。
