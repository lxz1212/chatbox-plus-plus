import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import type { ChatMessage } from '@shared/types'
import { CopyIcon, CheckIcon, BrainIcon } from './Icons'

interface MessageBubbleProps {
  message: ChatMessage
}

// 将 LaTeX 数学定界符转换为 remark-math 支持的 $ 定界符
// \( ... \) → $ ... $（行内），\[ ... \] → $$ ... $$（块级）
// remark-math 官方不支持 \( \) / \[ \] 定界符，需在解析前预处理。
// 同时 trim 公式内部空白并吸收公式外部紧邻空白：否则像 `**\( E \) **`
// 这类写法，闭合 ** 前会残留空格，导致强调标记配对错位、** 被原样显示。
function preprocessMath(text: string): string {
  const PH = '\u0000'
  let s = text
    .replace(/\\\[(.+?)\\\]/gs, (_, m) => `$$${m.trim()}$$`)
    .replace(/\\\((.+?)\\\)/g, (_, m) => `${PH}${m.trim()}${PH}`)
  // 相邻公式间的空白压缩为单个空格，避免 $a$$b$ 被合并为一个公式
  s = s.replace(new RegExp(`(${PH})[ \\t]*(${PH})`, 'g'), '$1 $2')
  // 吸收公式外部的紧邻空白，使公式贴紧相邻文字/强调标记
  s = s.replace(new RegExp(`(?<!${PH})[ \\t]*(${PH})`, 'g'), '$1')
  s = s.replace(new RegExp(`(${PH})[ \\t]*(?!${PH})`, 'g'), '$1')
  return s.replace(new RegExp(PH, 'g'), '$')
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
            <div className="reasoning-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessMath(message.reasoning)}
              </ReactMarkdown>
            </div>
          </details>
        )}

        <div className={`message-content ${isUser ? 'user' : 'assistant'}`}>
          {isUser ? (
            <div className="plain-text">
              <ReactMarkdown
                remarkPlugins={[remarkBreaks, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {preprocessMath(message.content)}
              </ReactMarkdown>
            </div>
          ) : message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {preprocessMath(message.content)}
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
