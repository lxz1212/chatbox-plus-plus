import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { ModelConfig, ThinkingLevel, ThinkingMode, ThinkingKeep } from '@shared/types'
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

const MODE_LABEL: Record<ThinkingMode, string> = {
  default: '默认',
  enabled: '开启',
  disabled: '关闭'
}

const KEEP_LABEL: Record<ThinkingKeep, string> = {
  default: '默认',
  enabled: '开启',
  disabled: '关闭'
}

/** 保留式思考下拉菜单的固定排列顺序 */
const THINKING_KEEP_ORDER: ThinkingKeep[] = ['default', 'enabled', 'disabled']

/** 思考模式下拉菜单的固定排列顺序 */
const THINKING_MODE_ORDER: ThinkingMode[] = ['default', 'enabled', 'disabled']

export function ChatHeader() {
  const models = useStore((s) => s.models)
  const conversations = useStore((s) => s.conversations)
  const currentId = useStore((s) => s.currentConversationId)
  const setCurrentModel = useStore((s) => s.setCurrentModel)
  const setThinkingMode = useStore((s) => s.setThinkingMode)
  const setThinkingLevel = useStore((s) => s.setThinkingLevel)
  const setThinkingKeep = useStore((s) => s.setThinkingKeep)
  const clearMessages = useStore((s) => s.clearMessages)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)

  const conv = conversations.find((c) => c.id === currentId)
  const [modelOpen, setModelOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const [levelOpen, setLevelOpen] = useState(false)
  const [keepOpen, setKeepOpen] = useState(false)
  const modelRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const levelRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent): void {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
      if (levelRef.current && !levelRef.current.contains(e.target as Node)) {
        setLevelOpen(false)
      }
      if (keepRef.current && !keepRef.current.contains(e.target as Node)) {
        setKeepOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!conv) return null

  const currentModel = models.find((m) => m.id === conv.modelId)

  // 思考模式：只要模型配置了思考模式就显示下拉菜单（即使只有一个可选项）
  const modes = currentModel?.thinkingModes ?? []
  const showThinkingToggle = modes.length >= 1

  // 思考模式可选项（按固定顺序：默认、开启、关闭）
  const modeOptions = THINKING_MODE_ORDER.filter((m) => modes.includes(m))

  // 当前是否处于思考模式
  const thinkingOn = conv.thinkingMode === 'enabled'

  // 思考强度：开启思考时显示；"默认"模式下仅当模型允许选择强度时显示
  // 即使只有一个可选项也显示下拉菜单
  const levels = currentModel?.thinkingLevels ?? []
  const allowEffortInDefault = !!currentModel?.allowEffortInDefault
  const showThinkingLevel =
    thinkingOn || (conv.thinkingMode === 'default' && allowEffortInDefault)
  const levelOptions = ALL_THINKING_LEVELS.filter((lv) =>
    levels.includes(lv)
  )

  // 保留式思考：开启思考时显示；"默认"模式下仅当模型允许选择时显示；
  // 关闭思考时不显示（思考已关闭，保留式思考无意义）
  // 即使只有一个可选项也显示下拉菜单
  const keeps = currentModel?.thinkingKeeps ?? []
  const allowKeepInDefault = !!currentModel?.allowKeepInDefault
  const showThinkingKeep =
    keeps.length >= 1 &&
    (thinkingOn || (conv.thinkingMode === 'default' && allowKeepInDefault))
  const keepOptions = THINKING_KEEP_ORDER.filter((k) => keeps.includes(k))

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

        {/* 思考模式下拉菜单（模型支持多种思考模式时显示） */}
        {showThinkingToggle && (
          <div className="dropdown" ref={modeRef}>
            <button
              className="dropdown-trigger mode-trigger"
              onClick={() => setModeOpen((v) => !v)}
              title="思考模式"
            >
              <BrainIcon width={16} height={16} />
              <span>思考：{MODE_LABEL[conv.thinkingMode]}</span>
              <ChevronDownIcon width={14} height={14} />
            </button>
            {modeOpen && (
              <div className="dropdown-menu">
                {modeOptions.map((mode) => (
                  <div
                    key={mode}
                    className={`dropdown-item ${conv.thinkingMode === mode ? 'selected' : ''}`}
                    onClick={() => {
                      setThinkingMode(mode)
                      setModeOpen(false)
                    }}
                  >
                    <span>{MODE_LABEL[mode]}</span>
                    {conv.thinkingMode === mode && <span className="dot">●</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
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

        {/* 保留式思考选择 */}
        {showThinkingKeep && (
          <div className="dropdown" ref={keepRef}>
            <button
              className="dropdown-trigger level-trigger"
              onClick={() => setKeepOpen((v) => !v)}
              title="保留式思考"
            >
              <BrainIcon width={14} height={14} />
              <span>保留：{KEEP_LABEL[conv.thinkingKeep]}</span>
              <ChevronDownIcon width={14} height={14} />
            </button>
            {keepOpen && (
              <div className="dropdown-menu">
                {keepOptions.map((keep) => (
                  <div
                    key={keep}
                    className={`dropdown-item ${conv.thinkingKeep === keep ? 'selected' : ''}`}
                    onClick={() => {
                      setThinkingKeep(keep)
                      setKeepOpen(false)
                    }}
                  >
                    <span>{KEEP_LABEL[keep]}</span>
                    {conv.thinkingKeep === keep && <span className="dot">●</span>}
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
