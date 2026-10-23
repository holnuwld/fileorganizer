import React, { useState, useEffect } from 'react'
import {
  X,
  Settings as SettingsIcon,
  Video,
  FileQuestion,
  Keyboard,
  RotateCcw,
  Check,
  Palette
} from 'lucide-react'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/useSettingsStore'
import { ConflictResolution } from '../types'
import { eventToKeyString } from '../hooks/useKeyboardRouter'

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings, settings, updateSettings, setTheme } =
    useSettingsStore()
  const [activeTab, setActiveTab] = useState<'general' | 'video' | 'conflict' | 'hotkeys'>('general')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [recordingKey, setRecordingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!recordingKey) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Allow Escape to cancel recording
      if (e.key === 'Escape') {
        setRecordingKey(null)
        return
      }

      const keyCombo = eventToKeyString(e)
      if (keyCombo) {
        handleUpdate(`hotkeys.${recordingKey}`, keyCombo)
        setRecordingKey(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [recordingKey])

  if (!isSettingsOpen) return null

  const handleUpdate = async (field: string, value: unknown) => {
    if (field.startsWith('hotkeys.')) {
      const subKey = field.split('.')[1]
      await updateSettings({
        hotkeys: {
          ...settings.hotkeys,
          [subKey]: value
        }
      })
    } else {
      await updateSettings({ [field]: value })
    }
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1200)
  }

  const handleResetDefaults = async () => {
    await updateSettings(DEFAULT_SETTINGS)
    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden flex flex-col h-[520px] text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5 font-semibold text-base">
            <SettingsIcon className="w-5 h-5 text-blue-400" />
            <span>설정 (Preferences)</span>
            {savedFeedback && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded ml-2 border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" /> 저장됨
              </span>
            )}
          </div>
          <button
            onClick={closeSettings}
            className="text-zinc-400 hover:text-zinc-200 p-1 rounded-md hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation & Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Tab Sidebar */}
          <div className="w-48 bg-zinc-950/40 border-r border-zinc-800/80 p-3 space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'general'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>일반 & 테마</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'video'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>동영상 재생 & 탐색</span>
            </button>

            <button
              onClick={() => setActiveTab('conflict')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'conflict'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileQuestion className="w-4 h-4" />
              <span>파일 충돌 정책</span>
            </button>

            <button
              onClick={() => setActiveTab('hotkeys')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'hotkeys'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span>단축키 설정</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {activeTab === 'general' && (
              <div className="space-y-5 text-sm">
                <div>
                  <h3 className="font-semibold text-zinc-200 mb-1">화면 컬러 테마</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    사용자 취향에 맞는 다크 테마 또는 라이트 테마를 선택할 수 있습니다.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition ${
                        settings.theme === 'dark'
                          ? 'border-blue-500 bg-blue-500/10 text-white font-medium ring-2 ring-blue-500/30'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="w-full h-16 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                        <span className="text-xs text-zinc-300">다크 모드</span>
                      </div>
                      <span className="text-xs">Dark Theme</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition ${
                        settings.theme === 'light'
                          ? 'border-blue-500 bg-blue-500/10 text-zinc-900 font-medium ring-2 ring-blue-500/30'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <div className="w-full h-16 rounded bg-slate-100 border border-slate-300 flex items-center justify-center">
                        <span className="text-xs text-slate-800 font-medium">라이트 모드</span>
                      </div>
                      <span className="text-xs">Light Theme</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'video' && (
              <div className="space-y-5 text-sm">
                <div>
                  <h3 className="font-semibold text-zinc-200 mb-1">동영상 자동 재생</h3>
                  <p className="text-xs text-zinc-400 mb-3">
                    목록에서 동영상 파일을 선택했을 때 즉시 자동 재생할지 설정합니다.
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoPlayVideo}
                      onChange={(e) => handleUpdate('autoPlayVideo', e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                    />
                    <span className="text-zinc-300 text-xs">
                      파일 선택 시 즉시 자동 재생 (기본: 켜짐)
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="font-semibold text-zinc-200 mb-1">
                    3단계 시간 건너뛰기 (Seek) 초 설정
                  </h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    동영상 탐색 시 각 단축키 조합별 이동할 시간(초)을 지정합니다.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        Ctrl + ←/→ (X초)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={settings.seekSecCtrl}
                        onChange={(e) => handleUpdate('seekSecCtrl', Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm text-zinc-100"
                      />
                    </div>

                    <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        Shift + ←/→ (Y초)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={settings.seekSecShift}
                        onChange={(e) => handleUpdate('seekSecShift', Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm text-zinc-100"
                      />
                    </div>

                    <div className="bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                      <label className="block text-xs text-zinc-400 mb-1 font-mono">
                        Ctrl + Alt + ←/→ (Z초)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="600"
                        value={settings.seekSecCtrlAlt}
                        onChange={(e) => handleUpdate('seekSecCtrlAlt', Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-sm text-zinc-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800">
                  <h3 className="font-semibold text-zinc-200 mb-1">기본 볼륨 & 음소거</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.videoVolume}
                      onChange={(e) => handleUpdate('videoVolume', parseFloat(e.target.value))}
                      className="w-48 accent-blue-500"
                    />
                    <span className="text-xs font-mono text-zinc-400">
                      {Math.round(settings.videoVolume * 100)}%
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        checked={settings.videoMuted}
                        onChange={(e) => handleUpdate('videoMuted', e.target.checked)}
                        className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span className="text-xs text-zinc-300">음소거 (Mute)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'conflict' && (
              <div className="space-y-4 text-sm">
                <div>
                  <h3 className="font-semibold text-zinc-200 mb-1">기본 파일 충돌 처리 정책</h3>
                  <p className="text-xs text-zinc-400 mb-4">
                    이동 또는 복사하려는 대상 폴더에 동일한 파일명이 있을 때의 동작을 지정합니다.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {(
                    [
                      {
                        id: 'ask',
                        title: '항상 물어보기 (팝업 모달)',
                        desc: '충돌 발생 시 팝업을 띄워 선택합니다 (기본값)'
                      },
                      {
                        id: 'overwrite',
                        title: '항상 덮어쓰기 (Overwrite)',
                        desc: '기존 대상 파일을 묻지 않고 교체합니다'
                      },
                      {
                        id: 'skip',
                        title: '항상 건너뛰기 (Skip)',
                        desc: '충돌 파일은 작업을 무시하고 건너뜁니다'
                      },
                      {
                        id: 'rename',
                        title: '항상 파일명 자동 변경 (Auto Rename)',
                        desc: 'filename (1).ext 형식으로 새 이름을 부여합니다'
                      }
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        settings.conflictPolicy === opt.id
                          ? 'border-blue-500/50 bg-blue-500/10 text-zinc-100'
                          : 'border-zinc-800 bg-zinc-800/30 text-zinc-400 hover:bg-zinc-800/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="conflictPolicy"
                        value={opt.id}
                        checked={settings.conflictPolicy === opt.id}
                        onChange={() =>
                          handleUpdate('conflictPolicy', opt.id as ConflictResolution)
                        }
                        className="mt-1 bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <div>
                        <div className="font-medium text-xs text-zinc-200">{opt.title}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'hotkeys' && (
              <div className="space-y-4 text-sm h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-200 mb-1">단축키 커스텀 설정</h3>
                    <p className="text-xs text-zinc-400">
                      변경하려는 단축키 버튼을 클릭한 후, 원하는 키 조합(단일키 또는 복수키 조합: Ctrl, Alt, Shift 등)을 누르면 즉시 맵핑됩니다. (ESC: 취소)
                    </p>
                  </div>
                  {recordingKey && (
                    <span className="text-xs font-medium text-amber-400 animate-pulse bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
                      키 입력 대기 중... (ESC 취소)
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 border border-zinc-800 rounded-lg p-2 text-xs divide-y divide-zinc-800/40">
                  {/* General / Navigation Hotkeys */}
                  <div className="pt-2">
                    <p className="font-semibold text-zinc-400 mb-2 px-1 text-[11px] uppercase tracking-wider">
                      기본 제어 및 탐색
                    </p>
                    <div className="space-y-1.5">
                      {[
                        { id: 'rename', label: '파일/폴더 이름 바꾸기 (기본: F2)' },
                        { id: 'refresh', label: '폴더 내용 새로고침 (기본: F5)' },
                        {
                          id: 'assignNextSlot',
                          label: '선택 폴더 타겟 빈 슬롯 순서대로 배치 (기본: Ctrl+ArrowUp)'
                        },
                        { id: 'undo', label: '실행 취소 Undo (기본: Ctrl+Z)' },
                        { id: 'playPause', label: '동영상 재생 / 일시정지 (기본: Space)' },
                        { id: 'muteToggle', label: '음소거 토글 (기본: M)' }
                      ].map((item) => {
                        const currentVal =
                          settings.hotkeys[item.id as keyof typeof settings.hotkeys] || ''
                        const isRecording = recordingKey === item.id
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/50 transition"
                          >
                            <span className="text-zinc-300">{item.label}</span>
                            <button
                              type="button"
                              onClick={() => setRecordingKey(item.id)}
                              className={`px-3 py-1 rounded font-mono font-medium text-xs transition border ${
                                isRecording
                                  ? 'bg-amber-500 text-black border-amber-400 shadow-lg scale-105'
                                  : 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:border-blue-500 hover:text-white'
                              }`}
                            >
                              {isRecording ? '키 입력 대기...' : currentVal || '없음'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Target Folder Move Hotkeys - Row 1 & Row 2 */}
                  <div className="pt-3">
                    <p className="font-semibold text-blue-400 mb-2 px-1 text-[11px] uppercase tracking-wider">
                      타겟 폴더 슬롯 (1행: 1~9) 파일 이동 핫키
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((slotId) => {
                        const keyId = `moveSlot${slotId}`
                        const currentVal =
                          settings.hotkeys[keyId as keyof typeof settings.hotkeys] || String(slotId)
                        const isRecording = recordingKey === keyId
                        return (
                          <div
                            key={keyId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/50 transition"
                          >
                            <span className="text-zinc-300">슬롯 {slotId} 이동</span>
                            <button
                              type="button"
                              onClick={() => setRecordingKey(keyId)}
                              className={`px-2.5 py-1 rounded font-mono font-medium text-xs transition border ${
                                isRecording
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-zinc-800 text-blue-400 border-zinc-700 hover:border-blue-500'
                              }`}
                            >
                              {isRecording ? '입력 중...' : currentVal}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3">
                    <p className="font-semibold text-purple-400 mb-2 px-1 text-[11px] uppercase tracking-wider">
                      타겟 폴더 슬롯 (2행: 10~18, Shift+숫자) 파일 이동 핫키
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: 9 }, (_, i) => i + 10).map((slotId) => {
                        const keyId = `moveSlot${slotId}`
                        const defaultBinding = `Shift+${slotId - 9}`
                        const currentVal =
                          settings.hotkeys[keyId as keyof typeof settings.hotkeys] || defaultBinding
                        const isRecording = recordingKey === keyId
                        return (
                          <div
                            key={keyId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/50 transition"
                          >
                            <span className="text-zinc-300">슬롯 {slotId} (⇧{slotId - 9}) 이동</span>
                            <button
                              type="button"
                              onClick={() => setRecordingKey(keyId)}
                              className={`px-2.5 py-1 rounded font-mono font-medium text-xs transition border ${
                                isRecording
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-zinc-800 text-purple-400 border-zinc-700 hover:border-purple-500'
                              }`}
                            >
                              {isRecording ? '입력 중...' : currentVal}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Target Folder Copy Hotkeys - Row 1 & Row 2 */}
                  <div className="pt-3">
                    <p className="font-semibold text-emerald-400 mb-2 px-1 text-[11px] uppercase tracking-wider">
                      타겟 폴더 슬롯 (1행: 1~9) 파일 복사 핫키
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: 9 }, (_, i) => i + 1).map((slotId) => {
                        const keyId = `copySlot${slotId}`
                        const currentVal =
                          settings.hotkeys[keyId as keyof typeof settings.hotkeys] ||
                          `Ctrl+${slotId}`
                        const isRecording = recordingKey === keyId
                        return (
                          <div
                            key={keyId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/50 transition"
                          >
                            <span className="text-zinc-300">슬롯 {slotId} 복사</span>
                            <button
                              type="button"
                              onClick={() => setRecordingKey(keyId)}
                              className={`px-2.5 py-1 rounded font-mono font-medium text-xs transition border ${
                                isRecording
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:border-emerald-500'
                              }`}
                            >
                              {isRecording ? '입력 중...' : currentVal}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3">
                    <p className="font-semibold text-teal-400 mb-2 px-1 text-[11px] uppercase tracking-wider">
                      타겟 폴더 슬롯 (2행: 10~18, Ctrl+Shift+숫자) 파일 복사 핫키
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: 9 }, (_, i) => i + 10).map((slotId) => {
                        const keyId = `copySlot${slotId}`
                        const defaultBinding = `Ctrl+Shift+${slotId - 9}`
                        const currentVal =
                          settings.hotkeys[keyId as keyof typeof settings.hotkeys] || defaultBinding
                        const isRecording = recordingKey === keyId
                        return (
                          <div
                            key={keyId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded bg-zinc-900/60 hover:bg-zinc-800/50 transition"
                          >
                            <span className="text-zinc-300">슬롯 {slotId} (⇧{slotId - 9}) 복사</span>
                            <button
                              type="button"
                              onClick={() => setRecordingKey(keyId)}
                              className={`px-2.5 py-1 rounded font-mono font-medium text-xs transition border ${
                                isRecording
                                  ? 'bg-amber-500 text-black border-amber-400'
                                  : 'bg-zinc-800 text-teal-400 border-zinc-700 hover:border-teal-500'
                              }`}
                            >
                              {isRecording ? '입력 중...' : currentVal}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-950/40">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>기본값으로 복원</span>
          </button>

          <button
            onClick={closeSettings}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition"
          >
            완료 (닫기)
          </button>
        </div>
      </div>
    </div>
  )
}
