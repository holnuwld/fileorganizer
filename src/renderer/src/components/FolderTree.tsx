import React, { useState, useEffect } from 'react'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  HardDrive,
  FolderPlus,
  RefreshCw,
  Plus
} from 'lucide-react'
import { useExplorerStore } from '../store/useExplorerStore'
import { DriveInfo, FileEntry } from '../types'

interface TreeNode {
  path: string
  name: string
  isDrive?: boolean
  children?: TreeNode[]
  isExpanded?: boolean
  isLoading?: boolean
}

export const FolderTree: React.FC = () => {
  const { tabs, activeTabId, setTabPath, refreshCurrentTab } = useExplorerStore()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const currentPath = activeTab?.path || 'C:\\'

  const [drives, setDrives] = useState<TreeNode[]>([])
  const [treeData, setTreeData] = useState<Record<string, TreeNode[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['C:\\']))
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState<string>('')
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

  // Load drives on mount
  const loadDrives = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getDrives) {
        const result = await window.electronAPI.getDrives()
        const driveNodes: TreeNode[] = result.map((d: DriveInfo) => ({
          path: d.path,
          name: d.name || d.path,
          isDrive: true
        }))
        setDrives(driveNodes)
      } else {
        setDrives([
          { path: 'C:\\', name: 'Local Disk (C:)', isDrive: true },
          { path: 'D:\\', name: 'Media Disk (D:)', isDrive: true }
        ])
      }
    } catch (e) {
      console.warn('Failed to load drives:', e)
      setDrives([{ path: 'C:\\', name: 'Local Disk (C:)', isDrive: true }])
    }
  }

  useEffect(() => {
    loadDrives()
  }, [])

  // Load children for a folder
  const loadFolderChildren = async (folderPath: string) => {
    setLoadingPaths((prev) => new Set(prev).add(folderPath))
    try {
      let folders: FileEntry[] = []
      if (typeof window !== 'undefined' && window.electronAPI?.readDirectory) {
        const entries = await window.electronAPI.readDirectory(folderPath)
        folders = entries.filter((e) => e.isDirectory)
      } else {
        // Fallback mock subfolders
        folders = [
          {
            name: 'Photos',
            path: `${folderPath}\\Photos`,
            isDirectory: true,
            size: 0,
            mtime: 0,
            extension: '',
            type: 'folder'
          },
          {
            name: 'Videos',
            path: `${folderPath}\\Videos`,
            isDirectory: true,
            size: 0,
            mtime: 0,
            extension: '',
            type: 'folder'
          },
          {
            name: 'Documents',
            path: `${folderPath}\\Documents`,
            isDirectory: true,
            size: 0,
            mtime: 0,
            extension: '',
            type: 'folder'
          }
        ]
      }

      const childNodes: TreeNode[] = folders.map((f) => ({
        path: f.path,
        name: f.name,
        isDrive: false
      }))

      setTreeData((prev) => ({
        ...prev,
        [folderPath]: childNodes
      }))
    } catch (err) {
      console.error(`Failed to load children for ${folderPath}:`, err)
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev)
        next.delete(folderPath)
        return next
      })
    }
  }

  // Toggle expand
  const toggleExpand = async (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const nextExpanded = new Set(expandedPaths)
    if (nextExpanded.has(path)) {
      nextExpanded.delete(path)
    } else {
      nextExpanded.add(path)
      if (!treeData[path]) {
        await loadFolderChildren(path)
      }
    }
    setExpandedPaths(nextExpanded)
  }

  // Select folder -> navigate in active tab
  const handleSelectFolder = (path: string) => {
    setTabPath(activeTabId, path)
  }

  // Drag start -> can be dropped onto TargetSlots!
  const handleDragStart = (e: React.DragEvent, node: TreeNode) => {
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.setData('application/json', JSON.stringify({ path: node.path, name: node.name }))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  // Create folder submit
  const handleCreateFolder = async (parentPath: string) => {
    if (!newFolderName.trim()) {
      setNewFolderParent(null)
      return
    }

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.createFolder) {
        const res = await window.electronAPI.createFolder(parentPath, newFolderName.trim())
        if (res.success) {
          await loadFolderChildren(parentPath)
          setExpandedPaths((prev) => new Set(prev).add(parentPath))
        }
      } else {
        // Mock add
        const newPath = `${parentPath}\\${newFolderName.trim()}`
        setTreeData((prev) => ({
          ...prev,
          [parentPath]: [
            ...(prev[parentPath] || []),
            { path: newPath, name: newFolderName.trim(), isDrive: false }
          ]
        }))
      }
    } catch (err) {
      console.error('Failed to create folder:', err)
    } finally {
      setNewFolderParent(null)
      setNewFolderName('')
    }
  }

  // Drop file onto folder in tree -> Move file!
  const handleDropOnFolder = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(null)

    const jsonData = e.dataTransfer.getData('application/json')
    let sourcePath = ''
    if (jsonData) {
      try {
        const parsed = JSON.parse(jsonData)
        sourcePath = parsed.path
      } catch {
        // Fallback
      }
    }
    if (!sourcePath) {
      sourcePath = e.dataTransfer.getData('text/plain')
    }

    if (sourcePath && sourcePath !== targetFolderPath) {
      try {
        if (typeof window !== 'undefined' && window.electronAPI?.moveFile) {
          const res = await window.electronAPI.moveFile(sourcePath, targetFolderPath)
          if (res.success) {
            await refreshCurrentTab()
            await loadFolderChildren(targetFolderPath)
          }
        }
      } catch (err) {
        console.error('Failed to move file to tree folder:', err)
      }
    }
  }

  // Render individual tree item
  const renderItem = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path)
    const isLoading = loadingPaths.has(node.path)
    const isSelected = currentPath.toLowerCase() === node.path.toLowerCase()
    const children = treeData[node.path] || []

    return (
      <div key={node.path} className="select-none text-xs">
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'copy'
            setDragOverPath(node.path)
          }}
          onDragLeave={() => {
            if (dragOverPath === node.path) {
              setDragOverPath(null)
            }
          }}
          onDrop={(e) => handleDropOnFolder(e, node.path)}
          onClick={() => handleSelectFolder(node.path)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`group flex items-center gap-1.5 py-1 px-1.5 rounded-md cursor-pointer transition ${
            dragOverPath === node.path
              ? 'bg-blue-600/30 border border-blue-400 text-blue-300'
              : isSelected
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100'
          }`}
        >
          {/* Chevron */}
          <button
            onClick={(e) => toggleExpand(node.path, e)}
            className="w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded"
          >
            {isLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin text-zinc-400" />
            ) : isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Icon */}
          {node.isDrive ? (
            <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-blue-400/80 shrink-0" />
          )}

          {/* Label */}
          <span className="truncate flex-1">{node.name}</span>

          {/* Quick Add Subfolder button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setNewFolderParent(node.path)
              setNewFolderName('')
              setExpandedPaths((prev) => new Set(prev).add(node.path))
            }}
            title="하위 새 폴더 생성"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Inline New Folder Input */}
        {newFolderParent === node.path && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
            className="py-1 pr-2 flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder(node.path)
                if (e.key === 'Escape') setNewFolderParent(null)
              }}
              onBlur={() => handleCreateFolder(node.path)}
              placeholder="새 폴더 이름"
              className="w-full bg-zinc-950 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 outline-none"
            />
          </div>
        )}

        {/* Child Folders */}
        {isExpanded && children.length > 0 && (
          <div className="border-l border-zinc-800/60 ml-2">
            {children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 text-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/40">
        <span className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">
          폴더 탐색 (Tree)
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (currentPath) {
                setNewFolderParent(currentPath)
                setNewFolderName('')
              }
            }}
            title="현재 폴더에 새 폴더 생성"
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadDrives}
            title="새로고침"
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {drives.map((drive) => renderItem(drive, 0))}
      </div>
    </div>
  )
}
