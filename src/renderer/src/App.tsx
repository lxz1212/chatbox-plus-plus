import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar } from './components/Sidebar'
import { ChatHeader } from './components/ChatHeader'
import { MessageBubble } from './components/MessageBubble'
import { MessageInput } from './components/MessageInput'
import { SettingsModal } from './components/SettingsModal'
import { ConfirmDialog } from './components/ConfirmDialog'
import { InAppBrowser } from './components/InAppBrowser'

export default function App() {
  const initialized = useStore((s) => s.initialized)
  const init = useStore((s) => s.init)
  const conversations = useStore((s) => s.conversations)
  const currentId = useStore((s) => s.currentConversationId)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
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
  const hasMessages = !!currentConv && currentConv.messages.length > 0

  return (
    <div className={`app ${isDark ? 'dark' : 'light'}`}>
      <Sidebar onOpenSettings={() => setSettingsOpen(true)} />

      <main className="chat-area">
        <ChatHeader />
        <div className="messages-container">
          {hasMessages ? (
            <div className="messages-list">
              {currentConv!.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>
          ) : (
            <div className="chat-empty">
              <div className="chat-empty-logo">＋</div>
              <p>输入消息，开始新的对话</p>
            </div>
          )}
        </div>
        <MessageInput />
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <ConfirmDialog />
      <InAppBrowser />
    </div>
  )
}
