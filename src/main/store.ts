import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'
import type {
  AppSettings,
  Conversation,
  ModelConfig
} from '../shared/types'

interface AppData {
  settings: AppSettings
  models: ModelConfig[]
  conversations: Conversation[]
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  systemPrompt: '',
  defaultModelId: null
}

function defaultData(): AppData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    models: [],
    conversations: []
  }
}

class Store {
  private data: AppData = defaultData()

  private filePath: string

  private loaded = false

  constructor() {
    // 路径延迟解析，确保 app 已就绪
    this.filePath = join(app.getPath('userData'), 'chatbox-data.json')
  }

  private load(): void {
    if (this.loaded) return
    this.loaded = true
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<AppData>
        this.data = {
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          models: Array.isArray(parsed.models) ? parsed.models : [],
          conversations: Array.isArray(parsed.conversations)
            ? parsed.conversations
            : []
        }
      }
    } catch (err) {
      console.error('[store] 读取数据失败，使用默认数据:', err)
      this.data = defaultData()
    }
  }

  private persist(): void {
    try {
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[store] 写入数据失败:', err)
    }
  }

  getSettings(): AppSettings {
    this.load()
    return { ...this.data.settings }
  }

  saveSettings(settings: AppSettings): AppSettings {
    this.load()
    this.data.settings = { ...settings }
    this.persist()
    return { ...this.data.settings }
  }

  getModels(): ModelConfig[] {
    this.load()
    return this.data.models.map((m) => ({ ...m }))
  }

  saveModel(model: ModelConfig): ModelConfig {
    this.load()
    const now = Date.now()
    const idx = this.data.models.findIndex((m) => m.id === model.id)
    const toSave: ModelConfig = { ...model, updatedAt: now }
    if (idx >= 0) {
      this.data.models[idx] = { ...this.data.models[idx], ...toSave }
    } else {
      toSave.createdAt = now
      this.data.models.push(toSave)
    }
    this.persist()
    // 如果默认模型被删除等场景由前端处理，这里仅保存
    return { ...toSave }
  }

  deleteModel(id: string): void {
    this.load()
    this.data.models = this.data.models.filter((m) => m.id !== id)
    if (this.data.settings.defaultModelId === id) {
      this.data.settings.defaultModelId = null
    }
    this.persist()
  }

  getConversations(): Conversation[] {
    this.load()
    return this.data.conversations.map((c) => ({ ...c }))
  }

  saveConversation(conversation: Conversation): Conversation {
    this.load()
    const now = Date.now()
    const idx = this.data.conversations.findIndex((c) => c.id === conversation.id)
    const toSave: Conversation = { ...conversation, updatedAt: now }
    if (idx >= 0) {
      this.data.conversations[idx] = toSave
    } else {
      toSave.createdAt = now
      this.data.conversations.unshift(toSave)
    }
    this.persist()
    return { ...toSave }
  }

  deleteConversation(id: string): void {
    this.load()
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id)
    this.persist()
  }
}

// 单例
let storeInstance: Store | null = null

export function getStore(): Store {
  if (!storeInstance) storeInstance = new Store()
  return storeInstance
}

export { randomUUID }
