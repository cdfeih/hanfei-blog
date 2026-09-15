/**
 * 全站站点配置：唯一事实来源。
 * 联系方式等未知信息保持为空字符串，页面将隐藏对应入口，不生成假链接。
 */
export const SITE = {
  /** 站点名称 */
  name: '韩飞 · 工程与架构',
  /** 默认标题 */
  title: '韩飞 · 工程与架构',
  /** 首页大标题（两行节奏） */
  headline: ['以架构理清复杂', '以协作推动落地'],
  /** 首页简介 */
  description:
    'MBSE 项目负责人。关注技术方案、架构设计与团队管理，记录从工程问题到产品交付的思考。',
  /** 作者 */
  author: '韩飞',
  /** 写作昵称 */
  nickname: '飞的工程笔记',
  /** 站点语言 */
  lang: 'zh-CN',
  /** 内容语言标识 */
  locale: 'zh_CN',
  /**
   * 联系方式：提供真实地址后填入；为空时页面隐藏入口（规格 D11）。
   * 例如：email: 'hanfei@example.com'，github: 'https://github.com/<username>'
   */
  email: '277572023@qq.com',
  github: 'https://github.com/cdfeih',
  /**
   * 许可配置：分别声明网站代码与文章许可；留空则不在页脚宣称任何许可。
   */
  codeLicense: '',
  contentLicense: '',
} as const;
