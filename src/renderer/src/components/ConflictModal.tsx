import React, { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, FileText, ArrowRight, X } from 'lucide-react'
import { useExplorerStore } from '../store/useExplorerStore'
import { ConflictResolution } from '../types'

export const ConflictModal: React.FC = () => {
  const { pendingConflict, resolveConflict, cancelConflict } = useExplorerStore()
  const [rememberChoice, setRememberChoice] = useState(false)

  const handleAction = useCallback(
    (resolution: ConflictResolution) => {
      resolveConflict(resolution, rememberChoice)
    },
    [resolveConflict, rememberChoice]
  )

  useEffect(() => {
    if (!pendingConflict) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelConflict()
      } else if (e.key === '1' || e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        handleAction('overwrite')
      } else if (e.key === '2' || e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleAction('skip')
      } else if (e.key === '3' || e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        handleAction('rename')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pendingConflict, rememberChoice, cancelConflict, handleAction])

  if (!pendingConflict) return null

  const { file, slot, isCopy } = pendingConflict

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl p-6 text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>파일 이름 충돌 (File Conflict)</span>
          </div>
          <button
            onClick={cancelConflict}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-3">
          <p className="text-sm text-zinc-300">타겟 폴더에 이미 동일한 이름의 파일이 존재합니다:</p>

          <div className="bg-zinc-950/80 p-3.5 rounded-lg border border-zinc-800/80 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-200 font-medium">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate">{file.name}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
              <span className="shrink-0">동작:</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                {isCopy ? '복사 (Copy)' : '이동 (Move)'}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-200 truncate">
                Slot {slot.id} ({slot.name})
              </span>
            </div>
          </div>

          {/* Action options */}
          <div className="grid grid-cols-1 gap-2 pt-2">
            <button
              onClick={() => handleAction('overwrite')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 font-medium text-sm transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span>덮어쓰기 (Overwrite)</span>
              </div>
              <span className="text-xs text-red-400/80">[O]</span>
            </button>

            <button
              onClick={() => handleAction('rename')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 font-medium text-sm transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <span>자동 이름 변경 (Auto Rename)</span>
              </div>
              <span className="text-xs text-blue-400/80">[R]</span>
            </button>

            <button
              onClick={() => handleAction('skip')}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium text-sm transition"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <span>건너뛰기 (Skip)</span>
              </div>
              <span className="text-xs text-zinc-400">[S]</span>
            </button>
          </div>

          {/* Remember choice checkbox */}
          <label className="flex items-center gap-2.5 pt-2 text-xs text-zinc-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <span>향후 모든 충돌에도 이 선택 적용 (기본 정책으로 저장)</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-zinc-800">
          <button
            onClick={cancelConflict}
            className="px-4 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            취소 (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
