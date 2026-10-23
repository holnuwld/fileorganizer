import React, { useState } from 'react'
import { Folder, Plus, X, ArrowDownRight, Copy } from 'lucide-react'
import { useExplorerStore } from '../store/useExplorerStore'

export const TargetSlots: React.FC = () => {
  const {
    slots,
    setTargetSlot,
    removeTargetSlot,
    highlightedSlot,
    setTabPath,
    activeTabId,
    moveSelectedFileToSlot
  } = useExplorerStore()

  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent, slotId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotId)
  }

  const handleDragLeave = (slotId: number) => {
    if (dragOverSlot === slotId) {
      setDragOverSlot(null)
    }
  }

  const handleDrop = async (e: React.DragEvent, slotId: number) => {
    e.preventDefault()
    setDragOverSlot(null)

    // Check json data from FolderTree or FolderContents
    const jsonData = e.dataTransfer.getData('application/json')
    if (jsonData) {
      try {
        const parsed = JSON.parse(jsonData)
        // If it's a file (not directory) being dropped onto an existing target slot -> move it!
        if (parsed.isDirectory === false && slots[slotId]) {
          await moveSelectedFileToSlot(slotId)
          return
        }

        // If it's a folder or slot assignment
        if (parsed.path) {
          await setTargetSlot(slotId, parsed.path, parsed.name)
          return
        }
      } catch {
        // Fallback to plain text
      }
    }

    // Check plain text
    const textPath = e.dataTransfer.getData('text/plain')
    if (textPath) {
      // If dropping onto an occupied slot and textPath is not a folder
      if (slots[slotId]) {
        await moveSelectedFileToSlot(slotId)
      } else {
        await setTargetSlot(slotId, textPath)
      }
      return
    }

    // Check files dropped from OS file explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      // In electron, File objects have a 'path' property
      const filePath = (droppedFile as File & { path?: string }).path || droppedFile.name
      await setTargetSlot(slotId, filePath)
    }
  }

  const handleSlotClick = (slotId: number) => {
    const slot = slots[slotId]
    if (slot) {
      // Navigate to this target folder in active tab
      setTabPath(activeTabId, slot.path)
    } else {
      // Prompt user or open directory dialog
      const enteredPath = prompt(`슬롯 ${slotId}에 할당할 폴더 전체 경로를 입력하세요:`)
      if (enteredPath && enteredPath.trim()) {
        setTargetSlot(slotId, enteredPath.trim())
      }
    }
  }

  return (
    <div className="w-full bg-zinc-950/90 border-b border-zinc-800 p-2.5">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
            타겟 폴더 슬롯 (Target Slots 1~9)
          </span>
          <span className="text-[11px] text-zinc-500">
            단축키 <span className="font-mono text-blue-400">1~9</span> (이동),{' '}
            <span className="font-mono text-emerald-400">Ctrl+1~9</span> (복사)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((slotId) => {
          const slot = slots[slotId]
          const isHighlighted = highlightedSlot?.slotId === slotId
          const highlightType = highlightedSlot?.type
          const isDragOver = dragOverSlot === slotId

          return (
            <div
              key={slotId}
              onDragOver={(e) => handleDragOver(e, slotId)}
              onDragLeave={() => handleDragLeave(slotId)}
              onDrop={(e) => handleDrop(e, slotId)}
              onClick={() => handleSlotClick(slotId)}
              className={`relative group flex flex-col justify-between p-2 rounded-lg border transition-all duration-150 cursor-pointer min-h-[64px] select-none ${
                isHighlighted
                  ? highlightType === 'copy'
                    ? 'animate-slot-copy border-emerald-500 bg-emerald-950/40 text-emerald-200'
                    : 'animate-slot-move border-blue-500 bg-blue-950/40 text-blue-200'
                  : isDragOver
                    ? 'border-blue-400 bg-blue-900/30 ring-2 ring-blue-500/50'
                    : slot
                      ? 'border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800/80 hover:border-zinc-700 text-zinc-200'
                      : 'border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950 hover:bg-zinc-900/40 text-zinc-600'
              }`}
            >
              {/* Header: Slot Badge & Remove button */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center font-mono ${
                    isHighlighted
                      ? highlightType === 'copy'
                        ? 'bg-emerald-500 text-black'
                        : 'bg-blue-500 text-white'
                      : slot
                        ? 'bg-zinc-700 text-zinc-200 group-hover:bg-blue-600 group-hover:text-white transition'
                        : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {slotId}
                </span>

                {slot && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTargetSlot(slotId)
                    }}
                    title="슬롯 비우기"
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-0.5 rounded transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Slot Body: Folder info or Empty indicator */}
              <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                {slot ? (
                  <>
                    <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span
                      title={`${slot.name} (${slot.path})`}
                      className="text-xs font-medium truncate"
                    >
                      {slot.name}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 w-full justify-center py-1">
                    <Plus className="w-3 h-3" />
                    <span>폴더 드롭</span>
                  </div>
                )}
              </div>

              {/* 1s Pulse Highlight Floating Badge */}
              {isHighlighted && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg animate-badge-bounce flex items-center gap-1 z-20 whitespace-nowrap ${
                    highlightType === 'copy'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  {highlightType === 'copy' ? (
                    <>
                      <Copy className="w-2.5 h-2.5" /> +1 복사됨
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-2.5 h-2.5" /> +1 이동됨
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
