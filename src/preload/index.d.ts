import type { ChatboxAPI } from '../shared/types'

declare global {
  interface Window {
    chatbox: ChatboxAPI
  }
}

export {}
