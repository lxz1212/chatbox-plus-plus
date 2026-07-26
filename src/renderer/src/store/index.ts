import { create } from 'zustand'
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  ModelConfig,
  ThinkingLevel,
  ThinkingMode,
  ThemeMode
} from '@shared/types'
import { ALL_THINKING_LEVELS } from '@shared/types'

const api = window.chatbox

/** 生成唯一 ID（渲染进程内） */
function uid(): string {
  return crypto.randomUUID()
}

/** 从模型支持的等级中选一个默认等级（优先 medium，其次首个非 default，否则 default） */
function defaultLevel(levels: ThinkingLevel[]): ThinkingLevel | null {
  if (levels.length === 0) return null
  if (levels.includes('medium')) return 'medium'
  const nonDefault = levels.find((l) => l !== 'default')
  return nonDefault ?? levels[0]
}

/** 根据模型支持的思考模式推导默认思考状态 */
function thinkingStateForModel(model: ModelConfig): {
  thinkingMode: ThinkingMode
  thinkingLevel: ThinkingLevel | null
} {
  const modes = model.thinkingModes
  const mode: ThinkingMode = modes.includes('enabled')
    ? 'enabled'
    : (modes[0] ?? 'default')
  const level =
    mode === 'enabled'
      ? (defaultLevel(model.thinkingLevels) ?? 'default')
      : 'default'
  return { thinkingMode: mode, thinkingLevel: level }
}

/** 兼容旧版本数据：把 thinkingLevels 规范化 */
function normalizeLevels(levels: unknown): ThinkingLevel[] {
  if (!Array.isArray(levels) || levels.length === 0) return ['default']
  return levels as ThinkingLevel[]
}

/** 兼容旧版本数据：把旧 thinkingType 迁移为 thinkingModes */
function normalizeModel(m: ModelConfig): ModelConfig {
  if (Array.isArray((m as unknown as { thinkingModes?: unknown }).thinkingModes)) {
    const raw = m as unknown as {
      thinkingModes: ThinkingMode[]
      thinkingLevels: ThinkingLevel[]
    }
    return {
      ...m,
      thinkingModes: [...raw.thinkingModes],
      thinkingLevels: normalizeLevels(raw.thinkingLevels)
    }
  }
  // 旧格式：thinkingType
  let modes: ThinkingMode[]
  switch ((m as unknown as { thinkingType?: string }).thinkingType) {
    case 'thinking':
      modes = ['enabled']
      break
    case 'non-thinking':
      modes = ['disabled']
      break
    case 'selectable':
      modes = ['enabled', 'disabled']
      break
    default:
      modes = ['default']
  }
  return {
    ...m,
    thinkingModes: modes,
    thinkingLevels: normalizeLevels(
      (m as unknown as { thinkingLevels?: ThinkingLevel[] }).thinkingLevels
    )
  }
}

/** 兼容旧版本数据：把旧 thinkingEnabled 迁移为 thinkingMode */
function normalizeConversation(c: Conversation): Conversation {
  if (typeof (c as unknown as { thinkingMode?: unknown }).thinkingMode === 'string') {
    return c
  }
  const enabled = (c as unknown as { thinkingEnabled?: boolean }).thinkingEnabled
  return { ...c, thinkingMode: enabled ? 'enabled' : 'disabled' }
}

/** 由首条用户消息生成对话标题 */
function makeTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (!clean) return '新对话'
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean
}

function emptyMessage(role: ChatMessage['role']): ChatMessage {
  return {
    id: uid(),
    role,
    content: '',
    reasoning: '',
    streaming: false,
    error: false,
    createdAt: Date.now()
  }
}

interface ChatboxState {
  initialized: boolean
  models: ModelConfig[]
  conversations: Conversation[]
  settings: AppSettings
  currentConversationId: string | null
  settingsOpen: boolean
  settingsTab: 'models' | 'general'

  // 流式状态
  isStreaming: boolean
  currentRequestId: string | null
  streamingConversationId: string | null
  streamingMessageId: string | null

  // 初始化
  init: () => Promise<void>

  // 模型
  addModel: (model: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateModel: (model: ModelConfig) => Promise<void>
  removeModel: (id: string) => Promise<void>

  // 对话
  createConversation: (modelId?: string) => string
  selectConversation: (id: string) => void
  removeConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => void
  clearMessages: (id: string) => void
  setCurrentModel: (modelId: string) => void
  setThinkingMode: (mode: ThinkingMode) => void
  setThinkingLevel: (level: ThinkingLevel) => void
  setThinkingLevelFor: (convId: string, level: ThinkingLevel) => void

  // 发送消息
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => Promise<void>

  // 设置
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setSettingsOpen: (open: boolean, tab?: 'models' | 'general') => void
  setTheme: (theme: ThemeMode) => Promise<void>
}

export const useStore = create<ChatboxState>((set, get) => {
  // 一次性注册流式事件监听
  api.onChatChunk((e) => {
    const { streamingConversationId, streamingMessageId } = get()
    if (!streamingConversationId || !streamingMessageId) return
    if (e.requestId !== get().currentRequestId) return

    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== streamingConversationId) return c
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== streamingMessageId) return m
            return {
              ...m,
              content: m.content + (e.content ?? ''),
              reasoning: m.reasoning + (e.reasoning ?? '')
            }
          })
        }
      })
    }))
  })

  api.onChatDone(async (e) => {
    const { streamingConversationId, streamingMessageId, currentRequestId } = get()
    if (e.requestId !== currentRequestId) return

    let toSave: Conversation | null = null
    set((state) => ({
      isStreaming: false,
      currentRequestId: null,
      streamingConversationId: null,
      streamingMessageId: null,
      conversations: state.conversations.map((c) => {
        if (c.id !== streamingConversationId) return c
        const updated: Conversation = {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === streamingMessageId ? { ...m, streaming: false } : m
          )
        }
        toSave = updated
        return updated
      })
    }))
    if (toSave) {
      await api.saveConversation(toSave)
    }
  })

  api.onChatError((e) => {
    const { streamingConversationId, streamingMessageId, currentRequestId } = get()
    if (e.requestId !== currentRequestId) return

    let toSave: Conversation | null = null
    set((state) => ({
      isStreaming: false,
      currentRequestId: null,
      streamingConversationId: null,
      streamingMessageId: null,
      conversations: state.conversations.map((c) => {
        if (c.id !== streamingConversationId) return c
        const updated: Conversation = {
          ...c,
          updatedAt: Date.now(),
          messages: c.messages.map((m) =>
            m.id === streamingMessageId
              ? {
                  ...m,
                  streaming: false,
                  error: true,
                  content:
                    m.content ||
                    `抱歉，生成回复时出错：\n\n${e.error}`
                }
              : m
          )
        }
        toSave = updated
        return updated
      })
    }))
    if (toSave) {
      void api.saveConversation(toSave)
    }
  })

  /** 保存指定对话（内部用） */
  async function persistConversation(convId: string): Promise<void> {
    const conv = get().conversations.find((c) => c.id === convId)
    if (conv) await api.saveConversation(conv)
  }

  return {
    initialized: false,
    models: [],
    conversations: [],
    settings: { theme: 'system', systemPrompt: '', defaultModelId: null },
    currentConversationId: null,
    settingsOpen: false,
    settingsTab: 'general',

    isStreaming: false,
    currentRequestId: null,
    streamingConversationId: null,
    streamingMessageId: null,

    async init() {
      const [rawModels, rawConversations, settings] = await Promise.all([
        api.getModels(),
        api.getConversations(),
        api.getSettings()
      ])
      // 兼容旧版本数据：迁移 thinkingType -> thinkingModes
      const models = rawModels.map(normalizeModel)
      const conversations = rawConversations
        .map(normalizeConversation)
        .map((c) => {
          // 确保思考模式/强度落在对应模型支持范围内
          const model = models.find((m) => m.id === c.modelId)
          if (!model) return c
          let thinkingMode = c.thinkingMode
          if (!model.thinkingModes.includes(thinkingMode)) {
            thinkingMode = model.thinkingModes[0] ?? 'default'
          }
          let thinkingLevel = c.thinkingLevel
          if (thinkingLevel && !model.thinkingLevels.includes(thinkingLevel)) {
            thinkingLevel = model.thinkingLevels[0] ?? null
          }
          return { ...c, thinkingMode, thinkingLevel }
        })
      // 按更新时间倒序
      conversations.sort((a, b) => b.updatedAt - a.updatedAt)
      set({
        models,
        conversations,
        settings,
        initialized: true,
        currentConversationId: conversations[0]?.id ?? null
      })
    },

    async addModel(input) {
      const now = Date.now()
      const model: ModelConfig = {
        ...input,
        id: uid(),
        createdAt: now,
        updatedAt: now
      }
      const saved = await api.saveModel(model)
      set((state) => {
        const models = [...state.models, saved]
        const settings = { ...state.settings }
        if (!settings.defaultModelId) settings.defaultModelId = saved.id
        return { models, settings }
      })
    },

    async updateModel(model) {
      const saved = await api.saveModel(model)
      set((state) => ({
        models: state.models.map((m) => (m.id === saved.id ? saved : m))
      }))
    },

    async removeModel(id) {
      await api.deleteModel(id)
      set((state) => {
        const models = state.models.filter((m) => m.id !== id)
        const settings = { ...state.settings }
        if (settings.defaultModelId === id) {
          settings.defaultModelId = models[0]?.id ?? null
        }
        // 对话中引用了该模型的，清空引用
        const conversations = state.conversations.map((c) =>
          c.modelId === id ? { ...c, modelId: '' } : c
        )
        return { models, settings, conversations }
      })
    },

    createConversation(modelId) {
      const state = get()
      const targetModelId =
        modelId ?? state.settings.defaultModelId ?? state.models[0]?.id ?? ''
      const now = Date.now()
      const model = state.models.find((m) => m.id === targetModelId)
      const thinking = model
        ? thinkingStateForModel(model)
        : { thinkingMode: 'default' as ThinkingMode, thinkingLevel: null }
      const conversation: Conversation = {
        id: uid(),
        title: '新对话',
        modelId: targetModelId,
        thinkingMode: thinking.thinkingMode,
        thinkingLevel: thinking.thinkingLevel,
        messages: [],
        createdAt: now,
        updatedAt: now
      }
      set((s) => ({
        conversations: [conversation, ...s.conversations],
        currentConversationId: conversation.id
      }))
      void api.saveConversation(conversation)
      return conversation.id
    },

    selectConversation(id) {
      set({ currentConversationId: id })
    },

    async removeConversation(id) {
      await api.deleteConversation(id)
      set((state) => {
        const conversations = state.conversations.filter((c) => c.id !== id)
        const currentConversationId =
          state.currentConversationId === id
            ? conversations[0]?.id ?? null
            : state.currentConversationId
        return { conversations, currentConversationId }
      })
    },

    renameConversation(id, title) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: title || '新对话' } : c
        )
      }))
      void persistConversation(id)
    },

    clearMessages(id) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, messages: [], title: '新对话', updatedAt: Date.now() } : c
        )
      }))
      void persistConversation(id)
    },

    setCurrentModel(modelId) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      const model = state.models.find((m) => m.id === modelId)
      const thinking = model
        ? thinkingStateForModel(model)
        : { thinkingMode: 'default' as ThinkingMode, thinkingLevel: null }
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                modelId,
                thinkingMode: thinking.thinkingMode,
                thinkingLevel: thinking.thinkingLevel
              }
            : c
        )
      }))
      void persistConversation(convId)
    },

    setThinkingMode(mode) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, thinkingMode: mode } : c
        )
      }))
      void persistConversation(convId)
    },

    setThinkingLevel(level) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, thinkingLevel: level } : c
        )
      }))
      void persistConversation(convId)
    },

    setThinkingLevelFor(convId, level) {
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, thinkingLevel: level } : c
        )
      }))
      void persistConversation(convId)
    },

    async sendMessage(text) {
      const state = get()
      if (state.isStreaming) return

      let convId = state.currentConversationId
      // 没有当前对话则新建
      if (!convId || !state.conversations.find((c) => c.id === convId)) {
        convId = get().createConversation()
      }

      const conv = get().conversations.find((c) => c.id === convId)
      if (!conv) return

      const model = state.models.find((m) => m.id === conv.modelId)
      if (!model) {
        // 没有配置模型，打开设置
        get().setSettingsOpen(true, 'models')
        return
      }

      const userMsg: ChatMessage = {
        ...emptyMessage('user'),
        content: text
      }
      const assistantMsg: ChatMessage = {
        ...emptyMessage('assistant'),
        streaming: true
      }

      const isFirst = conv.messages.length === 0
      const newTitle = isFirst ? makeTitle(text) : conv.title

      set((s) => ({
        isStreaming: true,
        streamingConversationId: convId,
        streamingMessageId: assistantMsg.id,
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                title: newTitle,
                messages: [...c.messages, userMsg, assistantMsg]
              }
            : c
        )
      }))

      // 构建发送给 API 的消息列表
      const sysPrompt = state.settings.systemPrompt.trim()
      const apiMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = []
      if (sysPrompt) {
        apiMessages.push({ role: 'system', content: sysPrompt })
      }
      // 取最新对话内容（含刚加入的 user 消息，排除占位 assistant）
      const latestConv = get().conversations.find((c) => c.id === convId)!
      for (const m of latestConv.messages) {
        if (m.id === assistantMsg.id) continue
        if (m.content.trim() === '') continue
        apiMessages.push({ role: m.role, content: m.content })
      }

      // 思考模式与强度直接取当前对话设置（已约束在模型支持范围内）
      const thinkingMode: ThinkingMode = conv.thinkingMode
      const thinkingLevel: ThinkingLevel | null = conv.thinkingLevel

      try {
        const requestId = await api.chatSend({
          apiBase: model.apiBase,
          apiKey: model.apiKey,
          modelId: model.modelId,
          messages: apiMessages,
          temperature: model.temperature,
          topP: model.topP,
          n: model.n,
          presencePenalty: model.presencePenalty,
          frequencyPenalty: model.frequencyPenalty,
          maxTokens: model.maxTokens,
          thinkingMode,
          thinkingLevel
        })
        set({ currentRequestId: requestId })
      } catch (err) {
        set((s) => ({
          isStreaming: false,
          streamingConversationId: null,
          streamingMessageId: null,
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === assistantMsg.id
                  ? {
                      ...m,
                      streaming: false,
                      error: true,
                      content: `发起请求失败：${(err as Error).message}`
                    }
                  : m
              )
            }
          })
        }))
        void persistConversation(convId)
      }
    },

    async stopStreaming() {
      const { currentRequestId } = get()
      if (currentRequestId) {
        await api.chatAbort(currentRequestId)
      }
    },

    async updateSettings(partial) {
      const state = get()
      const next = { ...state.settings, ...partial }
      set({ settings: next })
      await api.saveSettings(next)
    },

    setSettingsOpen(open, tab = 'general') {
      set({ settingsOpen: open, settingsTab: tab })
    },

    async setTheme(theme) {
      await get().updateSettings({ theme })
    }
  }
})

export { ALL_THINKING_LEVELS }
