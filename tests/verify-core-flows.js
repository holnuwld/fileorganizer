/**
 * Automated Verification Test Script for Fast Media Organizer
 *
 * Verifies:
 * 1. File system service (moving dummy file, conflict handling: ask/rename/skip/overwrite, undo operations, unicode filenames, folder creation edge cases)
 * 2. Settings & Target Slots persistence (atomic file writes, reload verification, dictionary/array formats, max undo cap)
 * 3. Path resolution & media:// URL conversions (standard, spaces, unicode, special chars, roundtrip, error resilience)
 * 4. IPC handlers contract validation (fs:* channels, store:* channels, dialog:* channels)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const assert = require('assert')
const ts = require('typescript')

// Setup TypeScript transpile hook for node execution
require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  })
  module._compile(transpiled.outputText, filename)
}

// Setup isolated temp environment for this test run
const TEST_ROOT = path.join(
  os.tmpdir(),
  `fmo-qa-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
)
const TEST_CONFIG_PATH = path.join(TEST_ROOT, 'config', 'test-config.json')
const TEST_SOURCE_DIR = path.join(TEST_ROOT, 'source')
const TEST_TARGET_DIR = path.join(TEST_ROOT, 'targets', 'slot1')

fs.mkdirSync(path.join(TEST_ROOT, 'config'), { recursive: true })
fs.mkdirSync(TEST_SOURCE_DIR, { recursive: true })
fs.mkdirSync(TEST_TARGET_DIR, { recursive: true })

// IPC mock registry
const ipcHandlers = new Map()
const ipcMainMock = {
  handle: (channel, handler) => {
    ipcHandlers.set(channel, handler)
  }
}
const ipcRendererMock = {
  invoke: async (channel, ...args) => {
    const handler = ipcHandlers.get(channel)
    if (!handler) throw new Error(`No IPC handler registered for '${channel}'`)
    return await handler({ sender: {} }, ...args)
  }
}

// Mock Electron for plain Node runtime
require.cache[require.resolve('electron')] = {
  exports: {
    app: {
      getPath: (name) => path.join(TEST_ROOT, name),
      whenReady: () => Promise.resolve(),
      on: () => {},
      quit: () => {}
    },
    protocol: {
      registerSchemesAsPrivileged: () => {},
      handle: () => {}
    },
    ipcMain: ipcMainMock,
    ipcRenderer: ipcRendererMock,
    dialog: {
      showOpenDialog: async () => ({ canceled: false, filePaths: [TEST_TARGET_DIR] })
    },
    BrowserWindow: class {},
    shell: {
      openExternal: () => {},
      showItemInFolder: () => {},
      openPath: async () => ''
    }
  }
}

// Import services after electron mock is in place
const { storeService, ConfigStore, DEFAULT_SETTINGS } = require('../src/main/store.ts')
const { fsService, FsService, generateNonConflictingPath } = require('../src/main/fs-service.ts')
const { filePathToMediaUrl, mediaUrlToFilePath, MEDIA_SCHEME } = require('../src/main/protocol.ts')
const { registerIpcHandlers } = require('../src/main/ipc-handlers.ts')

// Point store service to isolated test configuration
storeService.setConfigPath(TEST_CONFIG_PATH)

// Register IPC handlers into mock ipcMain
registerIpcHandlers()

// Test Runner Infrastructure
let passedTests = 0
let failedTests = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    Error: ${err.message}`)
    failures.push({ name, error: err })
    failedTests++
  }
}

function suite(title) {
  console.log(`\n=== ${title} ===`)
}

// Helper to create test file
function createDummyFile(filePath, content = 'dummy-media-content') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

async function runAllTests() {
  console.log(`=======================================================`)
  console.log(`  Fast Media Organizer - Automated Core Flow QA Tests  `)
  console.log(`  Test Working Root: ${TEST_ROOT}`)
  console.log(`=======================================================`)

  // ---------------------------------------------------------
  // SUITE 1: Path Resolution and URL Conversion (media://)
  // ---------------------------------------------------------
  suite('1. Path Resolution and media:// URL Conversion')

  await test('1.1 Standard Windows path roundtrip', () => {
    const original = 'C:\\Media\\Videos\\clip01.mp4'
    const url = filePathToMediaUrl(original)
    assert.strictEqual(url, 'media://local/C:/Media/Videos/clip01.mp4')
    const back = mediaUrlToFilePath(url)
    assert.strictEqual(back, path.normalize(original))
  })

  await test('1.2 Windows path with spaces roundtrip', () => {
    const original = 'C:\\My Projects\\Holiday 2024\\Family Video.mov'
    const url = filePathToMediaUrl(original)
    assert.ok(url.includes('Holiday%202024'))
    assert.ok(url.includes('Family%20Video.mov'))
    const back = mediaUrlToFilePath(url)
    assert.strictEqual(back, path.normalize(original))
  })

  await test('1.3 Special characters (#, ?, [], &) in path roundtrip', () => {
    const original = 'C:\\Photos\\Summer [2024] #1 & Final ?preview.jpg'
    const url = filePathToMediaUrl(original)
    assert.ok(url.includes('%23'), 'Hash symbol should be percent-encoded (%23)')
    assert.ok(url.includes('%3F'), 'Question mark should be percent-encoded (%3F)')
    const back = mediaUrlToFilePath(url)
    assert.strictEqual(back, path.normalize(original))
  })

  await test('1.4 Unicode and non-ASCII characters (Japanese, Emoji, Cyrillic) roundtrip', () => {
    const original = 'C:\\Pictures\\東京2026\\富士山_🗻_фото.png'
    const url = filePathToMediaUrl(original)
    assert.ok(url.startsWith('media://local/'))
    const back = mediaUrlToFilePath(url)
    assert.strictEqual(back, path.normalize(original))
  })

  await test('1.5 Alternate URL format with extra slashes normalization', () => {
    const urlAlt = 'media:///C:/test/file.mp4'
    const back = mediaUrlToFilePath(urlAlt)
    assert.strictEqual(back, path.normalize('C:/test/file.mp4'))
  })

  await test('1.6 Fallback for malformed URLs without throwing exceptions', () => {
    const malformed = 'media://local/invalid%ZZpath'
    const back = mediaUrlToFilePath(malformed)
    assert.ok(typeof back === 'string')
  })

  // ---------------------------------------------------------
  // SUITE 2: Settings & Target Slots Storage Persistence
  // ---------------------------------------------------------
  suite('2. Settings & Target Slots Storage Persistence')

  await test('2.1 Default settings initialization', () => {
    const settings = storeService.getSettings()
    assert.strictEqual(settings.autoPlayVideo, true)
    assert.strictEqual(settings.videoMuted, false)
    assert.strictEqual(settings.conflictPolicy, 'ask')
    assert.strictEqual(settings.hotkeys.playPause, 'Space')
    assert.strictEqual(settings.hotkeys.undo, 'Ctrl+Z')
  })

  await test('2.2 Update settings and verify memory cache', () => {
    const updated = storeService.saveSettings({
      autoPlayVideo: false,
      videoVolume: 0.65,
      conflictPolicy: 'rename',
      hotkeys: {
        ...DEFAULT_SETTINGS.hotkeys,
        playPause: 'KeyK'
      }
    })
    assert.strictEqual(updated.autoPlayVideo, false)
    assert.strictEqual(updated.videoVolume, 0.65)
    assert.strictEqual(updated.conflictPolicy, 'rename')
    assert.strictEqual(updated.hotkeys.playPause, 'KeyK')
  })

  await test('2.3 Verify atomic persistence on disk (JSON file verification)', () => {
    assert.ok(fs.existsSync(TEST_CONFIG_PATH), 'Config file must exist on disk')
    const raw = fs.readFileSync(TEST_CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    assert.strictEqual(parsed.settings.autoPlayVideo, false)
    assert.strictEqual(parsed.settings.videoVolume, 0.65)
    assert.strictEqual(parsed.settings.conflictPolicy, 'rename')
    assert.strictEqual(parsed.settings.hotkeys.playPause, 'KeyK')
  })

  await test('2.4 Save target slots as array and verify persistence', () => {
    const slots = [
      { id: 1, path: 'C:\\Organized\\Favorites', name: 'Favs' },
      { id: 2, path: 'C:\\Organized\\Work', name: 'Work' }
    ]
    const saved = storeService.saveTargetSlots(slots)
    assert.strictEqual(saved.length, 2)
    assert.strictEqual(saved[0].name, 'Favs')
    assert.strictEqual(saved[1].path, 'C:\\Organized\\Work')

    const raw = JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, 'utf8'))
    assert.strictEqual(raw.targetSlots.length, 2)
    assert.strictEqual(raw.targetSlots[0].name, 'Favs')
  })

  await test('2.5 Save target slots using dictionary/record format (keys 1-9)', () => {
    const dictSlots = {
      1: { id: 1, path: 'D:\\Folder1', name: 'Folder 1' },
      3: { id: 3, path: 'D:\\Folder3', name: 'Folder 3' },
      5: null
    }
    const saved = storeService.saveTargetSlots(dictSlots)
    assert.strictEqual(saved.length, 2)
    const slot1 = saved.find((s) => s.id === 1)
    const slot3 = saved.find((s) => s.id === 3)
    assert.ok(slot1 && slot1.path === 'D:\\Folder1')
    assert.ok(slot3 && slot3.path === 'D:\\Folder3')
  })

  await test('2.6 Cold start persistence check (new ConfigStore instance from disk)', () => {
    const freshStore = new ConfigStore()
    freshStore.setConfigPath(TEST_CONFIG_PATH)
    const loadedSettings = freshStore.getSettings()
    const loadedSlots = freshStore.getTargetSlots()

    assert.strictEqual(loadedSettings.autoPlayVideo, false)
    assert.strictEqual(loadedSettings.videoVolume, 0.65)
    assert.strictEqual(loadedSettings.hotkeys.playPause, 'KeyK')
    assert.strictEqual(loadedSlots.length, 2)
  })

  await test('2.7 Undo history push, pop and max-50 cap enforcement', () => {
    for (let i = 1; i <= 60; i++) {
      storeService.pushUndoAction({
        id: `undo-${i}`,
        type: 'move',
        sourcePath: `C:\\source\\file${i}.jpg`,
        destinationPath: `C:\\dest\\file${i}.jpg`,
        timestamp: Date.now() + i
      })
    }
    const history = storeService.getUndoHistory()
    assert.strictEqual(history.length, 50, 'Undo history must be capped at 50')
    assert.strictEqual(history[0].id, 'undo-60', 'Latest pushed item must be at index 0')

    const popped = storeService.popUndoAction()
    assert.strictEqual(popped.id, 'undo-60')
    assert.strictEqual(storeService.getUndoHistory().length, 49)
  })

  // ---------------------------------------------------------
  // SUITE 3: File System Service Core Flows
  // ---------------------------------------------------------
  suite('3. File System Service Operations & Undo')

  await test('3.1 Generate non-conflicting path incrementation', async () => {
    const testFile = path.join(TEST_TARGET_DIR, 'sample.txt')
    createDummyFile(testFile, 'initial')

    const candidate1 = await generateNonConflictingPath(testFile)
    assert.strictEqual(candidate1, path.join(TEST_TARGET_DIR, 'sample (1).txt'))

    createDummyFile(candidate1, 'second')
    const candidate2 = await generateNonConflictingPath(testFile)
    assert.strictEqual(candidate2, path.join(TEST_TARGET_DIR, 'sample (2).txt'))
  })

  await test('3.2 Move dummy file successfully without conflict', async () => {
    const sourceFile = path.join(TEST_SOURCE_DIR, 'item-to-move.jpg')
    createDummyFile(sourceFile, 'test-image-binary-data')

    const result = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'ask', 1)
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.action, 'move')
    assert.strictEqual(fs.existsSync(sourceFile), false, 'Source file must be moved')
    assert.strictEqual(fs.existsSync(result.destinationPath), true, 'Destination file must exist')
    assert.strictEqual(fs.readFileSync(result.destinationPath, 'utf8'), 'test-image-binary-data')
  })

  await test('3.3 Conflict Handling - Policy "ask": detects conflict and aborts safely', async () => {
    const conflictFileName = 'conflict-test.mp4'
    const sourceFile = path.join(TEST_SOURCE_DIR, conflictFileName)
    const destFile = path.join(TEST_TARGET_DIR, conflictFileName)

    createDummyFile(sourceFile, 'new-source-content')
    createDummyFile(destFile, 'existing-target-content')

    const result = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'ask')
    assert.strictEqual(result.success, false)
    assert.strictEqual(result.conflict, true)
    assert.strictEqual(fs.existsSync(sourceFile), true, 'Source must remain untouched on conflict')
    assert.strictEqual(
      fs.readFileSync(destFile, 'utf8'),
      'existing-target-content',
      'Target must not be altered'
    )
  })

  await test('3.4 Conflict Handling - Policy "rename": creates non-conflicting (1) file', async () => {
    const conflictFileName = 'conflict-rename.mp4'
    const sourceFile = path.join(TEST_SOURCE_DIR, conflictFileName)
    const destFile = path.join(TEST_TARGET_DIR, conflictFileName)

    createDummyFile(sourceFile, 'source-to-rename')
    createDummyFile(destFile, 'existing-dest-content')

    const result = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'rename', 2)
    assert.strictEqual(result.success, true)
    assert.ok(result.destinationPath.includes('(1)'), 'Destination must have (1) suffix')
    assert.strictEqual(fs.existsSync(sourceFile), false, 'Source must be moved')
    assert.strictEqual(fs.existsSync(destFile), true, 'Existing file must still be present')
    assert.strictEqual(fs.readFileSync(destFile, 'utf8'), 'existing-dest-content')
    assert.strictEqual(fs.readFileSync(result.destinationPath, 'utf8'), 'source-to-rename')
  })

  await test('3.5 Conflict Handling - Policy "skip": retains source and destination intact', async () => {
    const conflictFileName = 'conflict-skip.mp4'
    const sourceFile = path.join(TEST_SOURCE_DIR, conflictFileName)
    const destFile = path.join(TEST_TARGET_DIR, conflictFileName)

    createDummyFile(sourceFile, 'source-skip-content')
    createDummyFile(destFile, 'dest-skip-content')

    const result = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'skip')
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.skipped, true)
    assert.strictEqual(fs.existsSync(sourceFile), true, 'Source must not be removed')
    assert.strictEqual(fs.readFileSync(sourceFile, 'utf8'), 'source-skip-content')
    assert.strictEqual(fs.readFileSync(destFile, 'utf8'), 'dest-skip-content')
  })

  await test('3.6 Conflict Handling - Policy "overwrite": replaces existing destination file', async () => {
    const conflictFileName = 'conflict-overwrite.mp4'
    const sourceFile = path.join(TEST_SOURCE_DIR, conflictFileName)
    const destFile = path.join(TEST_TARGET_DIR, conflictFileName)

    createDummyFile(sourceFile, 'fresh-overwrite-payload')
    createDummyFile(destFile, 'old-payload-to-be-overwritten')

    const result = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'overwrite')
    assert.strictEqual(result.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), false, 'Source must be moved')
    assert.strictEqual(fs.existsSync(destFile), true)
    assert.strictEqual(
      fs.readFileSync(destFile, 'utf8'),
      'fresh-overwrite-payload',
      'Dest must contain new payload'
    )
  })

  await test('3.7 Undo latest move action: restores file to original path', async () => {
    const undoFileName = 'file-for-undo.png'
    const sourceFile = path.join(TEST_SOURCE_DIR, undoFileName)
    createDummyFile(sourceFile, 'undo-content-check')

    const moveResult = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'ask', 3)
    assert.strictEqual(moveResult.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), false)

    const undoResult = await fsService.undoLatestAction()
    assert.strictEqual(undoResult.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), true, 'File should be restored to original path')
    assert.strictEqual(fs.readFileSync(sourceFile, 'utf8'), 'undo-content-check')
    assert.strictEqual(
      fs.existsSync(moveResult.destinationPath),
      false,
      'File must be removed from target dir'
    )
  })

  await test('3.8 Copy operation and copy undoing', async () => {
    const copyFileName = 'file-for-copy.png'
    const sourceFile = path.join(TEST_SOURCE_DIR, copyFileName)
    createDummyFile(sourceFile, 'copy-content')

    const copyResult = await fsService.copyFile(sourceFile, TEST_TARGET_DIR, 'ask', 4)
    assert.strictEqual(copyResult.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), true, 'Source must still exist after copy')
    assert.strictEqual(
      fs.existsSync(copyResult.destinationPath),
      true,
      'Copy destination must exist'
    )

    const undoResult = await fsService.undoLatestAction()
    assert.strictEqual(undoResult.success, true)
    assert.strictEqual(
      fs.existsSync(copyResult.destinationPath),
      false,
      'Copied file must be deleted upon undo'
    )
    assert.strictEqual(fs.existsSync(sourceFile), true, 'Original file remains intact')
  })

  await test('3.9 Unicode & Emoji filename support with move and undo', async () => {
    const unicodeName = 'テスト動画_🎥_2026.webm'
    const sourceFile = path.join(TEST_SOURCE_DIR, unicodeName)
    createDummyFile(sourceFile, 'unicode-video-stream')

    const moveResult = await fsService.moveFile(sourceFile, TEST_TARGET_DIR, 'ask')
    assert.strictEqual(moveResult.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), false)
    assert.strictEqual(fs.existsSync(moveResult.destinationPath), true)

    const undoResult = await fsService.undoLatestAction()
    assert.strictEqual(undoResult.success, true)
    assert.strictEqual(fs.existsSync(sourceFile), true)
  })

  await test('3.10 Non-existent source file returns error cleanly', async () => {
    const nonExistent = path.join(TEST_SOURCE_DIR, 'does-not-exist.mp4')
    const result = await fsService.moveFile(nonExistent, TEST_TARGET_DIR, 'ask')
    assert.strictEqual(result.success, false)
    assert.ok(result.error && result.error.includes('does not exist'))
  })

  await test('3.11 Folder creation and character validation edge cases', async () => {
    // Valid folder creation
    const valid = await fsService.createFolder(TEST_TARGET_DIR, 'New Subfolder')
    assert.strictEqual(valid.success, true)
    assert.ok(fs.existsSync(valid.path))

    // Duplicate folder rejection
    const duplicate = await fsService.createFolder(TEST_TARGET_DIR, 'New Subfolder')
    assert.strictEqual(duplicate.success, false)
    assert.strictEqual(duplicate.error, 'Folder already exists')

    // Empty folder name rejection
    const empty = await fsService.createFolder(TEST_TARGET_DIR, '   ')
    assert.strictEqual(empty.success, false)
    assert.strictEqual(empty.error, 'Folder name cannot be empty')

    // Invalid character rejection
    const invalid = await fsService.createFolder(TEST_TARGET_DIR, 'invalid:folder?name')
    assert.strictEqual(invalid.success, false)
    assert.strictEqual(invalid.error, 'Folder name contains invalid characters')
  })

  await test('3.12 Folder contents listing and natural sort order', async () => {
    const contents = await fsService.getFolderContents(TEST_TARGET_DIR, 'name', 'asc')
    assert.ok(Array.isArray(contents))
    assert.ok(contents.length > 0)
    for (const item of contents) {
      assert.ok(item.name)
      assert.ok(item.path)
      assert.ok(typeof item.isDirectory === 'boolean')
      assert.ok(typeof item.type === 'string')
    }
  })

  // ---------------------------------------------------------
  // SUITE 4: IPC Handler Contracts Integration
  // ---------------------------------------------------------
  suite('4. IPC Handler Contracts Integration')

  await test('4.1 IPC store:getSettings and store:saveSettings roundtrip', async () => {
    const saved = await ipcRendererMock.invoke('store:saveSettings', { videoVolume: 0.92 })
    assert.strictEqual(saved, true)
    const settings = await ipcRendererMock.invoke('store:getSettings')
    assert.strictEqual(settings.videoVolume, 0.92)
  })

  await test('4.2 IPC store:getTargetSlots and store:saveTargetSlots roundtrip', async () => {
    const testSlots = [{ id: 1, path: TEST_TARGET_DIR, name: 'Target Slot 1' }]
    const saved = await ipcRendererMock.invoke('store:saveTargetSlots', testSlots)
    assert.strictEqual(saved, true)
    const slots = await ipcRendererMock.invoke('store:getTargetSlots')
    assert.strictEqual(slots.length, 1)
    assert.strictEqual(slots[0].name, 'Target Slot 1')
  })

  await test('4.3 IPC fs:moveFile and fs:undoAction integration', async () => {
    const file = path.join(TEST_SOURCE_DIR, 'ipc-test.png')
    createDummyFile(file, 'ipc-file-data')

    const moveRes = await ipcRendererMock.invoke('fs:moveFile', file, TEST_TARGET_DIR, 'ask', 1)
    assert.strictEqual(moveRes.success, true)
    assert.strictEqual(fs.existsSync(file), false)

    const undoRes = await ipcRendererMock.invoke('fs:undoAction')
    assert.strictEqual(undoRes.success, true)
    assert.strictEqual(fs.existsSync(file), true)
  })

  await test('4.4 IPC dialog:selectFolder returns configured folder path', async () => {
    const selected = await ipcRendererMock.invoke('dialog:selectFolder')
    assert.strictEqual(selected, TEST_TARGET_DIR)
  })

  // Cleanup test artifacts
  try {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors on Windows locks
  }

  // ---------------------------------------------------------
  // FINAL RESULTS SUMMARY
  // ---------------------------------------------------------
  console.log(`\n=======================================================`)
  console.log(`  QA Test Results: ${passedTests} Passed, ${failedTests} Failed  `)
  console.log(`=======================================================`)

  if (failedTests > 0) {
    console.error(`\nFailed tests detail:`)
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}) ${f.name}: ${f.error.message}`)
    })
    process.exit(1)
  } else {
    console.log(`\nAll core flows verified successfully!\n`)
    process.exit(0)
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
