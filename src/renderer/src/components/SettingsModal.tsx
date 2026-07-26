import { useState } from 'react'
import { useStore } from '../store'
import { ModelForm } from './ModelForm'
import { CloseIcon, PlusIcon, EditIcon, TrashIcon } from './Icons'
import type {
  ModelConfig,
  ThinkingLevel,
  ThinkingMode,
  ThemeMode
} from '@shared/types'

const LEVEL_LABEL: Record<ThinkingLevel, string> = {
  default: '默认',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '超高',
  max: '极致'
}

const THINKING_MODE_LABEL: Record<ThinkingMode, string> = {
  default: '默认',
  enabled: '开启',
  disabled: '关闭'
}

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const tab = useStore((s) => s.settingsTab)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const setTheme = useStore((s) => s.setTheme)

  const models = useStore((s) => s.models)
  const addModel = useStore((s) => s.addModel)
  const updateModel = useStore((s) => s.updateModel)
  const removeModel = useStore((s) => s.removeModel)

  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const [showForm, setShowForm] = useState(false)

  function openAdd(): void {
    setEditing(null)
    setShowForm(true)
  }
  function openEdit(m: ModelConfig): void {
    setEditing(m)
    setShowForm(true)
  }

  async function handleSave(
    data: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    if (editing) {
      await updateModel({ ...editing, ...data })
    } else {
      await addModel(data)
    }
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(m: ModelConfig): Promise<void> {
    if (confirm(`确定删除模型「${m.name}」吗？`)) {
      await removeModel(m.id)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2>设置</h2>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className="settings-layout">
          <div className="settings-tabs">
            <button
              className={`settings-tab ${tab === 'general' ? 'active' : ''}`}
              onClick={() => setSettingsOpen(true, 'general')}
            >
              通用设置
            </button>
            <button
              className={`settings-tab ${tab === 'models' ? 'active' : ''}`}
              onClick={() => setSettingsOpen(true, 'models')}
            >
              模型管理
            </button>
          </div>

          <div className="settings-content">
            {tab === 'models' && (
              <div className="models-panel">
                <div className="panel-header">
                  <h3>已配置的模型</h3>
                  <button className="btn btn-primary small" onClick={openAdd}>
                    <PlusIcon width={14} height={14} />
                    添加模型
                  </button>
                </div>

                {models.length === 0 ? (
                  <div className="empty-state">
                    <p>还没有配置任何模型</p>
                    <p className="muted">
                      点击「添加模型」开始配置你的第一个 AI 模型
                    </p>
                  </div>
                ) : (
                  <div className="model-list">
                    {models.map((m) => (
                      <div key={m.id} className="model-card">
                        <div className="model-card-main">
                          <div className="model-card-title">
                            <span className="model-card-name">{m.name}</span>
                            <span className="model-card-id">{m.modelId}</span>
                          </div>
                          <div className="model-card-meta">
                            <span className="tag">{m.apiBase}</span>
                            <span className="tag thinking-tag">
                              思考：
                              {m.thinkingModes
                                .map((mode) => THINKING_MODE_LABEL[mode])
                                .join(' / ')}
                            </span>
                            {m.thinkingLevels.length > 0 && (
                              <span className="tag levels-tag">
                                强度：
                                {m.thinkingLevels
                                  .map((lv) => LEVEL_LABEL[lv])
                                  .join(' / ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="model-card-actions">
                          <button
                            className="icon-btn"
                            title="编辑"
                            onClick={() => openEdit(m)}
                          >
                            <EditIcon width={16} height={16} />
                          </button>
                          <button
                            className="icon-btn danger"
                            title="删除"
                            onClick={() => handleDelete(m)}
                          >
                            <TrashIcon width={16} height={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'general' && (
              <div className="general-panel">
                <div className="form-section">
                  <h3 className="form-section-title">主题</h3>
                  <div className="theme-options">
                    {(
                      [
                        { value: 'light', label: '浅色' },
                        { value: 'dark', label: '深色' },
                        { value: 'system', label: '跟随系统' }
                      ] as { value: ThemeMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        className={`theme-btn ${settings.theme === opt.value ? 'active' : ''}`}
                        onClick={() => setTheme(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">默认模型</h3>
                  <p className="section-desc">新建对话时默认使用的模型。</p>
                  <select
                    className="form-input select-input"
                    value={settings.defaultModelId ?? ''}
                    onChange={(e) =>
                      updateSettings({
                        defaultModelId: e.target.value || null
                      })
                    }
                  >
                    <option value="">不设置默认模型</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}（{m.modelId}）
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-section">
                  <h3 className="form-section-title">系统提示词</h3>
                  <p className="section-desc">
                    将作为 system 消息发送给所有模型（为空则不发送）。
                  </p>
                  <textarea
                    className="form-input textarea-input"
                    rows={5}
                    placeholder="例如：你是一个乐于助人的助手。"
                    value={settings.systemPrompt}
                    onChange={(e) =>
                      updateSettings({ systemPrompt: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <ModelForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
