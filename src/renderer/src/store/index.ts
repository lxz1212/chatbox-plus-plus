import { create } from 'zustand'
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  ModelConfig,
  ThinkingLevel,
  ThemeMode
} from '@shared/types'
import { ALL_THINKING_LEVELS } from '@shared/types'

const api = window.chatbox

/** 生成唯一 ID（渲染进程内） */
function uid(): string {
  return crypto.randomUUID()
}

/** 从模型支持的等级中选一个默认等级（优先 medium） */
function defaultLevel(levels: ThinkingLevel[]): ThinkingLevel | null {
  if (levels.length === 0) return null
  if (levels.includes('medium')) return 'medium'
  return levels[0]
}

/** 根据模型思考类型推导默认思考状态 */
function thinkingStateForModel(model: ModelConfig): {
  thinkingEnabled: boolean
  thinkingLevel: ThinkingLevel | null
} {
  if (model.thinkingType === 'non-thinking') {
    return { thinkingEnabled: false, thinkingLevel: null }
  }
  return { thinkingEnabled: true, thinkingLevel: defaultLevel(model.thinkingLevels) }
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
  setThinkingEnabled: (enabled: boolean) => void
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
    settingsTab: 'models',

    isStreaming: false,
    currentRequestId: null,
    streamingConversationId: null,
    streamingMessageId: null,

    async init() {
      const [models, conversations, settings] = await Promise.all([
        api.getModels(),
        api.getConversations(),
        api.getSettings()
      ])
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
        : { thinkingEnabled: false, thinkingLevel: null }
      const conversation: Conversation = {
        id: uid(),
        title: '新对话',
        modelId: targetModelId,
        thinkingEnabled: thinking.thinkingEnabled,
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
        : { thinkingEnabled: false, thinkingLevel: null }
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                modelId,
                thinkingEnabled: thinking.thinkingEnabled,
                thinkingLevel: thinking.thinkingLevel
              }
            : c
        )
      }))
      void persistConversation(convId)
    },

    setThinkingEnabled(enabled) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      const conv = state.conversations.find((c) => c.id === convId)
      const model = state.models.find((m) => m.id === conv?.modelId)
      // 开启时确保有一个有效等级
      let level = conv?.thinkingLevel ?? null
      if (enabled && (!level || !(model?.thinkingLevels ?? []).includes(level))) {
        level = defaultLevel(model?.thinkingLevels ?? [])
      }
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? { ...c, thinkingEnabled: enabled, thinkingLevel: level }
            : c
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

      // 决定是否启用思考
      const thinkingEnabled =
        model.thinkingType === 'thinking'
          ? true
          : model.thinkingType === 'selectable'
            ? conv.thinkingEnabled
            : false
      const thinkingLevel =
        thinkingEnabled && conv.thinkingLevel
          ? conv.thinkingLevel
          : defaultLevel(model.thinkingLevels)

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
          thinkingEnabled,
          thinkingLevel: thinkingEnabled ? thinkingLevel : null
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

    setSettingsOpen(open, tab = 'models') {
      set({ settingsOpen: open, settingsTab: tab })
    },

    async setTheme(theme) {
      await get().updateSettings({ theme })
    }
  }
})

export { ALL_THINKING_LEVELS }
