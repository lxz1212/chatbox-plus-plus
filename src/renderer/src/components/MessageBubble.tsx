import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@shared/types'
import { CopyIcon, CheckIcon, BrainIcon } from './Icons'

interface MessageBubbleProps {
  message: ChatMessage
}

function MessageBubbleBase({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  function copyContent(): void {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'}`}>
      <div className="message-avatar">{isUser ? '我' : 'AI'}</div>
      <div className="message-body">
        {message.reasoning && (
          <details
            className="reasoning-box"
            open={message.streaming && !message.content}
          >
            <summary>
              <BrainIcon width={14} height={14} />
              <span>思考过程</span>
            </summary>
            <div className="reasoning-content">{message.reasoning}</div>
          </details>
        )}

        <div className={`message-content ${isUser ? 'user' : 'assistant'}`}>
          {isUser ? (
            <div className="plain-text">{message.content}</div>
          ) : message.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          ) : message.streaming ? (
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          ) : null}

          {message.streaming && message.content && (
            <span className="cursor-blink">▋</span>
          )}
        </div>

        {!isUser && !message.streaming && message.content && (
          <div className="message-actions">
            <button className="msg-action-btn" onClick={copyContent} title="复制">
              {copied ? (
                <CheckIcon width={14} height={14} />
              ) : (
                <CopyIcon width={14} height={14} />
              )}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export const MessageBubble = memo(MessageBubbleBase)
