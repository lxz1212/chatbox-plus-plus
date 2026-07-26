/**
 * Chatbox++ 共享类型定义
 * 在主进程、预加载脚本与渲染进程中共用
 */

/** 思考强度等级（'default' 表示不传入 reasoning_effort） */
export type ThinkingLevel =
  | 'default'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'

/** 全部可选的思考强度等级 */
export const ALL_THINKING_LEVELS: ThinkingLevel[] = [
  'default',
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
]

/** 思考模式（直接对应 thinking.type 参数；'default' 表示不传入该字段） */
export type ThinkingMode = 'default' | 'enabled' | 'disabled'

/** 全部可选的思考模式 */
export const ALL_THINKING_MODES: ThinkingMode[] = [
  'default',
  'enabled',
  'disabled'
]

/** 模型配置 */
export interface ModelConfig {
  /** 唯一 ID */
  id: string
  /** 显示名称 */
  name: string
  /** API 基础地址，例如 https://api.openai.com/v1 */
  apiBase: string
  /** 用户的 API Key */
  apiKey: string
  /** 发送到 API 的模型 ID，例如 gpt-4o */
  modelId: string
  /** 温度 */
  temperature: number | null
  /** top_p */
  topP: number | null
  /** n（生成数量） */
  n: number | null
  /** presence_penalty */
  presencePenalty: number | null
  /** frequency_penalty */
  frequencyPenalty: number | null
  /** max_tokens */
  maxTokens: number | null
  /** 该模型支持的思考模式集合（多选） */
  thinkingModes: ThinkingMode[]
  /** 该模型支持的思考强度等级集合（多选） */
  thinkingLevels: ThinkingLevel[]
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 单条消息 */
export interface ChatMessage {
  id: string
  role: MessageRole
  /** 消息正文 */
  content: string
  /** 思考/推理内容（仅 assistant） */
  reasoning: string
  /** 是否正在流式生成 */
  streaming: boolean
  /** 是否生成出错 */
  error: boolean
  /** 创建时间 */
  createdAt: number
}

/** 对话 */
export interface Conversation {
  id: string
  /** 对话标题 */
  title: string
  /** 绑定的模型配置 ID */
  modelId: string
  /** 当前选择的思考模式 */
  thinkingMode: ThinkingMode
  /** 当前选择的思考强度等级 */
  thinkingLevel: ThinkingLevel | null
  /** 消息列表 */
  messages: ChatMessage[]
  /** 是否在侧边栏显示；新建的空对话为 false，发送首条消息后才显示并持久化 */
  visible: boolean
  createdAt: number
  updatedAt: number
}

/** 主题模式 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 应用设置 */
export interface AppSettings {
  /** 主题模式 */
  theme: ThemeMode
  /** 全局系统提示词（为空则不发送） */
  systemPrompt: string
  /** 默认模型 ID（新建对话时使用） */
  defaultModelId: string | null
}

/** 发起对话请求时传给主进程的参数 */
export interface ChatRequestParams {
  apiBase: string
  apiKey: string
  modelId: string
  messages: { role: MessageRole; content: string }[]
  temperature: number | null
  topP: number | null
  n: number | null
  presencePenalty: number | null
  frequencyPenalty: number | null
  maxTokens: number | null
  /** 思考模式（'default' 表示不传入 thinking.type） */
  thinkingMode: ThinkingMode
  /** 思考强度等级（'default' 或 null 表示不传入 reasoning_effort） */
  thinkingLevel: ThinkingLevel | null
}

/** 流式分片事件 */
export interface ChatChunkEvent {
  requestId: string
  /** 正文增量 */
  content?: string
  /** 思考内容增量 */
  reasoning?: string
}

/** 流式完成事件 */
export interface ChatDoneEvent {
  requestId: string
  aborted: boolean
}

/** 流式错误事件 */
export interface ChatErrorEvent {
  requestId: string
  error: string
}

/**
 * 通过 contextBridge 暴露给渲染进程的 API
 */
export interface ChatboxAPI {
  getAppVersion: () => Promise<string>
  platform: NodeJS.Platform

  // 模型
  getModels: () => Promise<ModelConfig[]>
  saveModel: (model: ModelConfig) => Promise<ModelConfig>
  deleteModel: (id: string) => Promise<void>

  // 对话
  getConversations: () => Promise<Conversation[]>
  saveConversation: (conversation: Conversation) => Promise<Conversation>
  deleteConversation: (id: string) => Promise<void>

  // 设置
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<AppSettings>

  // 对话请求
  chatSend: (params: ChatRequestParams) => Promise<string>
  chatAbort: (requestId: string) => Promise<void>
  onChatChunk: (cb: (e: ChatChunkEvent) => void) => () => void
  onChatDone: (cb: (e: ChatDoneEvent) => void) => () => void
  onChatError: (cb: (e: ChatErrorEvent) => void) => () => void
}
