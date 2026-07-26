import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { SendIcon, StopIcon } from './Icons'

export function MessageInput() {
  const isStreaming = useStore((s) => s.isStreaming)
  const sendMessage = useStore((s) => s.sendMessage)
  const stopStreaming = useStore((s) => s.stopStreaming)
  const models = useStore((s) => s.models)

  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自适应高度
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  function handleSend(): void {
    const t = text.trim()
    if (!t || isStreaming) return
    setText('')
    void sendMessage(t)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input-wrapper">
      <div className="message-input-box">
        <textarea
          ref={textareaRef}
          className="message-textarea"
          placeholder={
            models.length === 0
              ? '请先在设置中配置模型…'
              : '输入消息，Enter 发送，Shift+Enter 换行'
          }
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {isStreaming ? (
          <button
            className="send-btn stop"
            onClick={() => stopStreaming()}
            title="停止生成"
          >
            <StopIcon width={18} height={18} />
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!text.trim()}
            title="发送"
          >
            <SendIcon width={18} height={18} />
          </button>
        )}
      </div>
      <p className="input-hint">
        Chatbox++
        通过你提供的 API Key 调用 OpenAI 兼容接口，请确保网络可访问你的模型服务。
      </p>
    </div>
  )
}
