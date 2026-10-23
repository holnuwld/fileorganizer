import React, { useState, useRef, useEffect } from 'react'
import {
  Folder,
  FolderUp,
  FolderPlus,
  Image as ImageIcon,
  Video as VideoIcon,
  File as FileIcon,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react'
import { useExplorerStore, SortColumn } from '../store/useExplorerStore'
import { FileEntry } from '../types'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-'
  const d = new Date(timestamp)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const FolderContents: React.FC = () => {
  const {
    tabs,
    activeTabId,
    addTab,
    closeTab,
    setActiveTab,
    setTabPath,
    navigateBack,
    navigateForward,
    refreshCurrentTab,
    files,
    selectedFileIndex,
    selectFile,
    isLoadingFiles,
    sortColumn,
    sortDirection,
    setSort,
    renamingFile,
    cancelRename,
    commitRename,
    createNewFolderInCurrentTab
  } = useExplorerStore()

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]
  const viewMode = activeTab?.viewMode || 'details'
  const thumbnailSize = activeTab?.thumbnailSize || 120

  const containerRef = useRef<HTMLDivElement>(null)
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathInputValue, setPathInputValue] = useState('')
  const pathInputRef = useRef<HTMLInputElement>(null)

  const [renameInputValue, setRenameInputValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Sync path input value with activeTab.path
  useEffect(() => {
    setPathInputValue(activeTab?.path || '')
  }, [activeTab?.path])

  // Focus path input when editing starts
  useEffect(() => {
    if (isEditingPath && pathInputRef.current) {
      pathInputRef.current.focus()
      pathInputRef.current.select()
    }
  }, [isEditingPath])

  // Focus rename input when renaming begins
  useEffect(() => {
    if (renamingFile) {
      setRenameInputValue(renamingFile.name)
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus()
          // Select file name without extension if it's not a directory
          if (!renamingFile.isDirectory) {
            const dotIdx = renamingFile.name.lastIndexOf('.')
            if (dotIdx > 0) {
              renameInputRef.current.setSelectionRange(0, dotIdx)
              return
            }
          }
          renameInputRef.current.select()
        }
      }, 50)
    }
  }, [renamingFile])

  const handlePathSubmit = () => {
    const trimmed = pathInputValue.trim()
    if (trimmed && trimmed !== activeTab?.path) {
      setTabPath(activeTabId, trimmed)
    }
    setIsEditingPath(false)
  }

  const handleRenameSubmit = async () => {
    const trimmed = renameInputValue.trim()
    if (trimmed && renamingFile && trimmed !== renamingFile.name) {
      await commitRename(trimmed)
    } else {
      cancelRename()
    }
  }

  // Auto scroll to selected item on arrow key or change
  useEffect(() => {
    if (selectedFileIndex >= 0 && containerRef.current) {
      const selectedEl = containerRef.current.querySelector(
        `[data-index="${selectedFileIndex}"]`
      ) as HTMLElement | null
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    }
  }, [selectedFileIndex])

  const handleRowDoubleClick = (file: FileEntry) => {
    if (file.isDirectory) {
      setTabPath(activeTabId, file.path)
    }
  }

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400" />
    )
  }

  const getFileIcon = (file: FileEntry) => {
    if (file.isDirectory) return <Folder className="w-4 h-4 text-amber-400 shrink-0" />
    if (file.type === 'image') return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
    if (file.type === 'video') return <VideoIcon className="w-4 h-4 text-purple-400 shrink-0" />
    return <FileIcon className="w-4 h-4 text-zinc-400 shrink-0" />
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* 1. Multi-Tab Bar & Path Navigation Header */}
      <div className="bg-zinc-900/70 border-b border-zinc-800 flex flex-col">
        {/* Tabs Row */}
        <div className="flex items-center px-2 pt-1 gap-1 overflow-x-auto select-none no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const folderName = tab.path.split('\\').pop() || tab.path.split('/').pop() || tab.path

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t border-x transition-all duration-100 max-w-[180px] shrink-0 ${
                  isActive
                    ? 'bg-zinc-950 border-zinc-700 text-zinc-100 font-medium'
                    : 'bg-zinc-900/40 border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate flex-1">{folderName || 'Tab'}</span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 p-0.5 rounded transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}

          <button
            onClick={() => addTab()}
            title="새 탭 열기"
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Path Navigation bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950/80 border-t border-zinc-800/60 text-xs">
          <div className="flex items-center gap-1 text-zinc-400">
            <button
              onClick={navigateBack}
              disabled={activeTab.historyIndex <= 0}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={navigateForward}
              disabled={activeTab.historyIndex >= activeTab.history.length - 1}
              className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={refreshCurrentTab}
              title="새로고침"
              className="p-1 rounded hover:bg-zinc-800 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin text-blue-400' : ''}`}
              />
            </button>
            <button
              onClick={() => {
                const cur = activeTab.path.replace(/[\\/]+$/, '')
                const lastSlash = Math.max(cur.lastIndexOf('\\'), cur.lastIndexOf('/'))
                if (lastSlash > 0) {
                  const parentPath = cur.slice(0, lastSlash)
                  setTabPath(activeTabId, parentPath.endsWith(':') ? parentPath + '\\' : parentPath)
                } else if (lastSlash === 0) {
                  setTabPath(activeTabId, cur.slice(0, 1) + ':\\')
                }
              }}
              title="상위 폴더로 이동 (Alt + ↑)"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1"
            >
              <FolderUp className="w-3.5 h-3.5 text-amber-400" />
            </button>
            <button
              onClick={() => createNewFolderInCurrentTab()}
              title="새 폴더 만들기 (Ctrl+N)"
              className="p-1 rounded hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-1"
            >
              <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            </button>
          </div>

          {isEditingPath ? (
            <input
              ref={pathInputRef}
              type="text"
              value={pathInputValue}
              onChange={(e) => setPathInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePathSubmit()
                } else if (e.key === 'Escape') {
                  setPathInputValue(activeTab.path)
                  setIsEditingPath(false)
                }
              }}
              onBlur={handlePathSubmit}
              className="flex-1 bg-zinc-900 border border-blue-500 rounded px-2 py-0.5 font-mono text-[11px] text-zinc-100 outline-none"
              placeholder="경로를 입력하거나 붙여넣고 Enter를 누르세요"
            />
          ) : (
            <div
              onClick={() => setIsEditingPath(true)}
              title="클릭하여 경로 직접 입력/복사/붙여넣기"
              className="flex-1 bg-zinc-900 hover:bg-zinc-800/80 hover:border-zinc-700 border border-zinc-800 rounded px-2 py-0.5 font-mono text-[11px] text-zinc-300 truncate cursor-text transition"
            >
              {activeTab.path}
            </div>
          )}

          <div className="text-[11px] text-zinc-500 font-mono">{files.length} 항목</div>
        </div>
      </div>

      {/* 2. Main Contents Body (Details Table vs Thumbnail Grid) */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {isLoadingFiles ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span className="text-xs">폴더 내용을 불러오는 중...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
            <Folder className="w-10 h-10 stroke-[1.2] text-zinc-600" />
            <span className="text-xs">폴더가 비어 있습니다</span>
          </div>
        ) : viewMode === 'details' ? (
          /* DETAILS VIEW: Sortable Table */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400 select-none z-10">
              <tr>
                <th
                  onClick={() => setSort('name')}
                  className="py-2 px-3 font-medium cursor-pointer group hover:text-zinc-200 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>이름</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => setSort('size')}
                  className="py-2 px-3 font-medium cursor-pointer group hover:text-zinc-200 transition w-28 text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>크기</span>
                    {renderSortIcon('size')}
                  </div>
                </th>
                <th
                  onClick={() => setSort('type')}
                  className="py-2 px-3 font-medium cursor-pointer group hover:text-zinc-200 transition w-24"
                >
                  <div className="flex items-center gap-1.5">
                    <span>유형</span>
                    {renderSortIcon('type')}
                  </div>
                </th>
                <th
                  onClick={() => setSort('mtime')}
                  className="py-2 px-3 font-medium cursor-pointer group hover:text-zinc-200 transition w-40"
                >
                  <div className="flex items-center gap-1.5">
                    <span>수정된 날짜</span>
                    {renderSortIcon('mtime')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {files.map((file, idx) => {
                const isSelected = idx === selectedFileIndex
                return (
                  <tr
                    key={file.path}
                    data-index={idx}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', file.path)
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({
                          path: file.path,
                          name: file.name,
                          isDirectory: file.isDirectory
                        })
                      )
                      e.dataTransfer.effectAllowed = 'copyMove'
                    }}
                    onClick={() => selectFile(idx)}
                    onDoubleClick={() => handleRowDoubleClick(file)}
                    className={`cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-blue-600/25 text-blue-200 font-medium'
                        : 'hover:bg-zinc-800/50 text-zinc-300'
                    }`}
                  >
                    <td className="py-1.5 px-3 truncate max-w-xs">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file)}
                        {renamingFile?.path === file.path ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameInputValue}
                            onChange={(e) => setRenameInputValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSubmit()
                              } else if (e.key === 'Escape') {
                                cancelRename()
                              }
                            }}
                            onBlur={handleRenameSubmit}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none w-full max-w-sm"
                          />
                        ) : (
                          <span className="truncate">{file.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right text-zinc-400 font-mono text-[11px]">
                      {file.isDirectory ? '-' : formatBytes(file.size)}
                    </td>
                    <td className="py-1.5 px-3 text-zinc-400 uppercase text-[10px]">
                      {file.isDirectory ? '폴더' : file.extension || file.type}
                    </td>
                    <td className="py-1.5 px-3 text-zinc-400 text-[11px] font-mono">
                      {formatDate(file.mtime)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* GRID VIEW: Scalable Thumbnails */
          <div
            className="p-3 grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`
            }}
          >
            {files.map((file, idx) => {
              const isSelected = idx === selectedFileIndex
              const mediaSrc =
                typeof window !== 'undefined' && window.electronAPI?.getMediaUrl
                  ? window.electronAPI.getMediaUrl(file.path)
                  : `media://local/${encodeURI(file.path.replace(/\\/g, '/'))}`

              return (
                <div
                  key={file.path}
                  data-index={idx}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', file.path)
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify({
                        path: file.path,
                        name: file.name,
                        isDirectory: file.isDirectory
                      })
                    )
                    e.dataTransfer.effectAllowed = 'copyMove'
                  }}
                  onClick={() => selectFile(idx)}
                  onDoubleClick={() => handleRowDoubleClick(file)}
                  className={`group flex flex-col rounded-lg border overflow-hidden cursor-pointer transition-all duration-100 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/40 shadow-md ring-2 ring-blue-500/40 text-blue-200'
                      : 'border-zinc-800/80 bg-zinc-900/60 hover:bg-zinc-800/80 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  {/* Thumbnail area */}
                  <div
                    style={{ height: `${thumbnailSize * 0.75}px` }}
                    className="relative bg-zinc-950/60 flex items-center justify-center overflow-hidden"
                  >
                    {file.isDirectory ? (
                      <Folder className="w-10 h-10 text-amber-400/80" />
                    ) : file.type === 'image' ? (
                      <img
                        src={mediaSrc}
                        alt={file.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          // Fallback to icon on error
                          ;(e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                    ) : file.type === 'video' ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
                        <VideoIcon className="w-8 h-8 text-purple-400/80" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center">
                            <div className="w-0 h-0 border-y-4 border-y-transparent border-l-6 border-l-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <FileIcon className="w-8 h-8 text-zinc-500" />
                    )}

                    {/* File type badge */}
                    {file.type === 'video' && (
                      <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-purple-300">
                        VIDEO
                      </span>
                    )}
                  </div>

                  {/* Name & Size Caption */}
                  <div className="p-1.5 text-center">
                    {renamingFile?.path === file.path ? (
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameInputValue}
                        onChange={(e) => setRenameInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameSubmit()
                          } else if (e.key === 'Escape') {
                            cancelRename()
                          }
                        }}
                        onBlur={handleRenameSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-zinc-900 border border-blue-500 rounded px-1 py-0.5 text-[11px] text-white outline-none w-full text-center"
                      />
                    ) : (
                      <p className="text-[11px] font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {file.isDirectory ? '폴더' : formatBytes(file.size)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
