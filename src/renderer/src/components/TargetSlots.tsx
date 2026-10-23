import React, { useState } from 'react'
import { X, ArrowDownRight, Copy } from 'lucide-react'
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

  const renderSlotCard = (slotId: number, isRow2: boolean) => {
    const slot = slots[slotId]
    const isHighlighted = highlightedSlot?.slotId === slotId
    const highlightType = highlightedSlot?.type
    const isDragOver = dragOverSlot === slotId
    const displayNum = isRow2 ? slotId - 9 : slotId
    const badgeLabel = isRow2 ? `⇧${displayNum}` : `${displayNum}`
    const hotkeyGuide = isRow2
      ? `Shift+${displayNum} (이동) / Ctrl+Shift+${displayNum} (복사)`
      : `${displayNum} (이동) / Ctrl+${displayNum} (복사)`

    return (
      <div
        key={slotId}
        onDragOver={(e) => handleDragOver(e, slotId)}
        onDragLeave={() => handleDragLeave(slotId)}
        onDrop={(e) => handleDrop(e, slotId)}
        onClick={() => handleSlotClick(slotId)}
        title={slot ? `슬롯 ${slotId}: ${slot.name}\n${slot.path}\n단축키: ${hotkeyGuide}` : `슬롯 ${slotId} (비어있음)\n단축키: ${hotkeyGuide}\n클릭하여 폴더 지정 또는 드래그 앤 드롭`}
        className={`relative group flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer h-[44px] select-none ${
          isHighlighted
            ? highlightType === 'copy'
              ? 'animate-slot-copy border-emerald-500 bg-emerald-950/50 text-emerald-200'
              : 'animate-slot-move border-blue-500 bg-blue-950/50 text-blue-200'
            : isDragOver
              ? 'border-blue-400 bg-blue-900/30 ring-2 ring-blue-500/50'
              : slot
                ? 'border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800/90 hover:border-zinc-700 text-zinc-200'
                : 'border-dashed border-zinc-800/90 hover:border-zinc-700 bg-zinc-950/80 hover:bg-zinc-900/40 text-zinc-600'
        }`}
      >
        {/* Left: Slot Number Badge, Right: Folder Name */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold flex items-center justify-center font-mono shrink-0 shadow-xs ${
              isHighlighted
                ? highlightType === 'copy'
                  ? 'bg-emerald-500 text-black'
                  : 'bg-blue-500 text-white'
                : slot
                  ? isRow2
                    ? 'bg-purple-900/90 text-purple-200 border border-purple-600/60 group-hover:bg-purple-600 group-hover:text-white transition'
                    : 'bg-zinc-800 text-blue-400 border border-zinc-700 group-hover:bg-blue-600 group-hover:text-white transition'
                  : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
            }`}
          >
            {badgeLabel}
          </span>

          <span
            title={slot ? `${slot.name}\n(${slot.path})` : '클릭하여 폴더 지정'}
            className={`truncate font-semibold tracking-tight ${
              slot
                ? 'text-[14px] text-zinc-100 group-hover:text-white'
                : 'text-[12px] text-zinc-500 font-normal'
            }`}
          >
            {slot ? slot.name : '+ 비어 있음'}
          </span>
        </div>

        {/* Clear Button on hover */}
        {slot && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTargetSlot(slotId)
            }}
            title="슬롯 비우기"
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 p-1 rounded transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 1s Pulse Highlight Floating Badge */}
        {isHighlighted && (
          <div
            className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-lg animate-badge-bounce flex items-center gap-1 z-30 whitespace-nowrap ${
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
  }

  return (
    <div className="w-full bg-zinc-950/90 border-b border-zinc-800 px-2.5 py-2">
      {/* Target Slots Header & Shortcut Summary */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-zinc-300 uppercase">
            타겟 폴더 슬롯 (18개)
          </span>
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            1행: <span className="font-mono text-blue-400">1~9</span>(이동) / <span className="font-mono text-emerald-400">Ctrl+1~9</span>(복사)
            &nbsp;·&nbsp;
            2행: <span className="font-mono text-purple-400">Shift+1~9</span>(이동) / <span className="font-mono text-emerald-400">Ctrl+Shift+1~9</span>(복사)
          </span>
        </div>
      </div>

      {/* 2-Row Compact Grid */}
      <div className="flex flex-col gap-1.5">
        {/* Row 1: Slots 1~9 */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {Array.from({ length: 9 }, (_, i) => i + 1).map((slotId) => renderSlotCard(slotId, false))}
        </div>

        {/* Row 2: Slots 10~18 (Shift + 1~9) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5">
          {Array.from({ length: 9 }, (_, i) => i + 10).map((slotId) => renderSlotCard(slotId, true))}
        </div>
      </div>
    </div>
  )
}
