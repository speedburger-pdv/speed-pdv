import { useEffect, useRef } from 'react'

export default function NativeModal({ open, title, children, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onClose, danger = false }) {
  const bodyRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const timer = window.setTimeout(() => {
      const alvo = bodyRef.current?.querySelector('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      alvo?.focus()
    }, 30)

    function onKey(event) {
      if (event.key === 'Escape') onCloseRef.current?.()
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>{title}</strong>
          <button className="ghost-btn compact-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" ref={bodyRef}>
          {children}
        </div>
        <div className="modal-actions">
          <button className="ghost-btn compact-btn" onClick={onClose}>{cancelLabel}</button>
          <button className={`${danger ? 'danger-btn' : 'primary-btn'} compact-btn`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
