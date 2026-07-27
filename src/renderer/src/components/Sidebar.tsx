import { useState } from 'react'
import { useStore } from '../store'
import {
  PlusIcon,
  ChatIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  CloseIcon
} from './Icons'
import type { Conversation } from '@shared/types'

interface SidebarProps {
  onOpenSettings: () => void
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const conversations = useStore((s) => s.conversations)
  const currentId = useStore((s) => s.currentConversationId)
  const selectConversation = useStore((s) => s.selectConversation)
  const createConversation = useStore((s) => s.createConversation)
  const removeConversation = useStore((s) => s.removeConversation)
  const renameConversation = useStore((s) => s.renameConversation)

  const visibleConversations = conversations.filter((c) => c.visible)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  function startEdit(c: Conversation): void {
    setEditingId(c.id)
    setEditText(c.title)
  }

  function commitEdit(): void {
    if (editingId) {
      renameConversation(editingId, editText.trim() || '新对话')
    }
    setEditingId(null)
    setEditText('')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-name">Chatbox++</span>
        </div>
        <button className="new-chat-btn" onClick={() => createConversation()}>
          <PlusIcon width={16} height={16} />
          <span>新对话</span>
        </button>
      </div>

      <div className="conversation-list">
        {visibleConversations.length === 0 && (
          <div className="empty-tip">
            <ChatIcon width={36} height={36} />
            <p>还没有对话</p>
            <span>点击「新对话」开始</span>
          </div>
        )}
        {visibleConversations.map((c) => {
          const active = c.id === currentId
          const editing = editingId === c.id
          return (
            <div
              key={c.id}
              className={`conversation-item ${active ? 'active' : ''}`}
              onClick={() => !editing && selectConversation(c.id)}
            >
              <ChatIcon width={16} height={16} className="conv-icon" />
              {editing ? (
                <input
                  className="conv-edit-input"
                  value={editText}
                  autoFocus
                  onChange={(e) => setEditText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') {
                      setEditingId(null)
                      setEditText('')
                    }
                  }}
                />
              ) : (
                <span className="conv-title">{c.title}</span>
              )}
              <div className="conv-actions">
                {editing ? (
                  <>
                    <button
                      className="icon-btn small"
                      title="确定"
                      onClick={(e) => {
                        e.stopPropagation()
                        commitEdit()
                      }}
                    >
                      <CheckIcon width={14} height={14} />
                    </button>
                    <button
                      className="icon-btn small"
                      title="取消"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingId(null)
                        setEditText('')
                      }}
                    >
                      <CloseIcon width={14} height={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="icon-btn small"
                      title="重命名"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEdit(c)
                      }}
                    >
                      <EditIcon width={14} height={14} />
                    </button>
                    <button
                      className="icon-btn small danger"
                      title="删除"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeConversation(c.id)
                      }}
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <button className="footer-btn" onClick={onOpenSettings}>
          <span className="footer-btn-icon">⚙</span>
          <span>设置</span>
        </button>
        <span className="version-text">v1.3.1</span>
      </div>
    </aside>
  )
}
