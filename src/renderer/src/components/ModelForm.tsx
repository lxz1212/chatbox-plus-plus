import { useState, useEffect } from 'react'
import {
  ALL_THINKING_LEVELS,
  type ModelConfig,
  type ThinkingLevel,
  type ThinkingType
} from '@shared/types'

interface ModelFormProps {
  initial?: ModelConfig | null
  onSave: (data: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

const THINKING_TYPE_OPTIONS: {
  value: ThinkingType
  label: string
  desc: string
}[] = [
  { value: 'thinking', label: '仅思考', desc: '对话时始终启用思考' },
  { value: 'non-thinking', label: '仅非思考', desc: '对话时不启用思考' },
  {
    value: 'selectable',
    label: '可在对话时选择',
    desc: '在对话界面提供思考开关'
  }
]

const LEVEL_LABEL: Record<ThinkingLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '超高',
  max: '最大'
}

const DEFAULT_FORM = {
  name: '',
  apiBase: 'https://api.openai.com/v1',
  apiKey: '',
  modelId: '',
  temperature: '',
  topP: '',
  n: '',
  presencePenalty: '',
  frequencyPenalty: '',
  maxTokens: '',
  thinkingType: 'non-thinking' as ThinkingType,
  thinkingLevels: [] as ThinkingLevel[]
}

export function ModelForm({ initial, onSave, onCancel }: ModelFormProps) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        apiBase: initial.apiBase,
        apiKey: initial.apiKey,
        modelId: initial.modelId,
        temperature:
          initial.temperature == null ? '' : String(initial.temperature),
        topP: initial.topP == null ? '' : String(initial.topP),
        n: initial.n == null ? '' : String(initial.n),
        presencePenalty:
          initial.presencePenalty == null
            ? ''
            : String(initial.presencePenalty),
        frequencyPenalty:
          initial.frequencyPenalty == null
            ? ''
            : String(initial.frequencyPenalty),
        maxTokens: initial.maxTokens == null ? '' : String(initial.maxTokens),
        thinkingType: initial.thinkingType,
        thinkingLevels: [...initial.thinkingLevels]
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setError('')
  }, [initial])

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleLevel(level: ThinkingLevel): void {
    setForm((f) => ({
      ...f,
      thinkingLevels: f.thinkingLevels.includes(level)
        ? f.thinkingLevels.filter((l) => l !== level)
        : [...f.thinkingLevels, level]
    }))
  }

  function handleSubmit(): void {
    if (!form.name.trim()) return setError('请填写模型显示名称')
    if (!form.apiBase.trim()) return setError('请填写 API 基础地址')
    if (!form.apiKey.trim()) return setError('请填写 API Key')
    if (!form.modelId.trim()) return setError('请填写模型 ID')

    if (form.thinkingType !== 'non-thinking' && form.thinkingLevels.length === 0) {
      return setError('选择了思考模式后，至少需要勾选一个思考强度等级')
    }

    const num = (v: string): number | null => {
      if (v.trim() === '') return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    onSave({
      name: form.name.trim(),
      apiBase: form.apiBase.trim(),
      apiKey: form.apiKey.trim(),
      modelId: form.modelId.trim(),
      temperature: num(form.temperature),
      topP: num(form.topP),
      n: num(form.n),
      presencePenalty: num(form.presencePenalty),
      frequencyPenalty: num(form.frequencyPenalty),
      maxTokens: num(form.maxTokens),
      thinkingType: form.thinkingType,
      thinkingLevels:
        form.thinkingType === 'non-thinking' ? [] : [...form.thinkingLevels]
    })
  }

  const showLevels = form.thinkingType !== 'non-thinking'

  return (
    <div className="modal-backdrop">
      <div className="modal model-form-modal">
        <div className="modal-header">
          <h2>{initial ? '编辑模型' : '添加模型'}</h2>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="form-section">
            <h3 className="form-section-title">基础信息</h3>
            <div className="form-row">
              <label className="form-label">
                <span>
                  显示名称 <em>*</em>
                </span>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="例如：GPT-4o"
                />
              </label>
              <label className="form-label">
                <span>
                  模型 ID <em>*</em>
                </span>
                <input
                  className="form-input"
                  value={form.modelId}
                  onChange={(e) => set('modelId', e.target.value)}
                  placeholder="例如：gpt-4o"
                />
              </label>
            </div>
            <label className="form-label">
              <span>
                API 基础地址 <em>*</em>
              </span>
              <input
                className="form-input"
                value={form.apiBase}
                onChange={(e) => set('apiBase', e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </label>
            <label className="form-label">
              <span>
                API Key <em>*</em>
              </span>
              <input
                className="form-input"
                type="password"
                value={form.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder="sk-..."
              />
            </label>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">
              生成参数（留空则使用服务端默认值）
            </h3>
            <div className="form-grid-3">
              <label className="form-label">
                <span>temperature</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => set('temperature', e.target.value)}
                  placeholder="0.0 - 2.0"
                />
              </label>
              <label className="form-label">
                <span>top_p</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.05"
                  value={form.topP}
                  onChange={(e) => set('topP', e.target.value)}
                  placeholder="0.0 - 1.0"
                />
              </label>
              <label className="form-label">
                <span>n</span>
                <input
                  className="form-input"
                  type="number"
                  step="1"
                  value={form.n}
                  onChange={(e) => set('n', e.target.value)}
                  placeholder="1, 2, ..."
                />
              </label>
              <label className="form-label">
                <span>presence_penalty</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  value={form.presencePenalty}
                  onChange={(e) => set('presencePenalty', e.target.value)}
                  placeholder="-2.0 - 2.0"
                />
              </label>
              <label className="form-label">
                <span>frequency_penalty</span>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  value={form.frequencyPenalty}
                  onChange={(e) => set('frequencyPenalty', e.target.value)}
                  placeholder="-2.0 - 2.0"
                />
              </label>
              <label className="form-label">
                <span>max_tokens</span>
                <input
                  className="form-input"
                  type="number"
                  step="1"
                  value={form.maxTokens}
                  onChange={(e) => set('maxTokens', e.target.value)}
                  placeholder="例如：4096"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">思考模式</h3>
            <div className="thinking-type-options">
              {THINKING_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`radio-card ${form.thinkingType === opt.value ? 'checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="thinkingType"
                    checked={form.thinkingType === opt.value}
                    onChange={() => set('thinkingType', opt.value)}
                  />
                  <div className="radio-card-body">
                    <span className="radio-card-title">{opt.label}</span>
                    <span className="radio-card-desc">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            {showLevels && (
              <div className="thinking-levels">
                <p className="levels-hint">
                  勾选该模型支持的所有思考强度等级（用户在对话时只能从中选择）：
                </p>
                <div className="level-chips">
                  {ALL_THINKING_LEVELS.map((lv) => {
                    const on = form.thinkingLevels.includes(lv)
                    return (
                      <button
                        key={lv}
                        type="button"
                        className={`chip ${on ? 'on' : ''}`}
                        onClick={() => toggleLevel(lv)}
                      >
                        {LEVEL_LABEL[lv]}（{lv}）
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {initial ? '保存修改' : '添加模型'}
          </button>
        </div>
      </div>
    </div>
  )
}
