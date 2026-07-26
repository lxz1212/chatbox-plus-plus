import { useStore } from '../store'

/**
 * 通用确认对话框。
 * 由 store.dialog 状态驱动：无模型发送等场景弹出提示，确认后执行 onConfirm。
 */
export function ConfirmDialog() {
  const dialog = useStore((s) => s.dialog)
  const closeDialog = useStore((s) => s.closeDialog)

  if (!dialog) return null

  function handleConfirm(): void {
    if (!dialog) return
    const action = dialog.onConfirm
    closeDialog()
    if (action) action()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal confirm-dialog">
        <div className="modal-header">
          <h2>{dialog.title}</h2>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{dialog.message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={closeDialog}>
            {dialog.cancelText}
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
