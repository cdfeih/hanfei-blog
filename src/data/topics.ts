/** 领域与文章类型受控枚举：新增取值需同时更新内容校验与筛选器。 */

export interface TopicDef {
  value: string;
  label: string;
}

export const TOPICS: readonly TopicDef[] = [
  { value: 'modeling', label: '系统建模' },
  { value: 'frontend', label: '复杂前端' },
  { value: 'architecture', label: '平台架构' },
  { value: 'management', label: '工程管理' },
] as const;

export const TOPIC_VALUES = TOPICS.map((t) => t.value);

export function topicLabel(value: string): string {
  return TOPICS.find((t) => t.value === value)?.label ?? value;
}

/** 文章类型元信息（不参与导航筛选，仅作标签展示）。 */
export const KINDS: Record<string, string> = {
  architecture: '架构设计',
  decision: '技术决策',
  delivery: '团队与交付',
} as const;

export function kindLabel(value?: string): string | undefined {
  return value ? KINDS[value] : undefined;
}

export function isValidTopic(value: string | null): value is string {
  return value !== null && TOPIC_VALUES.includes(value);
}
