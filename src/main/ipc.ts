import { app, ipcMain, shell } from 'electron'
import { getStore, randomUUID } from './store'
import { abortChat, streamChat } from './chat'
import type { ChatRequestParams } from '../shared/types'

export function registerIpcHandlers(): void {
  // 应用版本
  ipcMain.handle('app:version', () => app.getVersion())

  // 在系统浏览器中打开外部链接
  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      void shell.openExternal(url)
    }
  })

  // ---------- 模型 ----------
  ipcMain.handle('store:getModels', () => getStore().getModels())

  ipcMain.handle('store:saveModel', (_e, model) => getStore().saveModel(model))

  ipcMain.handle('store:deleteModel', (_e, id: string) =>
    getStore().deleteModel(id)
  )

  // ---------- 对话 ----------
  ipcMain.handle('store:getConversations', () => getStore().getConversations())

  ipcMain.handle('store:saveConversation', (_e, conversation) =>
    getStore().saveConversation(conversation)
  )

  ipcMain.handle('store:deleteConversation', (_e, id: string) =>
    getStore().deleteConversation(id)
  )

  // ---------- 设置 ----------
  ipcMain.handle('store:getSettings', () => getStore().getSettings())

  ipcMain.handle('store:saveSettings', (_e, settings) =>
    getStore().saveSettings(settings)
  )

  // ---------- 对话请求 ----------
  ipcMain.handle('chat:send', (event, params: ChatRequestParams) => {
    const requestId = randomUUID()
    // 不等待：立即返回 requestId，流式结果通过事件推送
    void streamChat(event.sender, requestId, params)
    return requestId
  })

  ipcMain.handle('chat:abort', (_e, requestId: string) => {
    abortChat(requestId)
  })
}
