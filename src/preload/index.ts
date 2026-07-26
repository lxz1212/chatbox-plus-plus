import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  ChatChunkEvent,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatRequestParams,
  Conversation,
  ModelConfig
} from '../shared/types'

const chatbox = {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  platform: process.platform,

  // 模型
  getModels: (): Promise<ModelConfig[]> => ipcRenderer.invoke('store:getModels'),
  saveModel: (model: ModelConfig): Promise<ModelConfig> =>
    ipcRenderer.invoke('store:saveModel', model),
  deleteModel: (id: string): Promise<void> =>
    ipcRenderer.invoke('store:deleteModel', id),

  // 对话
  getConversations: (): Promise<Conversation[]> =>
    ipcRenderer.invoke('store:getConversations'),
  saveConversation: (conversation: Conversation): Promise<Conversation> =>
    ipcRenderer.invoke('store:saveConversation', conversation),
  deleteConversation: (id: string): Promise<void> =>
    ipcRenderer.invoke('store:deleteConversation', id),

  // 设置
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke('store:getSettings'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke('store:saveSettings', settings),

  // 对话请求
  chatSend: (params: ChatRequestParams): Promise<string> =>
    ipcRenderer.invoke('chat:send', params),
  chatAbort: (requestId: string): Promise<void> =>
    ipcRenderer.invoke('chat:abort', requestId),

  onChatChunk: (cb: (e: ChatChunkEvent) => void): (() => void) => {
    const handler = (_e: unknown, data: ChatChunkEvent): void => cb(data)
    ipcRenderer.on('chat:chunk', handler)
    return () => ipcRenderer.off('chat:chunk', handler)
  },
  onChatDone: (cb: (e: ChatDoneEvent) => void): (() => void) => {
    const handler = (_e: unknown, data: ChatDoneEvent): void => cb(data)
    ipcRenderer.on('chat:done', handler)
    return () => ipcRenderer.off('chat:done', handler)
  },
  onChatError: (cb: (e: ChatErrorEvent) => void): (() => void) => {
    const handler = (_e: unknown, data: ChatErrorEvent): void => cb(data)
    ipcRenderer.on('chat:error', handler)
    return () => ipcRenderer.off('chat:error', handler)
  }
}

contextBridge.exposeInMainWorld('chatbox', chatbox)

export type ChatboxAPI = typeof chatbox
