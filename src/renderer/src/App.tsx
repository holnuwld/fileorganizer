import React, { useState, useEffect, useRef } from 'react'
import {
  Table,
  LayoutGrid,
  RotateCcw,
  RotateCw,
  Settings as SettingsIcon,
  Sliders,
  Sparkles,
  Bookmark,
  Sun,
  Moon,
  Trash2,
  Check
} from 'lucide-react'
import { FolderTree } from './components/FolderTree'
import { TargetSlots } from './components/TargetSlots'
import { FolderContents } from './components/FolderContents'
import { MediaPreview } from './components/MediaPreview'
import { SettingsModal } from './components/SettingsModal'
import { ConflictModal } from './components/ConflictModal'

import { useExplorerStore } from './store/useExplorerStore'
import { useSettingsStore } from './store/useSettingsStore'
import { useUndoStore } from './store/useUndoStore'
import { useKeyboardRouter } from './hooks/useKeyboardRouter'

export const App: React.FC = () => {
  // Global Keyboard Router (Hotkeys & Focus Guard)
  useKeyboardRouter()

  // Stores
  const {
    tabs,
    activeTabId,
    setTabViewMode,
    setThumbnailSize,
    presets,
    loadPresets,
    saveCurrentAsPreset,
    applyPreset,
    deletePreset
  } = useExplorerStore()

  const { settings, loadSettings, openSettings, setTheme } = useSettingsStore()
  const {
    undoStack,
    redoStack,
    isUndoing,
    isRedoing,
    triggerUndo,
    triggerRedo,
    loadHistory
  } = useUndoStore()

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const viewMode = activeTab?.viewMode || 'details'
  const thumbnailSize = activeTab?.thumbnailSize || 120

  // Preset Popover
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [presetSavedToast, setPresetSavedToast] = useState(false)
  const presetDropdownRef = useRef<HTMLDivElement>(null)

  // Resizable Panes State
  const [leftWidth, setLeftWidth] = useState<number>(240)
  const [rightWidth, setRightWidth] = useState<number>(380)

  const isDraggingLeft = useRef(false)
  const isDraggingRight = useRef(false)

  // Initialize data on mount
  useEffect(() => {
    loadSettings()
    loadPresets()
    loadHistory()
  }, [loadSettings, loadPresets, loadHistory])

  // Close preset dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPresetOpen(false)
      }
    }
    if (isPresetOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPresetOpen])

  // Left divider dragging
  const handleLeftDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingLeft.current = true
    document.body.style.cursor = 'col-resize'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingLeft.current) return
      const newWidth = Math.max(160, Math.min(450, moveEvent.clientX))
      setLeftWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingLeft.current = false
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Right divider dragging
  const handleRightDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRight.current = true
    document.body.style.cursor = 'col-resize'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRight.current) return
      const newWidth = Math.max(260, Math.min(650, window.innerWidth - moveEvent.clientX))
      setRightWidth(newWidth)
    }

    const handleMouseUp = () => {
      isDraggingRight.current = false
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const lastUndoAction = undoStack[0]

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      {/* ================= TOP NAVIGATION TOOLBAR ================= */}
      <header className="h-11 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between shrink-0 z-20">
        {/* App Title / Logo */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-zinc-200">
            Fast Media Organizer
          </span>
        </div>

        {/* Center Actions: View Mode, Thumbnail Slider */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle: Details vs Grid */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              onClick={() => setTabViewMode('details')}
              title="자세히 보기 (Details Table)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                viewMode === 'details'
                  ? 'bg-zinc-800 text-blue-400 font-medium shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>자세히</span>
            </button>
            <button
              onClick={() => setTabViewMode('grid')}
              title="썸네일 격자 보기 (Grid)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                viewMode === 'grid'
                  ? 'bg-zinc-800 text-blue-400 font-medium shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>썸네일</span>
            </button>
          </div>

          {/* Thumbnail Size Slider */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950/60 px-2.5 py-1 rounded-lg border border-zinc-800">
            <Sliders className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="range"
              min="70"
              max="240"
              value={thumbnailSize}
              onChange={(e) => setThumbnailSize(Number(e.target.value))}
              title="썸네일 크기 변경"
              className="w-24 accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <span className="font-mono text-[10px] w-8 text-right">{thumbnailSize}px</span>
          </div>
        </div>

        {/* Right Actions: Presets, Theme Toggle, Undo & Settings */}
        <div className="flex items-center gap-2">
          {/* Preset Management Dropdown */}
          <div className="relative" ref={presetDropdownRef}>
            <button
              onClick={() => setIsPresetOpen(!isPresetOpen)}
              title="현재 폴더 및 타겟폴더 구성 프리셋 저장/불러오기"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
            >
              <Bookmark className="w-3.5 h-3.5 text-blue-400" />
              <span>프리셋 ({presets.length})</span>
            </button>

            {isPresetOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-semibold text-zinc-200">구성 프리셋 저장 / 로드</span>
                  {presetSavedToast && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> 저장완료
                    </span>
                  )}
                </div>

                {/* Save current as new preset */}
                <div className="space-y-1.5">
                  <p className="text-[11px] text-zinc-400">현재 경로 & 타겟폴더 1~9 저장</p>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="프리셋 이름 (예: 여행사진 정리)"
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newPresetName.trim()) {
                          const ok = await saveCurrentAsPreset(newPresetName.trim())
                          if (ok) {
                            setNewPresetName('')
                            setPresetSavedToast(true)
                            setTimeout(() => setPresetSavedToast(false), 1200)
                          }
                        }
                      }}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (newPresetName.trim()) {
                          const ok = await saveCurrentAsPreset(newPresetName.trim())
                          if (ok) {
                            setNewPresetName('')
                            setPresetSavedToast(true)
                            setTimeout(() => setPresetSavedToast(false), 1200)
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs shrink-0 transition"
                    >
                      저장
                    </button>
                  </div>
                </div>

                {/* Presets List */}
                <div className="space-y-1 pt-1">
                  <p className="text-[11px] text-zinc-400">저장된 프리셋 목록</p>
                  {presets.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic py-2 text-center">
                      저장된 프리셋이 없습니다
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between p-1.5 rounded-lg bg-zinc-950/60 hover:bg-zinc-800/60 border border-zinc-800/80 transition group"
                        >
                          <div
                            onClick={() => {
                              applyPreset(preset)
                              setIsPresetOpen(false)
                            }}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <p className="font-medium text-zinc-200 truncate group-hover:text-blue-400">
                              {preset.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 truncate font-mono">
                              {preset.folderPath}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              deletePreset(preset.id)
                            }}
                            title="프리셋 삭제"
                            className="p-1 text-zinc-500 hover:text-red-400 rounded transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Theme Toggle Button */}
          <button
            onClick={() => setTheme(settings.theme === 'dark' ? 'light' : 'dark')}
            title={`테마 전환 (${settings.theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'})`}
            className="flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Undo Button */}
          <button
            onClick={() => triggerUndo()}
            disabled={undoStack.length === 0 || isUndoing}
            title={
              lastUndoAction
                ? `실행 취소 (Ctrl+Z) - [${lastUndoAction.type === 'move' ? '이동 취소' : '복사 취소'}: ${
                    lastUndoAction.sourcePath.split('\\').pop() || lastUndoAction.sourcePath
                  }]`
                : '실행 취소 (Ctrl+Z) - 기록 없음'
            }
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-950 transition"
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${isUndoing ? 'animate-spin text-amber-400' : 'text-amber-400'}`}
            />
            <span>실행 취소</span>
            {undoStack.length > 0 && (
              <span className="bg-zinc-800 text-zinc-400 font-mono text-[10px] px-1 rounded">
                {undoStack.length}
              </span>
            )}
          </button>

          {/* Redo Button */}
          <button
            onClick={() => triggerRedo()}
            disabled={redoStack.length === 0 || isRedoing}
            title={
              redoStack.length > 0
                ? `다시 실행 (Ctrl+Y / Ctrl+Shift+Z) - [${
                    redoStack[0].type === 'move' ? '이동 다시실행' : '복사 다시실행'
                  }: ${redoStack[0].sourcePath.split('\\').pop() || redoStack[0].sourcePath}]`
                : '다시 실행 (Ctrl+Y / Ctrl+Shift+Z) - 기록 없음'
            }
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-950 transition"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${isRedoing ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`}
            />
            <span>다시 실행</span>
            {redoStack.length > 0 && (
              <span className="bg-zinc-800 text-zinc-400 font-mono text-[10px] px-1 rounded">
                {redoStack.length}
              </span>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={openSettings}
            title="설정 메뉴 열기"
            className="flex items-center gap-1.5 p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
          >
            <SettingsIcon className="w-4 h-4 text-zinc-400 hover:text-blue-400 transition" />
          </button>
        </div>
      </header>

      {/* ================= 4 MAIN SECTIONS SPLIT LAYOUT ================= */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SECTION 1 (Left): Folder Tree */}
        <div style={{ width: `${leftWidth}px` }} className="shrink-0 h-full overflow-hidden">
          <FolderTree />
        </div>

        {/* Left Resizable Divider */}
        <div
          onMouseDown={handleLeftDividerMouseDown}
          className="w-1 hover:w-1.5 bg-zinc-800 hover:bg-blue-500 cursor-col-resize transition-all shrink-0 z-10"
        />

        {/* CENTER PANE: Target Slots (Section 2) + Folder Contents (Section 3) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* SECTION 2 (Center-Top): Target Slots 1 ~ 9 */}
          <div className="shrink-0">
            <TargetSlots />
          </div>

          {/* SECTION 3 (Center-Bottom): Folder Contents & Tabs */}
          <div className="flex-1 overflow-hidden">
            <FolderContents />
          </div>
        </div>

        {/* Right Resizable Divider */}
        <div
          onMouseDown={handleRightDividerMouseDown}
          className="w-1 hover:w-1.5 bg-zinc-800 hover:bg-blue-500 cursor-col-resize transition-all shrink-0 z-10"
        />

        {/* SECTION 4 (Right): Media Preview */}
        <div
          style={{ width: `${rightWidth}px` }}
          className="shrink-0 h-full overflow-hidden border-l border-zinc-800"
        >
          <MediaPreview />
        </div>
      </div>

      {/* ================= MODALS ================= */}
      <SettingsModal />
      <ConflictModal />
    </div>
  )
}

export default App
