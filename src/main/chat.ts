import { net } from 'electron'
import type { WebContents } from 'electron'
import type { ChatRequestParams } from '../shared/types'

interface ActiveRequest {
  controller: AbortController
}

const activeRequests = new Map<string, ActiveRequest>()

/** 规范化 API 基础地址，去掉末尾斜杠 */
function normalizeBase(apiBase: string): string {
  return (apiBase || '').trim().replace(/\/+$/, '')
}

/** 构建请求体 */
function buildRequestBody(params: ChatRequestParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.modelId,
    messages: params.messages,
    stream: true
  }

  if (params.temperature != null) body.temperature = params.temperature
  if (params.topP != null) body.top_p = params.topP
  if (params.n != null) body.n = params.n
  if (params.presencePenalty != null)
    body.presence_penalty = params.presencePenalty
  if (params.frequencyPenalty != null)
    body.frequency_penalty = params.frequencyPenalty
  if (params.maxTokens != null) body.max_tokens = params.maxTokens

  // 思考参数：thinking 对象（含 type 与 keep 两个子字段）
  // - thinking.type：'default' 时不传入，由服务端决定
  // - thinking.keep：'default' 时不传入；'enabled' 传 "all"（保留完整 reasoning）；
  //   'disabled' 传 null（显式关闭保留式思考）；思考关闭(type=disabled)时不传入 keep
  const thinking: Record<string, unknown> = {}
  if (params.thinkingMode && params.thinkingMode !== 'default') {
    thinking.type = params.thinkingMode
  }
  // 仅在思考开启或默认模式下发送 keep；思考关闭时不发送（思考已关闭，保留式思考无意义）
  if (params.thinkingMode !== 'disabled') {
    if (params.thinkingKeep === 'enabled') {
      thinking.keep = 'all'
    } else if (params.thinkingKeep === 'disabled') {
      thinking.keep = null
    }
  }
  if (Object.keys(thinking).length > 0) {
    body.thinking = thinking
  }

  // 思考强度：reasoning_effort（'default' 或 null 时不传入）
  if (params.thinkingLevel && params.thinkingLevel !== 'default') {
    body.reasoning_effort = params.thinkingLevel
  }

  return body
}

/**
 * 发起流式对话请求，将增量通过 webContents 推送给渲染进程
 */
export async function streamChat(
  webContents: WebContents,
  requestId: string,
  params: ChatRequestParams
): Promise<void> {
  const controller = new AbortController()
  activeRequests.set(requestId, { controller })

  const base = normalizeBase(params.apiBase)
  const url = `${base}/chat/completions`

  try {
    if (webContents.isDestroyed()) return

    const response = await net.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`
      },
      body: JSON.stringify(buildRequestBody(params)),
      signal: controller.signal
    })

    if (!response.ok) {
      let detail = ''
      try {
        detail = await response.text()
      } catch {
        // ignore
      }
      throw new Error(
        `API 请求失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`
      )
    }

    if (!response.body) {
      throw new Error('API 未返回响应流')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // 最后一段可能不完整，保留到下次处理
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith(':')) continue // 注释/心跳
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') {
          continue
        }

        try {
          const json = JSON.parse(data)
          const choice = json.choices?.[0]
          if (!choice) continue
          const delta = choice.delta ?? {}

          const content: string = delta.content ?? ''
          // 兼容不同服务商：reasoning_content（DeepSeek/Qwen 等）与 reasoning
          const reasoning: string =
            delta.reasoning_content ?? delta.reasoning ?? ''

          if (content || reasoning) {
            if (webContents.isDestroyed()) return
            webContents.send('chat:chunk', {
              requestId,
              content: content || undefined,
              reasoning: reasoning || undefined
            })
          }
        } catch {
          // 忽略单行解析错误
        }
      }
    }

    if (!webContents.isDestroyed()) {
      webContents.send('chat:done', { requestId, aborted: false })
    }
  } catch (err: unknown) {
    if (webContents.isDestroyed()) return
    const e = err as { name?: string; message?: string }
    if (e?.name === 'AbortError') {
      webContents.send('chat:done', { requestId, aborted: true })
      return
    }
    webContents.send('chat:error', {
      requestId,
      error: e?.message || '发生未知错误'
    })
  } finally {
    activeRequests.delete(requestId)
  }
}

/** 中止指定请求 */
export function abortChat(requestId: string): void {
  const req = activeRequests.get(requestId)
  if (req) {
    req.controller.abort()
    activeRequests.delete(requestId)
  }
}
