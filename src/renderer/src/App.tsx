import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ChatHeader } from './components/ChatHeader'
import { MessageBubble } from './components/MessageBubble'
import { MessageInput } from './components/MessageInput'
import { SettingsModal } from './components/SettingsModal'
import { ChatIcon, PlusIcon } from './components/Icons'

export default function App() {
  const initialized = useStore((s) => s.initialized)
  const init = useStore((s) => s.init)
  const conversations = useStore((s) => s.conversations)
  const currentId = useStore((s) => s.currentConversationId)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const createConversation = useStore((s) => s.createConversation)
  const models = useStore((s) => s.models)
  const isStreaming = useStore((s) => s.isStreaming)
  const theme = useStore((s) => s.settings.theme)

  const [isDark, setIsDark] = useState(false)

  // 初始化数据
  useEffect(() => {
    void init()
  }, [init])

  // 主题应用
  useEffect(() => {
    function apply(): void {
      let dark: boolean
      if (theme === 'system') {
        dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      } else {
        dark = theme === 'dark'
      }
      setIsDark(dark)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    return undefined
  }, [theme])

  if (!initialized) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">＋</div>
        <p>正在加载 Chatbox++…</p>
      </div>
    )
  }

  const currentConv = conversations.find((c) => c.id === currentId)

  return (
    <div className={`app ${isDark ? 'dark' : 'light'}`}>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="chat-area">
        {currentConv ? (
          <>
            <ChatHeader />
            <div className="messages-container">
              {currentConv.messages.length === 0 ? (
                <div className="welcome">
                  <div className="welcome-logo">＋</div>
                  <h1>Chatbox++</h1>
                  <p>简洁美观的 AI 对话助手</p>
                  {models.length === 0 ? (
                    <div className="welcome-hint">
                      <p>👋 欢迎使用！请先配置你的第一个 AI 模型。</p>
                      <button
                        className="btn btn-primary"
                        onClick={() => setSettingsOpen(true, 'models')}
                      >
                        <PlusIcon width={16} height={16} />
                        配置模型
                      </button>
                    </div>
                  ) : (
                    <div className="welcome-suggestions">
                      <p className="muted">试试问我：</p>
                      <div className="suggestion-chips">
                        {[
                          '用一句话介绍你自己',
                          '帮我写一首关于秋天的诗',
                          '解释一下量子纠缠'
                        ].map((s) => (
                          <button
                            key={s}
                            className="suggestion-chip"
                            onClick={() => useStore.getState().sendMessage(s)}
                            disabled={isStreaming}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="messages-list">
                  {currentConv.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>
              )}
            </div>
            <MessageInput />
          </>
        ) : (
          <div className="no-conversation">
            <ChatIcon width={48} height={48} />
            <h2>开始你的第一次对话</h2>
            <p>创建一个新对话，选择模型后即可开始聊天</p>
            <button className="btn btn-primary" onClick={() => createConversation()}>
              <PlusIcon width={16} height={16} />
              新建对话
            </button>
          </div>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
