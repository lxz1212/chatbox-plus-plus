import { create } from 'zustand'
import type {
  AppSettings,
  ChatMessage,
  Conversation,
  ModelConfig,
  ThinkingLevel,
  ThinkingMode,
  ThinkingKeep,
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
  thinkingKeep: ThinkingKeep
} {
  const modes = model.thinkingModes
  const mode: ThinkingMode = modes.includes('enabled')
    ? 'enabled'
    : (modes[0] ?? 'default')
  const level =
    mode === 'enabled'
      ? (defaultLevel(model.thinkingLevels) ?? 'default')
      : 'default'
  const keep = model.thinkingKeeps[0] ?? 'default'
  return { thinkingMode: mode, thinkingLevel: level, thinkingKeep: keep }
}

/**
 * 选择新建对话使用的模型 ID。
 * 优先级：显式传入 > 默认模型 > 上次使用的模型（仅默认为"自动"时）> 第一个模型
 */
function resolveModelId(
  models: ModelConfig[],
  settings: AppSettings,
  explicitId?: string | null
): string {
  const exists = (id: string | null | undefined): id is string =>
    !!id && models.some((m) => m.id === id)
  if (exists(explicitId)) return explicitId
  if (exists(settings.defaultModelId)) return settings.defaultModelId
  if (exists(settings.lastUsedModelId)) return settings.lastUsedModelId
  return models[0]?.id ?? ''
}

/** 兼容旧版本数据：把 thinkingKeeps 规范化（兼容旧的单选 thinkingKeep 字段） */
function normalizeKeeps(keeps: ThinkingKeep[]): ThinkingKeep[] {
  if (!Array.isArray(keeps) || keeps.length === 0) return ['default']
  return keeps as ThinkingKeep[]
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
      thinkingLevels: normalizeLevels(raw.thinkingLevels),
      allowEffortInDefault:
        (m as unknown as { allowEffortInDefault?: boolean }).allowEffortInDefault ?? false,
      allowKeepInDefault:
        (m as unknown as { allowKeepInDefault?: boolean }).allowKeepInDefault ?? false,
      thinkingKeeps: normalizeKeeps(
        (m as unknown as { thinkingKeeps?: ThinkingKeep[] }).thinkingKeeps ??
          (m as unknown as { thinkingKeep?: ThinkingKeep }).thinkingKeep != null
          ? [(m as unknown as { thinkingKeep: ThinkingKeep }).thinkingKeep]
          : []
      )
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
    ),
    allowEffortInDefault:
      (m as unknown as { allowEffortInDefault?: boolean }).allowEffortInDefault ?? false,
    allowKeepInDefault:
      (m as unknown as { allowKeepInDefault?: boolean }).allowKeepInDefault ?? false,
    thinkingKeeps: normalizeKeeps(
      (m as unknown as { thinkingKeeps?: ThinkingKeep[] }).thinkingKeeps ??
        (m as unknown as { thinkingKeep?: ThinkingKeep }).thinkingKeep != null
        ? [(m as unknown as { thinkingKeep: ThinkingKeep }).thinkingKeep]
        : []
    )
  }
}

/** 兼容旧版本数据：把旧 thinkingEnabled 迁移为 thinkingMode，补全 visible、thinkingKeep */
function normalizeConversation(c: Conversation): Conversation {
  let result = c
  if (typeof (result as unknown as { thinkingMode?: unknown }).thinkingMode !== 'string') {
    const enabled = (result as unknown as { thinkingEnabled?: boolean }).thinkingEnabled
    result = { ...result, thinkingMode: enabled ? 'enabled' : 'disabled' }
  }
  if (typeof (result as unknown as { visible?: unknown }).visible !== 'boolean') {
    result = { ...result, visible: true }
  }
  if (typeof (result as unknown as { thinkingKeep?: unknown }).thinkingKeep !== 'string') {
    result = { ...result, thinkingKeep: 'default' }
  }
  return result
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

  // 应用内浏览器（webview）
  browserUrl: string | null
  openBrowser: (url: string) => void
  closeBrowser: () => void

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
  setThinkingKeep: (keep: ThinkingKeep) => void

  // 发送消息
  sendMessage: (text: string) => Promise<void>
  stopStreaming: () => Promise<void>

  // 设置
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setSettingsOpen: (open: boolean, tab?: 'models' | 'general') => void
  setTheme: (theme: ThemeMode) => Promise<void>

  // 通用确认对话框
  dialog: {
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: (() => void) | null
  } | null
  openDialog: (opts: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
  }) => void
  closeDialog: () => void
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

  /** 保存指定对话（内部用）；隐藏的草稿对话不持久化 */
  async function persistConversation(convId: string): Promise<void> {
    const conv = get().conversations.find((c) => c.id === convId)
    if (conv && conv.visible) await api.saveConversation(conv)
  }

  return {
    initialized: false,
    models: [],
    conversations: [],
    settings: { theme: 'system', systemPrompt: '', defaultModelId: null, lastUsedModelId: null },
    currentConversationId: null,
    settingsOpen: false,
    settingsTab: 'general',
    browserUrl: null,
    dialog: null,

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
          // "默认"模式且不允许选择强度时，强制不发送 reasoning_effort
          if (thinkingMode === 'default' && !model.allowEffortInDefault) {
            thinkingLevel = 'default'
          }
          let thinkingKeep = c.thinkingKeep
          if (!model.thinkingKeeps.includes(thinkingKeep)) {
            thinkingKeep = model.thinkingKeeps[0] ?? 'default'
          }
          // "默认"模式且不允许选择保留式思考时，强制不发送 thinking.keep
          if (thinkingMode === 'default' && !model.allowKeepInDefault) {
            thinkingKeep = 'default'
          }
          return { ...c, thinkingMode, thinkingLevel, thinkingKeep }
        })
      // 按更新时间倒序
      conversations.sort((a, b) => b.updatedAt - a.updatedAt)
      // 兼容旧版本数据：补全 lastUsedModelId 字段
      const normalizedSettings: AppSettings = {
        ...settings,
        lastUsedModelId: settings.lastUsedModelId ?? null
      }
      // 打开软件时自动创建一个隐藏的草稿对话并进入
      const draftModelId = resolveModelId(models, normalizedSettings)
      const draftModel = models.find((m) => m.id === draftModelId)
      const draftThinking = draftModel
        ? thinkingStateForModel(draftModel)
        : {
            thinkingMode: 'default' as ThinkingMode,
            thinkingLevel: null,
            thinkingKeep: 'default' as ThinkingKeep
          }
      const draftNow = Date.now()
      const draft: Conversation = {
        id: uid(),
        title: '新对话',
        modelId: draftModelId,
        thinkingMode: draftThinking.thinkingMode,
        thinkingLevel: draftThinking.thinkingLevel,
        thinkingKeep: draftThinking.thinkingKeep,
        messages: [],
        visible: false,
        createdAt: draftNow,
        updatedAt: draftNow
      }
      set({
        models,
        conversations: [draft, ...conversations],
        settings: normalizedSettings,
        initialized: true,
        currentConversationId: draft.id
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
        if (settings.lastUsedModelId === id) {
          settings.lastUsedModelId = models[0]?.id ?? null
        }
        // 对话中引用了该模型的，清空引用
        const conversations = state.conversations.map((c) =>
          c.modelId === id ? { ...c, modelId: '' } : c
        )
        return { models, settings, conversations }
      })
      void api.saveSettings(get().settings)
    },

    createConversation(modelId) {
      const state = get()
      // 若当前对话是尚未发送的隐藏草稿对话，先从内存移除（它从未持久化，无需删除）
      const currentConv = state.conversations.find(
        (c) => c.id === state.currentConversationId
      )
      const dropCurrent =
        !!currentConv && !currentConv.visible && currentConv.messages.length === 0
      const remaining = dropCurrent
        ? state.conversations.filter((c) => c.id !== currentConv!.id)
        : state.conversations

      const targetModelId = resolveModelId(state.models, state.settings, modelId)
      const now = Date.now()
      const model = state.models.find((m) => m.id === targetModelId)
      const thinking = model
        ? thinkingStateForModel(model)
        : {
            thinkingMode: 'default' as ThinkingMode,
            thinkingLevel: null,
            thinkingKeep: 'default' as ThinkingKeep
          }
      const conversation: Conversation = {
        id: uid(),
        title: '新对话',
        modelId: targetModelId,
        thinkingMode: thinking.thinkingMode,
        thinkingLevel: thinking.thinkingLevel,
        thinkingKeep: thinking.thinkingKeep,
        messages: [],
        visible: false,
        createdAt: now,
        updatedAt: now
      }
      set(() => ({
        conversations: [conversation, ...remaining],
        currentConversationId: conversation.id
      }))
      // 隐藏的草稿对话不持久化；发送首条消息时才保存
      return conversation.id
    },

    selectConversation(id) {
      set((state) => {
        // 若当前是隐藏草稿对话且切换到别的对话，先移除草稿（避免内存孤儿）
        const current = state.conversations.find(
          (c) => c.id === state.currentConversationId
        )
        const dropCurrent =
          !!current &&
          !current.visible &&
          current.messages.length === 0 &&
          current.id !== id
        const conversations = dropCurrent
          ? state.conversations.filter((c) => c.id !== current!.id)
          : state.conversations
        return { conversations, currentConversationId: id }
      })
    },

    async removeConversation(id) {
      await api.deleteConversation(id)
      set((state) => {
        const conversations = state.conversations.filter((c) => c.id !== id)
        let currentConversationId = state.currentConversationId
        if (currentConversationId === id) {
          // 优先选第一个可见对话作为当前
          const firstVisible = conversations.find((c) => c.visible)
          currentConversationId = firstVisible?.id ?? null
        }
        return { conversations, currentConversationId }
      })
      // 删除后若无当前对话，创建一个草稿对话
      if (!get().currentConversationId) {
        get().createConversation()
      }
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
        : {
            thinkingMode: 'default' as ThinkingMode,
            thinkingLevel: null,
            thinkingKeep: 'default' as ThinkingKeep
          }
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                modelId,
                thinkingMode: thinking.thinkingMode,
                thinkingLevel: thinking.thinkingLevel,
                thinkingKeep: thinking.thinkingKeep
              }
            : c
        ),
        settings: { ...s.settings, lastUsedModelId: modelId }
      }))
      void persistConversation(convId)
      void api.saveSettings(get().settings)
    },

    setThinkingMode(mode) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      const conv = state.conversations.find((c) => c.id === convId)
      const model = state.models.find((m) => m.id === conv?.modelId)
      set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== convId) return c
          // 切换到"默认"模式且不允许选择强度时，重置强度为 default（不发送 reasoning_effort）
          if (mode === 'default' && !model?.allowEffortInDefault) {
            return { ...c, thinkingMode: mode, thinkingLevel: 'default' }
          }
          // 切换到"默认"模式且不允许选择保留式思考时，重置保留式思考为 default
          if (mode === 'default' && !model?.allowKeepInDefault) {
            return { ...c, thinkingMode: mode, thinkingLevel: 'default', thinkingKeep: 'default' }
          }
          return { ...c, thinkingMode: mode }
        })
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

    setThinkingKeep(keep) {
      const state = get()
      const convId = state.currentConversationId
      if (!convId) return
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === convId ? { ...c, thinkingKeep: keep } : c
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
        // 没有配置模型，弹出提示对话框
        get().openDialog({
          title: '尚未配置模型',
          message: '请先在设置中配置一个 AI 模型，才能开始对话。',
          confirmText: '去配置',
          cancelText: '取消',
          onConfirm: () => {
            get().setSettingsOpen(true, 'models')
          }
        })
        return
      }

      // 记录上次使用的模型（供"自动"模式使用）
      if (state.settings.lastUsedModelId !== conv.modelId) {
        set((s) => ({ settings: { ...s.settings, lastUsedModelId: conv.modelId } }))
        void api.saveSettings(get().settings)
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
                messages: [...c.messages, userMsg, assistantMsg],
                visible: isFirst ? true : c.visible
              }
            : c
        )
      }))
      // 首条消息：对话从隐藏草稿变为可见，立即持久化以在侧边栏显示
      if (isFirst) {
        const toShow = get().conversations.find((c) => c.id === convId)
        if (toShow) void api.saveConversation(toShow)
      }

      // 思考模式与强度直接取当前对话设置（已约束在模型支持范围内）
      const thinkingMode: ThinkingMode = conv.thinkingMode
      // "默认"模式且不允许选择强度时，强制不发送 reasoning_effort
      const thinkingLevel: ThinkingLevel | null =
        thinkingMode === 'default' && !model.allowEffortInDefault
          ? 'default'
          : conv.thinkingLevel
      // 当前轮次开启思考时，需把历史 assistant 的 reasoning_content 完整回传
      const thinkingEnabled = thinkingMode === 'enabled'

      // 构建发送给 API 的消息列表
      const sysPrompt = state.settings.systemPrompt.trim()
      const apiMessages: {
        role: 'user' | 'assistant' | 'system'
        content: string
        reasoning_content?: string
      }[] = []
      if (sysPrompt) {
        apiMessages.push({ role: 'system', content: sysPrompt })
      }
      // 取最新对话内容（含刚加入的 user 消息，排除占位 assistant）
      const latestConv = get().conversations.find((c) => c.id === convId)!
      for (const m of latestConv.messages) {
        if (m.id === assistantMsg.id) continue
        if (m.content.trim() === '') continue
        const msg: {
          role: 'user' | 'assistant' | 'system'
          content: string
          reasoning_content?: string
        } = { role: m.role, content: m.content }
        // 思考开启时，完整回传历史 assistant 消息的 reasoning_content
        if (thinkingEnabled && m.role === 'assistant' && m.reasoning) {
          msg.reasoning_content = m.reasoning
        }
        apiMessages.push(msg)
      }

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
          thinkingLevel,
          thinkingKeep:
            thinkingMode === 'default' && !model.allowKeepInDefault
              ? 'default'
              : conv.thinkingKeep
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
    },

    openBrowser(url) {
      set({ browserUrl: url })
    },

    closeBrowser() {
      set({ browserUrl: null })
    },

    openDialog(opts) {
      set({
        dialog: {
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText ?? '确定',
          cancelText: opts.cancelText ?? '取消',
          onConfirm: opts.onConfirm ?? null
        }
      })
    },

    closeDialog() {
      set({ dialog: null })
    }
  }
})

export { ALL_THINKING_LEVELS }
