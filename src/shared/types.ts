/**
 * Chatbox++ 共享类型定义
 * 在主进程、预加载脚本与渲染进程中共用
 */

/** 思考强度等级 */
export type ThinkingLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

/** 全部可选的思考强度等级（按强度递增排序） */
export const ALL_THINKING_LEVELS: ThinkingLevel[] = [
  'low',
  'medium',
  'high',
  'xhigh',
  'max'
]

/** 思考类型：仅思考 / 仅非思考 / 可在对话时选择是否思考 */
export type ThinkingType = 'thinking' | 'non-thinking' | 'selectable'

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
  /** 思考类型 */
  thinkingType: ThinkingType
  /** 该模型支持的思考强度等级（仅在 thinking/selectable 时有意义） */
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
  /** 当前是否开启思考（仅当模型 thinkingType 为 selectable 时有意义） */
  thinkingEnabled: boolean
  /** 当前选择的思考强度等级 */
  thinkingLevel: ThinkingLevel | null
  /** 消息列表 */
  messages: ChatMessage[]
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
  /** 是否启用思考 */
  thinkingEnabled: boolean
  /** 思考强度等级 */
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
