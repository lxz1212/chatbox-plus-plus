import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { ModelConfig, ThinkingLevel, ThinkingMode } from '@shared/types'
import { ChevronDownIcon, BrainIcon, TrashIcon } from './Icons'
import { ALL_THINKING_LEVELS } from '@shared/types'

const LEVEL_LABEL: Record<ThinkingLevel, string> = {
  default: '默认',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '超高',
  max: '极致'
}

export function ChatHeader() {
  const models = useStore((s) => s.models)
  const conversations = useStore((s) => s.conversations)
  const currentId = useStore((s) => s.currentConversationId)
  const setCurrentModel = useStore((s) => s.setCurrentModel)
  const setThinkingMode = useStore((s) => s.setThinkingMode)
  const setThinkingLevel = useStore((s) => s.setThinkingLevel)
  const clearMessages = useStore((s) => s.clearMessages)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  const conv = conversations.find((c) => c.id === currentId)
  const [modelOpen, setModelOpen] = useState(false)
  const [levelOpen, setLevelOpen] = useState(false)
  const modelRef = useRef<HTMLDivElement>(null)
  const levelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
      if (levelRef.current && !levelRef.current.contains(e.target as Node)) {
        setLevelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!conv) return null

  const currentModel = models.find((m) => m.id === conv.modelId)

  // 思考模式：模型支持多种模式且可开可关时，才显示思考开关
  const modes = currentModel?.thinkingModes ?? []
  const hasEnabled = modes.includes('enabled')
  const hasDisabled = modes.includes('disabled')
  const hasDefault = modes.includes('default')
  const canToggleOff = hasDisabled || hasDefault
  const showThinkingToggle =
    hasEnabled && canToggleOff && modes.length >= 2

  // 当前是否处于思考模式
  const thinkingOn = conv.thinkingMode === 'enabled'
  // 关闭思考时使用的模式（优先 disabled，否则 default）
  const offMode: ThinkingMode = hasDisabled ? 'disabled' : 'default'

  // 思考强度：仅在思考开启且存在多个可选等级时显示
  const levels = currentModel?.thinkingLevels ?? []
  const showThinkingLevel = thinkingOn && levels.length > 1
  const levelOptions = ALL_THINKING_LEVELS.filter((lv) =>
    levels.includes(lv)
  )

  return (
    <div className="chat-header">
      <div className="header-left">
        {/* 模型选择 */}
        <div className="dropdown" ref={modelRef}>
          <button
            className="dropdown-trigger model-trigger"
            onClick={() => setModelOpen((v) => !v)}
            title="选择模型"
          >
            <span className="model-name">
              {currentModel ? currentModel.name : '选择模型'}
            </span>
            {currentModel && (
              <span className="model-id">{currentModel.modelId}</span>
            )}
            <ChevronDownIcon width={16} height={16} />
          </button>
          {modelOpen && (
            <div className="dropdown-menu">
              {models.length === 0 ? (
                <div className="dropdown-empty">尚未配置任何模型</div>
              ) : (
                models.map((m: ModelConfig) => (
                  <div
                    key={m.id}
                    className={`dropdown-item ${m.id === conv.modelId ? 'selected' : ''}`}
                    onClick={() => {
                      setCurrentModel(m.id)
                      setModelOpen(false)
                    }}
                  >
                    <div className="model-item-info">
                      <span className="model-item-name">{m.name}</span>
                      <span className="model-item-id">{m.modelId}</span>
                    </div>
                    {m.id === conv.modelId && <span className="dot">●</span>}
                  </div>
                ))
              )}
              <div
                className="dropdown-item add-model"
                onClick={() => {
                  setModelOpen(false)
                  setSettingsOpen(true, 'models')
                }}
              >
                <span>＋ 管理模型</span>
              </div>
            </div>
          )}
        </div>

        {/* 思考开关（模型支持多种思考模式时显示） */}
        {showThinkingToggle && (
          <label className="thinking-toggle" title="开启后模型会先思考再回答">
            <BrainIcon width={16} height={16} />
            <span>思考</span>
            <button
              type="button"
              className={`switch ${thinkingOn ? 'on' : ''}`}
              onClick={() => setThinkingMode(thinkingOn ? offMode : 'enabled')}
            >
              <span className="switch-knob" />
            </button>
          </label>
        )}

        {/* 思考强度选择 */}
        {showThinkingLevel && (
          <div className="dropdown" ref={levelRef}>
            <button
              className="dropdown-trigger level-trigger"
              onClick={() => setLevelOpen((v) => !v)}
              title="思考强度"
            >
              <BrainIcon width={14} height={14} />
              <span>
                {conv.thinkingLevel
                  ? `强度：${LEVEL_LABEL[conv.thinkingLevel]}`
                  : '思考强度'}
              </span>
              <ChevronDownIcon width={14} height={14} />
            </button>
            {levelOpen && (
              <div className="dropdown-menu">
                {levelOptions.map((lv) => (
                  <div
                    key={lv}
                    className={`dropdown-item ${conv.thinkingLevel === lv ? 'selected' : ''}`}
                    onClick={() => {
                      setThinkingLevel(lv)
                      setLevelOpen(false)
                    }}
                  >
                    <span>{LEVEL_LABEL[lv]}</span>
                    {conv.thinkingLevel === lv && <span className="dot">●</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-right">
        {conv.messages.length > 0 && (
          <button
            className="icon-btn"
            title="清空当前对话消息"
            onClick={() => clearMessages(conv.id)}
          >
            <TrashIcon width={16} height={16} />
          </button>
        )}
      </div>
    </div>
  )
}
