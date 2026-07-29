import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 应用内浏览器：在当前窗口内用 <webview> 覆盖浏览网页，对话保留在背后。
 * 顶部工具栏提供「返回对话」按钮，点击即回到对话页面（状态完整保留）。
 */
export function InAppBrowser() {
  const url = useStore((s) => s.browserUrl)
  const closeBrowser = useStore((s) => s.closeBrowser)

  const containerRef = useRef<HTMLDivElement>(null)
  const wvRef = useRef<any>(null)

  const [addr, setAddr] = useState(url ?? '')
  const [canBack, setCanBack] = useState(false)
  const [canFwd, setCanFwd] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!url || !containerRef.current) return

    setAddr(url)
    const wv = document.createElement('webview') as any
    wv.src = url
    wv.allowpopups = ''
    wv.style.width = '100%'
    wv.style.height = '100%'
    wv.style.border = 'none'
    wv.style.flex = '1'
    containerRef.current.appendChild(wv)
    wvRef.current = wv

    const updateNav = (): void => {
      setCanBack(wv.canGoBack?.() ?? false)
      setCanFwd(wv.canGoForward?.() ?? false)
    }
    const onNav = (e: any): void => setAddr(e.url)
    wv.addEventListener('did-start-loading', () => setLoading(true))
    wv.addEventListener('did-stop-loading', () => {
      setLoading(false)
      updateNav()
    })
    wv.addEventListener('did-navigate', onNav)
    wv.addEventListener('did-navigate-in-page', onNav)
    wv.addEventListener('dom-ready', updateNav)

    return () => {
      wv.removeAllListeners?.()
      if (wv.parentNode) wv.parentNode.removeChild(wv)
      wvRef.current = null
    }
  }, [url])

  if (!url) return null

  function navigate(val: string): void {
    let v = val.trim()
    if (!v) return
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v
    if (wvRef.current) {
      wvRef.current.src = v
      setAddr(v)
    }
  }

  return (
    <div className="in-app-browser">
      <div className="iab-toolbar">
        <button
          className="iab-back-btn"
          title="返回对话"
          onClick={closeBrowser}
        >
          ‹ 返回对话
        </button>
        <button
          className="iab-nav-btn"
          title="后退"
          disabled={!canBack}
          onClick={() => wvRef.current?.goBack?.()}
        >
          ‹
        </button>
        <button
          className="iab-nav-btn"
          title="前进"
          disabled={!canFwd}
          onClick={() => wvRef.current?.goForward?.()}
        >
          ›
        </button>
        <button
          className="iab-nav-btn"
          title="刷新"
          onClick={() => wvRef.current?.reload?.()}
        >
          ⟳
        </button>
        <div className="iab-addr">
          <span className="iab-lock">🔒</span>
          <input
            value={addr}
            spellCheck={false}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate((e.target as HTMLInputElement).value)
            }}
          />
        </div>
        <button
          className="iab-nav-btn"
          title="在系统浏览器打开"
          onClick={() => {
            const u = wvRef.current?.src
            if (u) window.chatbox.openExternal(u)
          }}
        >
          ⤢
        </button>
      </div>
      {loading && <div className="iab-loading" />}
      <div ref={containerRef} className="iab-webview-container" />
    </div>
  )
}
