import "./App.css"
import "@xterm/xterm/css/xterm.css"

import { Editor, DiffEditor } from "@monaco-editor/react"
import { Terminal } from "@xterm/xterm"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import * as Y from "yjs"
import JSZip from "jszip"

import { SpringWebSocketProvider } from "../yjs/SpringWebSocketProvider"
import {
  runDiagnostics,
  parseCompilerOutput,
  LANGUAGE_STARTERS,
  SEVERITY
} from "../diagnostics"
import { formatDocument } from "../formatting"
import { registerCompletionProviders } from "../completions"
import { renderMarkdown } from "../markdown"

function getLanguageFromFileName(filename) {
  if (!filename) return "javascript"
  const ext = filename.split(".").pop().toLowerCase()
  switch (ext) {
    case "py": return "python"
    case "js": case "mjs": case "cjs": return "javascript"
    case "ts": case "tsx": return "typescript"
    case "java": return "java"
    case "cpp": case "cc": case "cxx": case "hpp": case "h": return "cpp"
    case "c": return "c"
    case "go": return "go"
    case "rs": return "rust"
    case "cs": return "csharp"
    case "rb": return "ruby"
    case "php": return "php"
    case "kt": case "kts": return "kotlin"
    case "swift": return "swift"
    case "html": case "htm": return "html"
    case "css": return "css"
    case "json": return "json"
    case "sql": return "sql"
    case "md": case "markdown": return "markdown"
    default: return "plaintext"
  }
}

function getFileNameForLanguage(language) {
  switch (language?.toLowerCase()) {
    case "python": return "main.py"
    case "java": return "Main.java"
    case "cpp": return "main.cpp"
    case "c": return "main.c"
    case "javascript": return "index.js"
    case "typescript": return "index.ts"
    case "go": return "main.go"
    case "rust": return "main.rs"
    case "csharp": return "Program.cs"
    case "ruby": return "main.rb"
    case "php": return "index.php"
    case "kotlin": return "main.kt"
    case "swift": return "main.swift"
    case "sql": return "query.sql"
    case "html": return "index.html"
    case "css": return "style.css"
    case "json": return "data.json"
    case "markdown": case "md": return "README.md"
    default: return "main.txt"
  }
}

function getFileIcon(filename) {
  const lang = getLanguageFromFileName(filename)
  const ext = filename?.split(".").pop()?.toLowerCase() || ""

  let dotColor = "#8b949e"
  let label = ext || "txt"

  switch (lang) {
    case "python":
      dotColor = "#3572A5"
      label = "py"
      break
    case "javascript":
      dotColor = "#f1e05a"
      label = "js"
      break
    case "typescript":
      dotColor = "#3178c6"
      label = "ts"
      break
    case "java":
      dotColor = "#b07219"
      label = "java"
      break
    case "cpp":
    case "c":
      dotColor = "#f34b7d"
      label = ext || "c"
      break
    case "go":
      dotColor = "#00ADD8"
      label = "go"
      break
    case "rust":
      dotColor = "#dea584"
      label = "rs"
      break
    case "csharp":
      dotColor = "#178600"
      label = "cs"
      break
    case "ruby":
      dotColor = "#701516"
      label = "rb"
      break
    case "php":
      dotColor = "#4F5D95"
      label = "php"
      break
    case "kotlin":
      dotColor = "#A97BFF"
      label = "kt"
      break
    case "swift":
      dotColor = "#F05138"
      label = "swift"
      break
    case "html":
      dotColor = "#e34c26"
      label = "html"
      break
    case "css":
      dotColor = "#563d7c"
      label = "css"
      break
    case "json":
      dotColor = "#cbcb41"
      label = "json"
      break
    case "sql":
      dotColor = "#e38c00"
      label = "sql"
      break
    case "markdown":
      dotColor = "#083fa1"
      label = "md"
      break
    default:
      dotColor = "#8b949e"
      label = ext || "file"
  }

  return (
    <span
      className="inline-flex items-center justify-center min-w-[15px] h-3.5 px-0.5 rounded-[2px] text-[7.5px] font-bold font-mono uppercase tracking-tight leading-none flex-shrink-0"
      style={{
        backgroundColor: `${dotColor}20`,
        color: dotColor,
        border: `1px solid ${dotColor}40`
      }}
      title={lang}
    >
      {label.slice(0, 3)}
    </span>
  )
}

/**
 * Builds a hierarchical tree structure from a flat list of file paths.
 */
function buildTreeFromPaths(filePaths) {
  const root = { name: "root", path: "", isDirectory: true, children: {} }

  for (const filePath of filePaths) {
    const parts = filePath.split("/").filter(Boolean)
    let current = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join("/")

      if (isLast) {
        current.children[part] = {
          name: part,
          path: filePath,
          isDirectory: false
        }
      } else {
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDirectory: true,
            children: {}
          }
        }
        current = current.children[part]
      }
    }
  }

  function convertToArray(node) {
    if (!node.isDirectory) return node
    const childrenArray = Object.values(node.children).map(convertToArray)
    childrenArray.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name)
      }
      return a.isDirectory ? -1 : 1
    })
    return {
      ...node,
      children: childrenArray
    }
  }

  return convertToArray(root).children || []
}

/**
 * Bundles HTML, CSS, and JS workspace files into a self-contained document for iframe rendering.
 */
function generateWebPreviewBundle(files, activeFile) {
  let html = files["index.html"] || ""
  if (!html) {
    if (activeFile && activeFile.endsWith(".html") && files[activeFile]) {
      html = files[activeFile]
    } else {
      const htmlKey = Object.keys(files).find((k) => k.endsWith(".html"))
      if (htmlKey) {
        html = files[htmlKey]
      } else {
        html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SyncStream Live Preview</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`
      }
    }
  }

  let cssBundle = ""
  for (const [fname, content] of Object.entries(files)) {
    if (fname.endsWith(".css") && content.trim()) {
      cssBundle += `\n/* ${fname} */\n${content}\n`
    }
  }

  let jsBundle = ""
  for (const [fname, content] of Object.entries(files)) {
    if ((fname.endsWith(".js") || fname.endsWith(".ts")) && content.trim()) {
      jsBundle += `\n// ${fname}\ntry {\n${content}\n} catch(err) { console.error(err); }\n`
    }
  }

  const consoleScript = `
<script>
(function() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  function sendLog(level, args) {
    try {
      const msg = Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      window.parent.postMessage({ type: 'syncstream:preview_log', level, message: msg }, '*');
    } catch(e) {}
  }
  console.log = function(...args) { sendLog('log', args); originalLog.apply(console, args); };
  console.warn = function(...args) { sendLog('warn', args); originalWarn.apply(console, args); };
  console.error = function(...args) { sendLog('error', args); originalError.apply(console, args); };
  window.addEventListener('error', function(e) {
    sendLog('error', [e.message + ' at line ' + e.lineno]);
  });
})();
</script>`

  let outputHtml = html

  if (cssBundle) {
    const styleTag = `<style>${cssBundle}</style>`
    if (outputHtml.includes("</head>")) {
      outputHtml = outputHtml.replace("</head>", styleTag + "\n</head>")
    } else {
      outputHtml = styleTag + outputHtml
    }
  }

  if (outputHtml.includes("<head>")) {
    outputHtml = outputHtml.replace("<head>", "<head>\n" + consoleScript)
  } else {
    outputHtml = consoleScript + outputHtml
  }

  if (jsBundle) {
    const scriptTag = `<script>\n${jsBundle}\n</script>`
    if (outputHtml.includes("</body>")) {
      outputHtml = outputHtml.replace("</body>", scriptTag + "\n</body>")
    } else {
      outputHtml = outputHtml + scriptTag
    }
  }

  return outputHtml
}

const USER_COLORS = [
  "#f85149",
  "#d29922",
  "#3fb950",
  "#58a6ff",
  "#bc8cff",
  "#f0883e",
  "#2ea043",
  "#a371f7",
  "#39c5bb",
  "#e36209"
]

function getUserColor(name) {
  if (!name) return "#58a6ff"
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

function App() {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const providerRef = useRef(null)

  const terminalRef = useRef(null)
  const terminalContainerRef = useRef(null)
  const terminalSocketRef = useRef(null)
  const terminalResizeObserverRef = useRef(null)
  const importFileInputRef = useRef(null)

  const connectionTimeoutRef = useRef(null)
  const validationTimerRef = useRef(null)
  const previewTimerRef = useRef(null)
  const monacoBindingRef = useRef(null)
  const chatEndRef = useRef(null)

  const remoteCursorsRef = useRef(new Map())
  const remoteCursorWidgetsRef = useRef(new Map())
  const remoteSelectionsRef = useRef(new Map())

  const [username, setUsername] = useState(() => {
    return (
      new URLSearchParams(
        window.location.search
      ).get("username") || ""
    )
  })

  const [users, setUsers] = useState([])

  const [room, setRoom] = useState(() => {
    return (
      new URLSearchParams(
        window.location.search
      ).get("room") || ""
    )
  })

  const [connectionState, setConnectionState] = useState("CONNECTING")
  const [connectionTimedOut, setConnectionTimedOut] = useState(false)
  const [documentReady, setDocumentReady] = useState(false)

  const [language, setLanguage] = useState("javascript")
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [activeBottomTab, setActiveBottomTab] = useState("terminal")
  const [diagnostics, setDiagnostics] = useState([])
  const [outputLogs, setOutputLogs] = useState("")
  const [isRunning, setIsRunning] = useState(false)
  const [cursorPos, setCursorPos] = useState({ lineNumber: 1, column: 1 })
  const [terminalHeight, setTerminalHeight] = useState(240)
  const [terminalMaximized, setTerminalMaximized] = useState(false)
  const [tabSize, setTabSize] = useState(4)
  const [wordWrap, setWordWrap] = useState("on")

  // VS Code Layout State
  const [activeActivityTab, setActiveActivityTab] = useState("explorer")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingTerminal, setIsResizingTerminal] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Multi-File Project State & Folders
  const [fileList, setFileList] = useState(["main.js"])
  const [activeFile, setActiveFile] = useState("main.js")
  const [openTabs, setOpenTabs] = useState(["main.js"])
  const [expandedFolders, setExpandedFolders] = useState(() => new Set(["src", "public", "styles"]))
  const [isCreatingNode, setIsCreatingNode] = useState(null)
  const [newPathInput, setNewPathInput] = useState("")
  const [renamingNode, setRenamingNode] = useState(null)
  const [renameInput, setRenameInput] = useState("")

  // Live Web Preview State
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDevice, setPreviewDevice] = useState("desktop")
  const [previewKey, setPreviewKey] = useState(1)
  const [previewSrcDoc, setPreviewSrcDoc] = useState("")

  // In-Room Collaborative Chat State
  const [chatMessages, setChatMessages] = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [chatInputText, setChatInputText] = useState("")

  // Global Project Search & Replace State (Ctrl+Shift+F)
  const [searchQuery, setSearchQuery] = useState("")
  const [replaceQuery, setReplaceQuery] = useState("")
  const [searchMatchCase, setSearchMatchCase] = useState(false)
  const [searchUseRegex, setSearchUseRegex] = useState(false)
  const [searchWholeWord, setSearchWholeWord] = useState(false)
  const [searchIncludeFilter, setSearchIncludeFilter] = useState("")
  const [searchExcludeFilter, setSearchExcludeFilter] = useState("")
  const [showReplaceDrawer, setShowReplaceDrawer] = useState(true)
  const [collapsedSearchFiles, setCollapsedSearchFiles] = useState(() => new Set())
  const [searchResults, setSearchResults] = useState([])
  const [searchStatus, setSearchStatus] = useState("")
  const searchInputRef = useRef(null)

  const [joined, setJoined] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return Boolean(params.get("room") && params.get("username"))
  })

  const [shareMessage, setShareMessage] = useState("")
  const [joinError, setJoinError] = useState("")
  const [createError, setCreateError] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const ymetadata = useMemo(() => ydoc.getMap("metadata"), [ydoc])
  const yfiles = useMemo(() => ydoc.getMap("files"), [ydoc])
  const ychat = useMemo(() => ydoc.getArray("chat"), [ydoc])
  const ycommits = useMemo(() => ydoc.getArray("commits"), [ydoc])
  const yroles = useMemo(() => ydoc.getMap("roles"), [ydoc])
  const ykicked = useMemo(() => ydoc.getMap("kicked"), [ydoc])
  const yText = useMemo(() => ydoc.getText("monaco"), [ydoc])

  // Source Control / Git State & Content Revision
  const [commitsList, setCommitsList] = useState([])
  const [gitCommitMessage, setGitCommitMessage] = useState("")
  const [baselineFiles, setBaselineFiles] = useState({})
  const [baselineInitialized, setBaselineInitialized] = useState(false)
  const [contentRevision, setContentRevision] = useState(0)

  // User Hierarchy & Role-Based Access Control
  const [rolesMap, setRolesMap] = useState({})

  // Quick Open & Command Palette
  const [paletteMode, setPaletteMode] = useState(null) // "quickOpen" | "commandPalette" | null
  const [paletteQuery, setPaletteQuery] = useState("")
  const [paletteSelectedIndex, setPaletteSelectedIndex] = useState(0)

  // Git Diff Viewer Modal
  const [diffModalFile, setDiffModalFile] = useState(null)
  const [diffInline, setDiffInline] = useState(false)

  // Collaborator Follow Mode
  const [followingUser, setFollowingUser] = useState(null)
  const followingUserRef = useRef(null)

  // Editor Appearance & Theme Settings
  const [editorTheme, setEditorTheme] = useState("vs-dark")
  const [editorFontSize, setEditorFontSize] = useState(13.5)
  const [editorMinimap, setEditorMinimap] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)

  // Floating Context Menu (Tabs & Explorer)
  const [contextMenu, setContextMenu] = useState(null) // { type: "tab"|"explorer", x, y, target, isDirectory? }

  // Advanced Share & Embed Dialog Modal
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)

  // Live Markdown Preview (.md / .markdown files)
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false)

  // Keyboard Shortcuts Cheat-Sheet Modal (Ctrl+/)
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false)

  // Mobile Header Action Menu Drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const languageRef = useRef(language)
  const validateCodeRef = useRef(null)
  const isRunningRef = useRef(isRunning)
  const activeFileRef = useRef(activeFile)
  const activeActivityTabRef = useRef(activeActivityTab)

  useEffect(() => {
    followingUserRef.current = followingUser
  }, [followingUser])

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  useEffect(() => {
    activeFileRef.current = activeFile
  }, [activeFile])

  useEffect(() => {
    activeActivityTabRef.current = activeActivityTab
    if (activeActivityTab === "chat") {
      setUnreadChatCount(0)
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    }
  }, [activeActivityTab])

  /*
   * Synchronize collaborative chat messages.
   */
  useEffect(() => {
    const handleChatChange = () => {
      const msgs = ychat.toArray()
      setChatMessages(msgs)
      if (activeActivityTabRef.current !== "chat" && msgs.length > 0) {
        setUnreadChatCount((c) => c + 1)
      }
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 50)
    }

    ychat.observe(handleChatChange)
    handleChatChange()

    return () => {
      ychat.unobserve(handleChatChange)
    }
  }, [ychat])

  /*
   * Synchronize collaborative Git commit history.
   */
  useEffect(() => {
    const handleCommitsChange = () => {
      setCommitsList(ycommits.toArray())
    }
    ycommits.observe(handleCommitsChange)
    handleCommitsChange()
    return () => {
      ycommits.unobserve(handleCommitsChange)
    }
  }, [ycommits])

  /*
   * Synchronize collaborative User Roles.
   */
  useEffect(() => {
    const handleRolesChange = () => {
      const currentRoles = {}
      for (const [u, r] of yroles.entries()) {
        currentRoles[u] = r
      }
      setRolesMap(currentRoles)
    }

    yroles.observe(handleRolesChange)
    handleRolesChange()
    return () => yroles.unobserve(handleRolesChange)
  }, [yroles])

  /*
   * Assign initial Owner / Editor / Viewer role upon document sync.
   */
  useEffect(() => {
    if (documentReady && username) {
      const urlRole = new URLSearchParams(window.location.search).get("role")
      if (yroles.size === 0) {
        yroles.set(username, "owner")
      } else if (!yroles.has(username)) {
        if (urlRole === "viewer") {
          yroles.set(username, "viewer")
        } else {
          yroles.set(username, "editor")
        }
      }
    }
  }, [documentReady, username, yroles])

  /*
   * Reactively bump content revision on Yjs updates.
   */
  useEffect(() => {
    const handleDocUpdate = () => {
      setContentRevision((r) => r + 1)
    }
    ydoc.on("update", handleDocUpdate)
    return () => ydoc.off("update", handleDocUpdate)
  }, [ydoc])

  /*
   * Detect if the current user has been kicked from the room.
   */
  useEffect(() => {
    const handleKickCheck = () => {
      if (ykicked.get(username) === true) {
        handleLeaveRoom()
      }
    }
    ykicked.observe(handleKickCheck)
    handleKickCheck()
    return () => ykicked.unobserve(handleKickCheck)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ykicked, username])

  /*
   * Initialize baseline snapshot for Git change tracking.
   */
  useEffect(() => {
    if (documentReady && !baselineInitialized && yfiles.size > 0) {
      const timer = setTimeout(() => {
        const snap = {}
        for (const fname of yfiles.keys()) {
          snap[fname] = ydoc.getText("file:" + fname).toString()
        }
        setBaselineFiles(snap)
        setBaselineInitialized(true)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [documentReady, baselineInitialized, yfiles, ydoc])

  /*
   * Compute dynamic workspace Git changes (reacts live to contentRevision).
   */
  const gitChanges = useMemo(() => {
    if (!baselineInitialized) return []
    const changes = []
    const currentKeys = Array.from(yfiles.keys()).filter(
      (f) => !f.endsWith(".keep") || yfiles.size === 1
    )

    for (const fname of currentKeys) {
      const currentContent = ydoc.getText("file:" + fname).toString()
      if (baselineFiles[fname] === undefined) {
        changes.push({ filePath: fname, status: "U" })
      } else if (baselineFiles[fname] !== currentContent) {
        changes.push({ filePath: fname, status: "M" })
      }
    }

    for (const fname of Object.keys(baselineFiles)) {
      if (!yfiles.has(fname) && !fname.endsWith(".keep")) {
        changes.push({ filePath: fname, status: "D" })
      }
    }

    return changes
  }, [baselineInitialized, yfiles, baselineFiles, ydoc, contentRevision])

  const gitStatusMap = useMemo(() => {
    const map = {}
    gitChanges.forEach((c) => {
      map[c.filePath] = c.status
    })
    return map
  }, [gitChanges])

  const myRole = rolesMap[username] || "editor"
  const isViewer = myRole === "viewer"
  const isOwner = myRole === "owner"
  const isAdmin = myRole === "admin"

  const handlePromoteUser = (targetUsername) => {
    const targetRole = rolesMap[targetUsername] || "editor"
    if (isOwner) {
      if (targetRole === "viewer") yroles.set(targetUsername, "editor")
      else if (targetRole === "editor") yroles.set(targetUsername, "admin")
    } else if (isAdmin && targetRole === "viewer") {
      yroles.set(targetUsername, "editor")
    }
  }

  const handleDemoteUser = (targetUsername) => {
    const targetRole = rolesMap[targetUsername] || "editor"
    if (isOwner) {
      if (targetRole === "admin") yroles.set(targetUsername, "editor")
      else if (targetRole === "editor") yroles.set(targetUsername, "viewer")
    } else if (isAdmin && targetRole === "editor") {
      yroles.set(targetUsername, "viewer")
    }
  }

  const handleKickUser = (targetUsername) => {
    const targetRole = rolesMap[targetUsername] || "editor"
    if (isOwner && targetRole !== "owner") {
      ykicked.set(targetUsername, true)
    } else if (isAdmin && (targetRole === "editor" || targetRole === "viewer")) {
      ykicked.set(targetUsername, true)
    }
  }

  const handleCommit = (e) => {
    e?.preventDefault()
    const msg = gitCommitMessage.trim() || "Update workspace"
    if (gitChanges.length === 0) return

    const newCommit = {
      id: crypto.randomUUID().slice(0, 7),
      message: msg,
      author: username || "Anonymous",
      timestamp: Date.now(),
      filesCount: gitChanges.length
    }

    ycommits.push([newCommit])

    const nextBaseline = {}
    for (const fname of yfiles.keys()) {
      nextBaseline[fname] = ydoc.getText("file:" + fname).toString()
    }
    setBaselineFiles(nextBaseline)
    setGitCommitMessage("")
  }

  const handleDiscardChange = (filePath, status, e) => {
    e?.stopPropagation()
    if (status === "U") {
      handleDeleteFile(filePath)
    } else if (status === "M") {
      const original = baselineFiles[filePath]
      if (original !== undefined) {
        const ytext = ydoc.getText("file:" + filePath)
        ydoc.transact(() => {
          ytext.delete(0, ytext.length)
          ytext.insert(0, original)
        })
      }
    } else if (status === "D") {
      const original = baselineFiles[filePath]
      if (original !== undefined) {
        const fileLang = getLanguageFromFileName(filePath)
        ydoc.transact(() => {
          yfiles.set(filePath, { name: filePath, language: fileLang })
          const ytext = ydoc.getText("file:" + filePath)
          ytext.delete(0, ytext.length)
          ytext.insert(0, original)
        })
      }
    }
  }

  const handleSendChat = (e) => {
    e?.preventDefault()
    const trimmed = chatInputText.trim()
    if (!trimmed) return

    const msg = {
      id: crypto.randomUUID(),
      sender: username || "Anonymous",
      text: trimmed,
      timestamp: Date.now()
    }

    ychat.push([msg])
    setChatInputText("")
  }

  /*
   * Debounced diagnostics validation.
   */
  const validateCode = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      return
    }

    const model = editorRef.current.getModel()
    if (!model) {
      return
    }

    const currentLang = languageRef.current || "javascript"
    const code = model.getValue()
    const markers = runDiagnostics(code, currentLang)

    monacoRef.current.editor.setModelMarkers(
      model,
      "syncstream-diagnostics",
      markers
    )

    setDiagnostics(markers)
  }, [])

  useEffect(() => {
    validateCodeRef.current = validateCode
  }, [validateCode])

  /*
   * Re-validate when language changes.
   */
  useEffect(() => {
    languageRef.current = language
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel()
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, language)
      }
    }
    validateCode()
  }, [language, validateCode])

  /*
   * Web preview console relay listener.
   */
  useEffect(() => {
    const handleMsg = (event) => {
      if (event.data?.type === "syncstream:preview_log") {
        const { level, message } = event.data
        const prefix =
          level === "error"
            ? "\u001B[31m[Preview Error]\u001B[0m "
            : level === "warn"
            ? "\u001B[33m[Preview Warn]\u001B[0m "
            : "\u001B[36m[Preview Console]\u001B[0m "
        setOutputLogs((prev) => prev + prefix + message + "\r\n")
      }
    }
    window.addEventListener("message", handleMsg)
    return () => window.removeEventListener("message", handleMsg)
  }, [])

  /*
   * Update live web preview bundle.
   */
  const updatePreview = useCallback(() => {
    if (!previewOpen) return
    const filesMap = {}
    for (const fname of yfiles.keys()) {
      filesMap[fname] = ydoc.getText("file:" + fname).toString()
    }
    if (editorRef.current && activeFile) {
      filesMap[activeFile] = editorRef.current.getValue()
    }
    const bundled = generateWebPreviewBundle(filesMap, activeFile)
    setPreviewSrcDoc(bundled)
  }, [previewOpen, yfiles, ydoc, activeFile])

  useEffect(() => {
    if (previewOpen) {
      const timer = setTimeout(updatePreview, 250)
      return () => clearTimeout(timer)
    }
  }, [previewOpen, previewKey, activeFile, updatePreview])

  const isWebContext = useMemo(() => {
    const webLangs = ["html", "css", "javascript", "typescript"]
    const hasWebExt =
      activeFile.endsWith(".html") ||
      activeFile.endsWith(".htm") ||
      activeFile.endsWith(".css") ||
      activeFile.endsWith(".svg")

    const workspaceHasHtml = Array.from(yfiles.keys()).some(
      (f) => f.endsWith(".html") || f.endsWith(".htm")
    )

    return (
      hasWebExt ||
      (webLangs.includes(language.toLowerCase()) && workspaceHasHtml) ||
      previewOpen
    )
  }, [activeFile, language, yfiles, previewOpen])

  /*
   * Synchronize files map from Yjs.
   */
  useEffect(() => {
    const handleFilesChange = () => {
      const keys = Array.from(yfiles.keys())
      if (keys.length > 0) {
        setFileList(keys)
        if (!yfiles.has(activeFileRef.current)) {
          const next = keys[0]
          setActiveFile(next)
          setOpenTabs((prev) => {
            const filtered = prev.filter((f) => yfiles.has(f))
            return filtered.length > 0 ? filtered : [next]
          })
        }
      }
    }

    yfiles.observe(handleFilesChange)
    handleFilesChange()

    return () => {
      yfiles.unobserve(handleFilesChange)
    }
  }, [yfiles])

  /*
   * Bind Monaco Editor to the active file's Yjs text.
   */
  const bindEditorToFile = useCallback((fileName) => {
    if (!editorRef.current || !monacoRef.current || !fileName) return
    const editor = editorRef.current
    const monaco = monacoRef.current

    if (monacoBindingRef.current) {
      monacoBindingRef.current.destroy()
      monacoBindingRef.current = null
    }

    const fileYText = ydoc.getText("file:" + fileName)
    const fileLang = getLanguageFromFileName(fileName)

    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, fileLang)
      monacoBindingRef.current = new MonacoBinding(
        fileYText,
        model,
        new Set([editor])
      )
    }

    setLanguage(fileLang)
    setTimeout(() => {
      validateCodeRef.current?.()
    }, 100)
  }, [ydoc])

  useEffect(() => {
    if (editorRef.current && monacoRef.current && activeFile) {
      bindEditorToFile(activeFile)
    }
  }, [activeFile, bindEditorToFile])

  /*
   * Initialize workspace files upon document sync.
   */
  useEffect(() => {
    if (!documentReady) return

    if (yfiles.size === 0) {
      const defaultName = getFileNameForLanguage(language)
      const starter = LANGUAGE_STARTERS[language] || ""
      ydoc.transact(() => {
        if (!yfiles.has(defaultName)) {
          yfiles.set(defaultName, { name: defaultName, language })
        }
        const fileText = ydoc.getText("file:" + defaultName)
        if (fileText.length === 0 && starter) {
          fileText.insert(0, starter)
        }
      })
      setActiveFile(defaultName)
      setOpenTabs([defaultName])
      setFileList([defaultName])
    }
  }, [documentReady, yfiles, language, ydoc])

  /*
   * Creates the WebSocket provider when the user joins.
   */
  useEffect(() => {
    if (!joined) {
      return
    }

    const provider = new SpringWebSocketProvider(
      room,
      ydoc,
      username,
      setUsers,

      // Remote cursor
      (cursor) => {
        if (cursor.clientId === provider.clientId) {
          return
        }

        const editor = editorRef.current
        if (!editor) return

        const model = editor.getModel()
        if (!model) return

        const lineNumber = Math.max(
          1,
          Math.min(cursor.lineNumber, model.getLineCount())
        )
        const maxColumn = model.getLineMaxColumn(lineNumber)
        const column = Math.max(1, Math.min(cursor.column, maxColumn))

        // Follow Mode: Auto-scroll viewport to keep followed user in center
        if (followingUserRef.current && cursor.username === followingUserRef.current) {
          editor.revealLineInCenter(lineNumber)
        }

        const oldDecoration = remoteCursorsRef.current.get(cursor.clientId)
        const decorations = editor.deltaDecorations(
          oldDecoration ? [oldDecoration] : [],
          [
            {
              range: {
                startLineNumber: lineNumber,
                startColumn: column,
                endLineNumber: lineNumber,
                endColumn: column
              },
              options: {
                beforeContentClassName: "remote-cursor"
              }
            }
          ]
        )

        remoteCursorsRef.current.set(cursor.clientId, decorations[0])

        let widget = remoteCursorWidgetsRef.current.get(cursor.clientId)
        if (!widget) {
          widget = {
            id: `remote-cursor-${cursor.clientId}`,
            position: { lineNumber, column },
            username: cursor.username,
            domNode: null,
            getId() { return this.id },
            getDomNode() {
              if (!this.domNode) {
                const node = document.createElement("div")
                node.className = "remote-cursor-label"
                node.style.backgroundColor = getUserColor(this.username)
                node.textContent = this.username
                this.domNode = node
              }
              return this.domNode
            },
            getPosition() {
              return {
                position: this.position,
                preference: [1, 2]
              }
            }
          }
          remoteCursorWidgetsRef.current.set(cursor.clientId, widget)
          editor.addContentWidget(widget)
        } else {
          widget.position = { lineNumber, column }
          widget.username = cursor.username
          if (widget.domNode) {
            widget.domNode.textContent = cursor.username
            widget.domNode.style.backgroundColor = getUserColor(cursor.username)
          }
          editor.layoutContentWidget(widget)
        }
      },

      // Remote user disconnected
      (clientId) => {
        const editor = editorRef.current
        if (!editor) return

        const decoration = remoteCursorsRef.current.get(clientId)
        if (decoration) {
          editor.deltaDecorations([decoration], [])
          remoteCursorsRef.current.delete(clientId)
        }

        const widget = remoteCursorWidgetsRef.current.get(clientId)
        if (widget) {
          editor.removeContentWidget(widget)
          remoteCursorWidgetsRef.current.delete(clientId)
        }

        const selection = remoteSelectionsRef.current.get(clientId)
        if (selection) {
          editor.deltaDecorations([selection], [])
          remoteSelectionsRef.current.delete(clientId)
        }
      },

      // Remote selection
      (selection) => {
        if (selection.clientId === provider.clientId) return
        const editor = editorRef.current
        if (!editor) return

        const model = editor.getModel()
        if (!model) return

        const clientId = selection.clientId
        const remoteSelection = selection.selection

        const oldDecoration = remoteSelectionsRef.current.get(clientId)
        if (oldDecoration) {
          editor.deltaDecorations([oldDecoration], [])
          remoteSelectionsRef.current.delete(clientId)
        }

        if (!remoteSelection) return

        const startLineNumber = Math.max(
          1,
          Math.min(remoteSelection.startLineNumber, model.getLineCount())
        )
        const endLineNumber = Math.max(
          startLineNumber,
          Math.min(remoteSelection.endLineNumber, model.getLineCount())
        )
        const startColumn = Math.max(
          1,
          Math.min(remoteSelection.startColumn, model.getLineMaxColumn(startLineNumber))
        )
        const endColumn = Math.max(
          1,
          Math.min(remoteSelection.endColumn, model.getLineMaxColumn(endLineNumber))
        )

        const decorations = editor.deltaDecorations(
          [],
          [
            {
              range: {
                startLineNumber,
                startColumn,
                endLineNumber,
                endColumn
              },
              options: {
                className: "remote-selection"
              }
            }
          ]
        )
        remoteSelectionsRef.current.set(clientId, decorations[0])
      },

      // Connection state
      (state) => {
        setConnectionState(state)
      },

      // Document synchronization completed
      () => {
        setDocumentReady(true)
      },
      new URLSearchParams(window.location.search).get("role") || "editor"
    )

    providerRef.current = provider

    return () => {
      provider.disconnect()
      providerRef.current = null

      const editor = editorRef.current
      if (editor) {
        const decorations = [...remoteCursorsRef.current.values()]
        editor.deltaDecorations(decorations, [])

        for (const widget of remoteCursorWidgetsRef.current.values()) {
          editor.removeContentWidget(widget)
        }

        const selectionDecorations = [...remoteSelectionsRef.current.values()]
        editor.deltaDecorations(selectionDecorations, [])
      }

      remoteCursorsRef.current.clear()
      remoteCursorWidgetsRef.current.clear()
      remoteSelectionsRef.current.clear()
    }
  }, [joined, username, room, ydoc])

  /*
   * Shared language metadata.
   */
  useEffect(() => {
    const handleLanguageChange = () => {
      const sharedLanguage = ymetadata.get("language")
      if (typeof sharedLanguage === "string") {
        setLanguage(sharedLanguage)
      }
    }

    if (!ymetadata.has("language")) {
      ymetadata.set("language", "javascript")
    }

    handleLanguageChange()
    ymetadata.observe(handleLanguageChange)

    return () => {
      ymetadata.unobserve(handleLanguageChange)
    }
  }, [ymetadata])

  /*
   * Connection timeout.
   */
  useEffect(() => {
    if (!joined) {
      setConnectionTimedOut(false)
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
      return
    }

    setConnectionTimedOut(false)
    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionTimedOut(true)
      connectionTimeoutRef.current = null
    }, 15000)

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
        connectionTimeoutRef.current = null
      }
    }
  }, [joined])

  /*
   * Stop timeout once connected.
   */
  useEffect(() => {
    if (connectionState !== "CONNECTED") return
    setConnectionTimedOut(false)
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
      connectionTimeoutRef.current = null
    }
  }, [connectionState])

  /*
   * Xterm terminal initialization.
   */
  useEffect(() => {
    if (!terminalOpen || !terminalContainerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "Consolas, 'Courier New', monospace",
      convertEol: true,
      theme: {
        background: "#090d13",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#090d13",
        selectionBackground: "#1f6feb40"
      },
      scrollback: 5000,
      allowTransparency: false
    })

    terminal.open(terminalContainerRef.current)
    terminalRef.current = terminal

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const clientId = providerRef.current?.clientId || ""
    const urlRole = new URLSearchParams(window.location.search).get("role") || myRole || "editor"
    const socket = new WebSocket(
      `${protocol}//${window.location.hostname}:8080/ws/terminal?room=${encodeURIComponent(
        room
      )}&username=${encodeURIComponent(
        username
      )}&clientId=${encodeURIComponent(clientId)}&role=${encodeURIComponent(urlRole)}`
    )

    socket.binaryType = "arraybuffer"
    terminalSocketRef.current = socket

    socket.onopen = () => {
      console.log("Terminal WebSocket connected")
    }

    socket.onmessage = (event) => {
      let text = ""
      if (typeof event.data === "string") {
        text = event.data
      } else if (event.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(new Uint8Array(event.data))
      }

      terminal.write(text)
      setOutputLogs((prev) => prev + text)

      if (
        text.includes("Execution Finished") ||
        text.includes("exited with code") ||
        text.includes("timed out") ||
        text.includes("$ ")
      ) {
        setIsRunning(false)
      }

      // Merge runtime error markers
      const runtimeMarkers = parseCompilerOutput(text, language)
      if (runtimeMarkers.length > 0 && editorRef.current && monacoRef.current) {
        const model = editorRef.current.getModel()
        if (model) {
          const currentMarkers = monacoRef.current.editor
            .getModelMarkers({ resource: model.uri })
            .filter((m) => m.owner === "syncstream-diagnostics")
          const combined = [...currentMarkers, ...runtimeMarkers]
          monacoRef.current.editor.setModelMarkers(model, "syncstream-diagnostics", combined)
          setDiagnostics(combined)
        }
      }
    }

    socket.onerror = (error) => {
      console.error("Terminal WebSocket error", error)
      terminal.write("\r\n[Terminal connection error]\r\n")
      setIsRunning(false)
    }

    socket.onclose = () => {
      terminal.write("\r\n[Terminal disconnected]\r\n")
      setIsRunning(false)
    }

    let command = ""
    const cmdHistory = []
    let historyIndex = -1
    let savedCommand = ""

    const rewriteLine = (text) => {
      terminal.write("\r\u001B[K$ " + text)
    }

    const dataDisposable = terminal.onData((data) => {
      // Enter — submit command or interactive stdin input
      if (data === "\r" || data === "\n") {
        terminal.write("\r\n")

        if (isRunningRef.current) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(command)
          }
          command = ""
          return
        }

        const trimmed = command.trim()
        if (trimmed) {
          if (cmdHistory[cmdHistory.length - 1] !== trimmed) {
            cmdHistory.push(trimmed)
            if (cmdHistory.length > 100) cmdHistory.shift()
          }
          historyIndex = -1
          savedCommand = ""

          if (socket.readyState === WebSocket.OPEN) {
            socket.send(command)
          }
        } else {
          terminal.write("$ ")
        }

        command = ""
        return
      }

      // Backspace (DEL)
      if (data === "\u007F") {
        if (command.length > 0) {
          command = command.slice(0, -1)
          terminal.write("\b \b")
        }
        return
      }

      // Ctrl+C — interrupt
      if (data === "\u0003") {
        command = ""
        historyIndex = -1
        if (socket.readyState === WebSocket.OPEN) {
          socket.send("\u0003")
        }
        terminal.write("^C\r\n")
        setIsRunning(false)
        return
      }

      // Ctrl+L — clear screen
      if (data === "\u000C") {
        terminal.write("\u001B[2J\u001B[H$ " + command)
        return
      }

      // Arrow Up — history previous
      if (data === "\u001B[A") {
        if (cmdHistory.length === 0) return
        if (historyIndex === -1) {
          savedCommand = command
          historyIndex = cmdHistory.length - 1
        } else if (historyIndex > 0) {
          historyIndex--
        }
        command = cmdHistory[historyIndex]
        rewriteLine(command)
        return
      }

      // Arrow Down — history next
      if (data === "\u001B[B") {
        if (historyIndex === -1) return
        if (historyIndex < cmdHistory.length - 1) {
          historyIndex++
          command = cmdHistory[historyIndex]
        } else {
          historyIndex = -1
          command = savedCommand
        }
        rewriteLine(command)
        return
      }

      if (data === "\u001B[C" || data === "\u001B[D") {
        return
      }

      // Printable characters
      if (data >= " " && data <= "~") {
        command += data
        terminal.write(data)
      }
    })

    const resizeTerminal = () => {
      const container = terminalContainerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const cellWidth = 8.0
      const cellHeight = 16.5
      const cols = Math.max(2, Math.floor(rect.width / cellWidth))
      const rows = Math.max(1, Math.floor(rect.height / cellHeight))

      terminal.resize(cols, rows)
    }

    terminalResizeObserverRef.current = new ResizeObserver(resizeTerminal)
    terminalResizeObserverRef.current.observe(terminalContainerRef.current)
    requestAnimationFrame(resizeTerminal)

    return () => {
      dataDisposable.dispose()
      if (terminalResizeObserverRef.current) {
        terminalResizeObserverRef.current.disconnect()
        terminalResizeObserverRef.current = null
      }
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        socket.close()
      }
      terminalSocketRef.current = null
      terminal.dispose()
      terminalRef.current = null
    }
  }, [terminalOpen, room, username, language])

  /*
   * Focus terminal when opened.
   */
  useEffect(() => {
    if (terminalOpen && activeBottomTab === "terminal" && terminalRef.current) {
      requestAnimationFrame(() => {
        terminalRef.current?.focus()
      })
    }
  }, [terminalOpen, activeBottomTab])

  /*
   * Keep terminal sized correctly.
   */
  useEffect(() => {
    if (!terminalOpen || !terminalRef.current) return
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"))
    }, 0)
    return () => clearTimeout(timer)
  }, [terminalHeight, terminalMaximized, activeBottomTab])

  /*
   * Execute multi-file project in runner.
   */
  const handleRunCode = useCallback(() => {
    if (!editorRef.current) return

    const filesPayload = {}
    for (const fname of yfiles.keys()) {
      filesPayload[fname] = ydoc.getText("file:" + fname).toString()
    }

    filesPayload[activeFile] = editorRef.current.getValue()

    if (Object.values(filesPayload).every((c) => !c.trim())) {
      return
    }

    if (!terminalOpen) {
      setTerminalOpen(true)
    }
    setActiveBottomTab("terminal")
    setIsRunning(true)

    const payload = JSON.stringify({
      type: "run_project",
      activeFile,
      language: getLanguageFromFileName(activeFile),
      files: filesPayload
    })

    const sendCmd = () => {
      if (
        terminalSocketRef.current &&
        terminalSocketRef.current.readyState === WebSocket.OPEN
      ) {
        terminalSocketRef.current.send(payload)
      }
    }

    if (
      terminalSocketRef.current &&
      terminalSocketRef.current.readyState === WebSocket.OPEN
    ) {
      sendCmd()
    } else {
      setTimeout(sendCmd, 500)
    }
  }, [editorRef, terminalOpen, activeFile, yfiles, ydoc])

  /*
   * Format document with multi-language formatter.
   */
  const handleFormatCode = useCallback(() => {
    if (!editorRef.current || !activeFile) return
    const model = editorRef.current.getModel()
    if (!model) return

    const currentCode = model.getValue()
    const currentLang = getLanguageFromFileName(activeFile)
    const formatted = formatDocument(currentCode, currentLang, { tabSize })

    if (formatted && formatted !== currentCode) {
      const activeYText = ydoc.getText("file:" + activeFile)
      ydoc.transact(() => {
        activeYText.delete(0, activeYText.length)
        activeYText.insert(0, formatted)
      })
    }
  }, [activeFile, tabSize, ydoc])

  const handleToggleWordWrap = useCallback(() => {
    setWordWrap((prev) => (prev === "on" ? "off" : "on"))
  }, [])

  /*
   * Command Palette Available Actions & Shortcuts
   */
  const commandsList = useMemo(() => [
    {
      id: "run",
      label: "Run: Run Project",
      icon: "▶",
      shortcut: "Ctrl+Enter",
      action: () => handleRunCode()
    },
    {
      id: "format",
      label: "Format: Format Document",
      icon: "📄",
      shortcut: "Shift+Alt+F",
      action: () => handleFormatCode()
    },
    {
      id: "quickOpen",
      label: "File: Quick Open File...",
      icon: "🔍",
      shortcut: "Ctrl+P",
      action: () => {
        setPaletteMode("quickOpen")
        setPaletteQuery("")
        setPaletteSelectedIndex(0)
      }
    },
    {
      id: "newFile",
      label: "File: New File",
      icon: "➕",
      action: () => {
        setSidebarOpen(true)
        setActiveActivityTab("explorer")
        setIsCreatingNode({ type: "file", parentPath: "" })
      }
    },
    {
      id: "newFolder",
      label: "File: New Folder",
      icon: "📁",
      action: () => {
        setSidebarOpen(true)
        setActiveActivityTab("explorer")
        setIsCreatingNode({ type: "folder", parentPath: "" })
      }
    },
    {
      id: "saveZip",
      label: "Project: Export Project (ZIP)",
      icon: "📦",
      action: () => handleExportZip()
    },
    {
      id: "importZip",
      label: "Project: Import Project (ZIP)",
      icon: "📥",
      action: () => importFileInputRef.current?.click()
    },
    {
      id: "toggleWrap",
      label: `View: Toggle Word Wrap (${wordWrap.toUpperCase()})`,
      icon: "↩",
      shortcut: "Alt+Z",
      action: () => handleToggleWordWrap()
    },
    {
      id: "toggleTerminal",
      label: "View: Toggle Integrated Terminal",
      icon: "💻",
      shortcut: "Ctrl+`",
      action: () => setTerminalOpen((t) => !t)
    },
    {
      id: "togglePreview",
      label: "View: Toggle Live Web Preview",
      icon: "🌐",
      action: () => setPreviewOpen((p) => !p)
    },
    {
      id: "toggleMinimap",
      label: `View: Toggle Editor Minimap (${editorMinimap ? "ON" : "OFF"})`,
      icon: "🗺️",
      action: () => setEditorMinimap((m) => !m)
    },
    {
      id: "themeDark",
      label: "Preferences: Color Theme - VS Code Dark",
      icon: "🎨",
      action: () => setEditorTheme("vs-dark")
    },
    {
      id: "themeLight",
      label: "Preferences: Color Theme - VS Code Light",
      icon: "🎨",
      action: () => setEditorTheme("light")
    },
    {
      id: "themeHC",
      label: "Preferences: Color Theme - High Contrast",
      icon: "🎨",
      action: () => setEditorTheme("hc-black")
    },
    {
      id: "settings",
      label: "Preferences: Open Editor Settings",
      icon: "⚙️",
      action: () => setSettingsModalOpen(true)
    },
    {
      id: "shortcuts",
      label: "Help: Keyboard Shortcuts Reference",
      icon: "⌨️",
      shortcut: "Ctrl+/",
      action: () => setShortcutsModalOpen(true)
    },
    {
      id: "toggleMarkdown",
      label: "View: Toggle Markdown Live Preview",
      icon: "👁️",
      action: () => setMarkdownPreviewOpen((p) => !p)
    },
    {
      id: "share",
      label: "Room: Share Invite Link",
      icon: "🔗",
      action: () => handleShareRoom()
    },
    {
      id: "leave",
      label: "Room: Leave Room",
      icon: "🚪",
      action: () => handleLeaveRoom()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [wordWrap, editorMinimap, handleRunCode, handleFormatCode, handleToggleWordWrap])

  const filteredPaletteItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase()
    if (paletteMode === "quickOpen") {
      const allFiles = Array.from(yfiles.keys()).filter(
        (f) => !f.endsWith(".keep") || yfiles.size === 1
      )
      if (!q) return allFiles.map((f) => ({ id: f, label: f, type: "file" }))
      return allFiles
        .filter((f) => f.toLowerCase().includes(q))
        .map((f) => ({ id: f, label: f, type: "file" }))
    }

    if (paletteMode === "commandPalette") {
      if (!q) return commandsList
      return commandsList.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      )
    }

    return []
  }, [paletteMode, paletteQuery, yfiles, commandsList])

  const handleExecutePaletteItem = useCallback((item) => {
    if (!item) return
    if (paletteMode === "quickOpen") {
      handleSelectFile(item.id)
    } else if (paletteMode === "commandPalette" && item.action) {
      item.action()
    }
    setPaletteMode(null)
    setPaletteQuery("")
    setPaletteSelectedIndex(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteMode])

  const handlePaletteKeyDown = useCallback((e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setPaletteSelectedIndex((prev) =>
        prev < filteredPaletteItems.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setPaletteSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, filteredPaletteItems.length - 1)
      )
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (filteredPaletteItems[paletteSelectedIndex]) {
        handleExecutePaletteItem(filteredPaletteItems[paletteSelectedIndex])
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setPaletteMode(null)
      setPaletteQuery("")
    }
  }, [filteredPaletteItems, paletteSelectedIndex, handleExecutePaletteItem])

  /*
   * Global Keyboard shortcuts:
   * - Ctrl+P (Quick Open)
   * - Ctrl+Shift+P / F1 (Command Palette)
   * - Ctrl+/ (Keyboard Shortcuts Cheat-Sheet)
   * - Escape (Close Palettes / Modals)
   * - Ctrl+` (Toggle Terminal)
   * - Ctrl+Enter / F5 (Run)
   * - Shift+Alt+F (Format Document)
   * - Alt+Z (Toggle Word Wrap)
   * - Ctrl+B (Toggle Sidebar)
   * - Ctrl+Shift+F (Global Search)
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Escape closes modals and menus
      if (event.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null)
          return
        }
        if (paletteMode) {
          setPaletteMode(null)
          setPaletteQuery("")
          return
        }
        if (diffModalFile) {
          setDiffModalFile(null)
          return
        }
        if (settingsModalOpen) {
          setSettingsModalOpen(false)
          return
        }
        if (shortcutsModalOpen) {
          setShortcutsModalOpen(false)
          return
        }
        if (shareModalOpen) {
          setShareModalOpen(false)
          return
        }
      }

      // Ctrl+/ : Toggle Keyboard Shortcuts Cheat-Sheet
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault()
        setShortcutsModalOpen((prev) => !prev)
        return
      }

      // Ctrl+Shift+P or F1: Command Palette
      if (((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "P" || event.key === "p")) || event.key === "F1") {
        event.preventDefault()
        setPaletteMode("commandPalette")
        setPaletteQuery("")
        setPaletteSelectedIndex(0)
        return
      }

      // Ctrl+P: Quick Open File
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === "P" || event.key === "p")) {
        event.preventDefault()
        setPaletteMode("quickOpen")
        setPaletteQuery("")
        setPaletteSelectedIndex(0)
        return
      }

      // Global Search
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === "F" || event.key === "f")) {
        event.preventDefault()
        setActiveActivityTab("search")
        setSidebarOpen(true)
        setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 50)
      } else if (event.shiftKey && event.altKey && (event.key === "F" || event.key === "f")) {
        event.preventDefault()
        handleFormatCode()
      } else if (event.altKey && (event.key === "z" || event.key === "Z")) {
        event.preventDefault()
        handleToggleWordWrap()
      } else if ((event.ctrlKey || event.metaKey) && (event.key === "b" || event.key === "B")) {
        event.preventDefault()
        setSidebarOpen((s) => !s)
      } else if (event.ctrlKey && event.key === "`") {
        event.preventDefault()
        setTerminalOpen((current) => !current)
      } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault()
        handleRunCode()
      } else if (event.key === "F5") {
        event.preventDefault()
        handleRunCode()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    paletteMode,
    diffModalFile,
    settingsModalOpen,
    shortcutsModalOpen,
    shareModalOpen,
    contextMenu,
    handleRunCode,
    handleFormatCode,
    handleToggleWordWrap
  ])

  /*
   * Draggable sidebar & terminal resizers.
   */
  const handleStartSidebarResize = useCallback((e) => {
    e.preventDefault()
    setIsResizingSidebar(true)
    document.body.style.cursor = "ew-resize"
    document.body.style.userSelect = "none"

    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.max(180, Math.min(600, startWidth + delta))
      setSidebarWidth(nextWidth)
    }

    const onMouseUp = () => {
      setIsResizingSidebar(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }, [sidebarWidth])

  const handleStartTerminalResize = useCallback((e) => {
    e.preventDefault()
    setIsResizingTerminal(true)
    document.body.style.cursor = "ns-resize"
    document.body.style.userSelect = "none"

    const startY = e.clientY
    const startHeight = terminalHeight

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY
      const maxHeight = Math.floor(window.innerHeight * 0.75)
      const nextHeight = Math.max(140, Math.min(maxHeight, startHeight + delta))
      setTerminalHeight(nextHeight)
    }

    const onMouseUp = () => {
      setIsResizingTerminal(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }, [terminalHeight])

  /*
   * Monaco editor setup.
   */
  const handleMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    bindEditorToFile(activeFileRef.current)

    // Register Multi-Language Code Completion Providers (Python, Java, C++, Go, Rust, C#, etc.)
    registerCompletionProviders(monaco)

    // Register Document Formatting Edit Providers
    const supportedLangs = [
      "javascript", "typescript", "html", "css", "json", "python",
      "java", "cpp", "c", "csharp", "go", "rust", "php", "sql"
    ]
    supportedLangs.forEach((l) => {
      try {
        monaco.languages.registerDocumentFormattingEditProvider(l, {
          provideDocumentFormattingEdits(model) {
            const currentCode = model.getValue()
            const formatted = formatDocument(currentCode, l, { tabSize })
            return [
              {
                range: model.getFullModelRange(),
                text: formatted
              }
            ]
          }
        })
      } catch (err) {
        // Provider already registered
      }
    })

    editor.addAction({
      id: "syncstream-format-document",
      label: "Format Document",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KEY_F
      ],
      run: () => {
        handleFormatCode()
      }
    })

    editor.onDidChangeCursorPosition((event) => {
      const position = event.position
      setCursorPos({
        lineNumber: position.lineNumber,
        column: position.column
      })

      providerRef.current?.sendCursorPosition(
        position.lineNumber,
        position.column
      )
    })

    editor.onDidChangeCursorSelection((event) => {
      const selection = event.selection
      const hasSelection =
        selection.startLineNumber !== selection.endLineNumber ||
        selection.startColumn !== selection.endColumn

      providerRef.current?.sendSelection(
        hasSelection
          ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn
            }
          : null
      )
    })

    editor.onDidChangeModelContent(() => {
      setContentRevision((r) => r + 1)
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
      validationTimerRef.current = setTimeout(() => {
        validateCodeRef.current?.()
      }, 200)

      if (previewOpen) {
        if (previewTimerRef.current) {
          clearTimeout(previewTimerRef.current)
        }
        previewTimerRef.current = setTimeout(updatePreview, 300)
      }
    })
  }

  const handleProblemClick = (problem) => {
    if (!editorRef.current) return
    editorRef.current.revealLineInCenter(problem.startLineNumber)
    editorRef.current.setPosition({
      lineNumber: problem.startLineNumber,
      column: problem.startColumn
    })
    editorRef.current.focus()
  }

  const handleInsertTemplate = () => {
    const currentLang = getLanguageFromFileName(activeFile)
    const starter = LANGUAGE_STARTERS[currentLang]
    if (!starter || !editorRef.current) return

    const activeYText = ydoc.getText("file:" + activeFile)
    ydoc.transact(() => {
      activeYText.delete(0, activeYText.length)
      activeYText.insert(0, starter)
    })
  }

  // Export Project as ZIP
  const handleExportZip = async () => {
    try {
      const zip = new JSZip()
      for (const fname of yfiles.keys()) {
        if (fname.endsWith(".keep") && yfiles.size > 1) continue
        const content = ydoc.getText("file:" + fname).toString()
        zip.file(fname, content)
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${room || "syncstream"}-project.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to export ZIP", err)
      alert("Failed to export project: " + err.message)
    }
  }

  // Import ZIP Archive
  const handleImportZipFile = async (file) => {
    try {
      const zip = new JSZip()
      const loadedZip = await zip.loadAsync(file)
      const newFiles = {}
      const foldersToExpand = new Set()

      for (const [relativePath, zipEntry] of Object.entries(loadedZip.files)) {
        if (zipEntry.dir) continue
        if (
          relativePath.includes("__MACOSX") ||
          relativePath.includes(".DS_Store") ||
          relativePath.includes("node_modules/") ||
          relativePath.includes(".git/")
        ) {
          continue
        }

        const text = await zipEntry.async("string")
        newFiles[relativePath] = text

        const parts = relativePath.split("/")
        if (parts.length > 1) {
          for (let i = 1; i < parts.length; i++) {
            foldersToExpand.add(parts.slice(0, i).join("/"))
          }
        }
      }

      if (Object.keys(newFiles).length === 0) {
        alert("No readable text files found in the archive.")
        return
      }

      ydoc.transact(() => {
        for (const [path, content] of Object.entries(newFiles)) {
          const fileLang = getLanguageFromFileName(path)
          yfiles.set(path, { name: path, language: fileLang })
          const ytext = ydoc.getText("file:" + path)
          ytext.delete(0, ytext.length)
          ytext.insert(0, content)
        }
      })

      setExpandedFolders((prev) => new Set([...prev, ...foldersToExpand]))
      const firstFile = Object.keys(newFiles)[0]
      if (firstFile) {
        setOpenTabs((prev) => (prev.includes(firstFile) ? prev : [...prev, firstFile]))
        setActiveFile(firstFile)
      }
    } catch (err) {
      console.error("Failed to import ZIP", err)
      alert("Failed to import project archive: " + err.message)
    }
  }

  // Drag and Drop File / Folder Handler
  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDraggingOver(false)
    const items = e.dataTransfer.items
    const files = e.dataTransfer.files

    if (!items && !files) return

    if (files && files.length === 1 && files[0].name.endsWith(".zip")) {
      handleImportZipFile(files[0])
      return
    }

    const imported = {}
    const foldersToExpand = new Set()

    const readEntry = async (entry, currentPath = "") => {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve))
        if (
          file.size < 1024 * 1024 &&
          !file.name.includes(".DS_Store") &&
          !file.name.endsWith(".lock")
        ) {
          const text = await file.text()
          const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name
          imported[fullPath] = text
          if (currentPath) {
            foldersToExpand.add(currentPath)
          }
        }
      } else if (entry.isDirectory) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist"
        ) {
          return
        }
        const dirReader = entry.createReader()
        const entries = await new Promise((resolve) => dirReader.readEntries(resolve))
        const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
        foldersToExpand.add(nextPath)
        for (const child of entries) {
          await readEntry(child, nextPath)
        }
      }
    }

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.()
        if (entry) {
          await readEntry(entry)
        }
      }
    }

    if (Object.keys(imported).length > 0) {
      ydoc.transact(() => {
        for (const [path, content] of Object.entries(imported)) {
          const fileLang = getLanguageFromFileName(path)
          yfiles.set(path, { name: path, language: fileLang })
          const ytext = ydoc.getText("file:" + path)
          ytext.delete(0, ytext.length)
          ytext.insert(0, content)
        }
      })
      setExpandedFolders((prev) => new Set([...prev, ...foldersToExpand]))
      const first = Object.keys(imported)[0]
      if (first) {
        setOpenTabs((prev) => (prev.includes(first) ? prev : [...prev, first]))
        setActiveFile(first)
      }
    }
  }

  // File and Folder Operations
  const handleCreateNode = (pathInput, isFolder = false) => {
    const trimmed = pathInput.trim()
    if (!trimmed) {
      setIsCreatingNode(null)
      setNewPathInput("")
      return
    }

    const cleanPath = trimmed.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
    if (!cleanPath) {
      setIsCreatingNode(null)
      setNewPathInput("")
      return
    }

    if (isFolder) {
      const keepFile = `${cleanPath}/.keep`
      ydoc.transact(() => {
        yfiles.set(keepFile, { name: keepFile, language: "plaintext" })
      })
      setExpandedFolders((prev) => new Set([...prev, cleanPath]))
    } else {
      const fileLang = getLanguageFromFileName(cleanPath)
      const starter = LANGUAGE_STARTERS[fileLang] || ""

      ydoc.transact(() => {
        yfiles.set(cleanPath, { name: cleanPath, language: fileLang })
        const fileText = ydoc.getText("file:" + cleanPath)
        if (starter && fileText.length === 0) {
          fileText.insert(0, starter)
        }
      })

      const parts = cleanPath.split("/")
      if (parts.length > 1) {
        const parents = []
        for (let i = 1; i < parts.length; i++) {
          parents.push(parts.slice(0, i).join("/"))
        }
        setExpandedFolders((prev) => new Set([...prev, ...parents]))
      }

      setOpenTabs((prev) => (prev.includes(cleanPath) ? prev : [...prev, cleanPath]))
      setActiveFile(cleanPath)
    }

    setIsCreatingNode(null)
    setNewPathInput("")
  }

  const handleDeleteFile = (filePath, event) => {
    event?.stopPropagation()
    const keys = Array.from(yfiles.keys())
    if (keys.length <= 1) {
      alert("Cannot delete the only file in the workspace.")
      return
    }

    if (!confirm(`Delete ${filePath}?`)) {
      return
    }

    ydoc.transact(() => {
      yfiles.delete(filePath)
    })

    setOpenTabs((prev) => prev.filter((f) => f !== filePath))

    if (activeFile === filePath) {
      const remaining = keys.filter((f) => f !== filePath && !f.endsWith(".keep"))
      if (remaining.length > 0) {
        setActiveFile(remaining[0])
      }
    }
  }

  const handleDeleteFolder = (folderPath, event) => {
    event?.stopPropagation()
    if (!confirm(`Delete folder '${folderPath}' and all its files?`)) {
      return
    }

    const filesToDelete = Array.from(yfiles.keys()).filter(
      (f) => f === folderPath || f.startsWith(folderPath + "/")
    )

    ydoc.transact(() => {
      filesToDelete.forEach((f) => yfiles.delete(f))
    })

    setOpenTabs((prev) => prev.filter((f) => !filesToDelete.includes(f)))

    if (filesToDelete.includes(activeFile)) {
      const remaining = Array.from(yfiles.keys()).filter(
        (f) => !filesToDelete.includes(f) && !f.endsWith(".keep")
      )
      if (remaining.length > 0) {
        setActiveFile(remaining[0])
      }
    }
  }

  const handleSelectFile = (filePath) => {
    if (filePath.endsWith(".keep")) return
    setOpenTabs((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]))
    setActiveFile(filePath)
  }

  const handleCloseTab = (fileName, event) => {
    event?.stopPropagation()
    const newTabs = openTabs.filter((f) => f !== fileName)
    setOpenTabs(newTabs)
    if (activeFile === fileName) {
      if (newTabs.length > 0) {
        setActiveFile(newTabs[newTabs.length - 1])
      } else {
        setActiveFile("")
      }
    }
  }

  const handleCloseOtherTabs = (fileName) => {
    setOpenTabs([fileName])
    setActiveFile(fileName)
    setContextMenu(null)
  }

  const handleCloseTabsToRight = (fileName) => {
    const idx = openTabs.indexOf(fileName)
    if (idx !== -1) {
      const remainingTabs = openTabs.slice(0, idx + 1)
      setOpenTabs(remainingTabs)
      if (!remainingTabs.includes(activeFile)) {
        setActiveFile(fileName)
      }
    }
    setContextMenu(null)
  }

  const handleCloseAllTabs = () => {
    setOpenTabs([])
    setActiveFile("")
    setContextMenu(null)
  }

  const handleDuplicateFile = (filePath) => {
    const content = ydoc.getText("file:" + filePath).toString()
    const lastDot = filePath.lastIndexOf(".")
    let newPath = ""
    if (lastDot !== -1) {
      newPath = `${filePath.substring(0, lastDot)}_copy${filePath.substring(lastDot)}`
    } else {
      newPath = `${filePath}_copy`
    }

    // Ensure unique name if _copy already exists
    let counter = 2
    while (yfiles.has(newPath)) {
      if (lastDot !== -1) {
        newPath = `${filePath.substring(0, lastDot)}_copy${counter}${filePath.substring(lastDot)}`
      } else {
        newPath = `${filePath}_copy${counter}`
      }
      counter++
    }

    const fileLang = getLanguageFromFileName(newPath)
    ydoc.transact(() => {
      yfiles.set(newPath, { name: newPath, language: fileLang })
      const newYText = ydoc.getText("file:" + newPath)
      newYText.insert(0, content)
    })

    setOpenTabs((prev) => (prev.includes(newPath) ? prev : [...prev, newPath]))
    setActiveFile(newPath)
    setContextMenu(null)
  }

  const handleDownloadFile = (filePath) => {
    try {
      const content = ydoc.getText("file:" + filePath).toString()
      const fileName = filePath.split("/").pop() || "file.txt"
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Failed to download file", err)
    }
    setContextMenu(null)
  }

  const handleCopyPath = (filePath) => {
    navigator.clipboard.writeText(filePath)
    setContextMenu(null)
  }

  const handleRenameNode = (oldPath, newName, isDirectory = false) => {
    const trimmed = newName.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
    const oldName = oldPath.split("/").pop()
    if (!trimmed || trimmed === oldName) {
      setRenamingNode(null)
      setRenameInput("")
      return
    }

    const parts = oldPath.split("/")
    parts.pop()
    const parentPath = parts.join("/")
    const newPath = parentPath ? `${parentPath}/${trimmed}` : trimmed

    if (isDirectory) {
      const allFiles = Array.from(yfiles.keys())
      const matching = allFiles.filter(
        (f) => f === oldPath || f.startsWith(oldPath + "/")
      )

      ydoc.transact(() => {
        matching.forEach((oldFilePath) => {
          const suffix = oldFilePath.slice(oldPath.length)
          const targetFilePath = newPath + suffix
          const content = ydoc.getText("file:" + oldFilePath).toString()
          const lang = getLanguageFromFileName(targetFilePath)

          yfiles.delete(oldFilePath)
          yfiles.set(targetFilePath, { name: targetFilePath, language: lang })

          const newYText = ydoc.getText("file:" + targetFilePath)
          newYText.delete(0, newYText.length)
          newYText.insert(0, content)
        })
      })

      setOpenTabs((prev) =>
        prev.map((tab) => {
          if (tab.startsWith(oldPath + "/")) {
            return newPath + tab.slice(oldPath.length)
          }
          return tab
        })
      )

      if (activeFile.startsWith(oldPath + "/")) {
        setActiveFile(newPath + activeFile.slice(oldPath.length))
      }

      setExpandedFolders((prev) => {
        const next = new Set()
        prev.forEach((p) => {
          if (p === oldPath) {
            next.add(newPath)
          } else if (p.startsWith(oldPath + "/")) {
            next.add(newPath + p.slice(oldPath.length))
          } else {
            next.add(p)
          }
        })
        return next
      })
    } else {
      const oldYText = ydoc.getText("file:" + oldPath)
      const content = oldYText.toString()
      const newLang = getLanguageFromFileName(newPath)

      ydoc.transact(() => {
        yfiles.delete(oldPath)
        yfiles.set(newPath, { name: newPath, language: newLang })

        const newYText = ydoc.getText("file:" + newPath)
        newYText.delete(0, newYText.length)
        newYText.insert(0, content)
      })

      setOpenTabs((prev) =>
        prev.map((tab) => (tab === oldPath ? newPath : tab))
      )

      if (activeFile === oldPath) {
        setActiveFile(newPath)
      }
    }

    setRenamingNode(null)
    setRenameInput("")
  }

  const toggleFolder = (folderPath, event) => {
    event?.stopPropagation()
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }

  /*
   * ==========================================================================
   * Global Project Search & Replace Engine (Ctrl+Shift+F)
   * ==========================================================================
   */
  const performSearch = useCallback(() => {
    if (!searchQuery) {
      setSearchResults([])
      setSearchStatus("")
      return
    }

    try {
      const flags = searchMatchCase ? "g" : "gi"
      let pattern = searchQuery

      if (!searchUseRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      }
      if (searchWholeWord) {
        pattern = `\\b${pattern}\\b`
      }

      const fileKeys = Array.from(yfiles.keys())
      const results = []

      for (const fname of fileKeys) {
        if (fname.endsWith(".keep") && fileKeys.length > 1) continue

        // Check include / exclude filters
        if (searchIncludeFilter.trim()) {
          const incPatterns = searchIncludeFilter
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
          const matched = incPatterns.some((p) => {
            if (p.startsWith("*.")) return fname.toLowerCase().endsWith(p.slice(1))
            return fname.toLowerCase().includes(p)
          })
          if (!matched) continue
        }

        if (searchExcludeFilter.trim()) {
          const excPatterns = searchExcludeFilter
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
          const matched = excPatterns.some((p) => {
            if (p.startsWith("*.")) return fname.toLowerCase().endsWith(p.slice(1))
            return fname.toLowerCase().includes(p)
          })
          if (matched) continue
        }

        // Retrieve file content
        let content = ""
        if (editorRef.current && activeFile === fname) {
          content = editorRef.current.getValue()
        } else {
          content = ydoc.getText("file:" + fname).toString()
        }

        if (!content) continue

        const lines = content.split("\n")
        const fileMatches = []

        lines.forEach((lineText, lineIdx) => {
          const lineNumber = lineIdx + 1
          let match
          const lineRegex = new RegExp(pattern, flags)
          while ((match = lineRegex.exec(lineText)) !== null) {
            const startCol = match.index + 1
            const endCol = match.index + match[0].length + 1
            const previewBefore = lineText.substring(
              Math.max(0, match.index - 30),
              match.index
            )
            const matchText = match[0]
            const previewAfter = lineText.substring(
              match.index + match[0].length,
              match.index + match[0].length + 40
            )

            fileMatches.push({
              id: `${fname}-${lineNumber}-${startCol}-${match.index}`,
              lineNumber,
              startCol,
              endCol,
              lineText,
              previewBefore,
              matchText,
              previewAfter,
              indexInLine: match.index,
              length: match[0].length
            })

            if (match[0].length === 0) {
              lineRegex.lastIndex++
            }
          }
        })

        if (fileMatches.length > 0) {
          results.push({
            filePath: fname,
            matches: fileMatches
          })
        }
      }

      setSearchResults(results)
      const totalMatches = results.reduce((acc, r) => acc + r.matches.length, 0)
      setSearchStatus(
        `${totalMatches} result${totalMatches === 1 ? "" : "s"} in ${results.length} file${results.length === 1 ? "" : "s"}`
      )
    } catch (err) {
      setSearchResults([])
      setSearchStatus(`Invalid search expression: ${err.message}`)
    }
  }, [
    searchQuery,
    searchMatchCase,
    searchUseRegex,
    searchWholeWord,
    searchIncludeFilter,
    searchExcludeFilter,
    yfiles,
    ydoc,
    activeFile
  ])

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch()
    }, 120)
    return () => clearTimeout(timer)
  }, [performSearch])

  const handleSelectSearchMatch = (filePath, match) => {
    if (!openTabs.includes(filePath)) {
      setOpenTabs((prev) => [...prev, filePath])
    }
    setActiveFile(filePath)

    setTimeout(() => {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (editor && monaco) {
        editor.revealLineInCenter(match.lineNumber)
        editor.setSelection(
          new monaco.Selection(
            match.lineNumber,
            match.startCol,
            match.lineNumber,
            match.endCol
          )
        )
        editor.focus()
      }
    }, 80)
  }

  const handleReplaceSingleMatch = (filePath, match) => {
    const fileYText = ydoc.getText("file:" + filePath)
    const fullContent = fileYText.toString()
    const lines = fullContent.split("\n")
    let globalOffset = 0
    for (let i = 0; i < match.lineNumber - 1; i++) {
      globalOffset += lines[i].length + 1
    }
    globalOffset += match.indexInLine

    const currentSub = fullContent.substring(globalOffset, globalOffset + match.length)
    if (currentSub === match.matchText) {
      ydoc.transact(() => {
        fileYText.delete(globalOffset, match.length)
        fileYText.insert(globalOffset, replaceQuery)
      })
    }
    setTimeout(performSearch, 50)
  }

  const handleReplaceAllInFile = (filePath) => {
    const fileYText = ydoc.getText("file:" + filePath)
    const content = fileYText.toString()

    const flags = searchMatchCase ? "g" : "gi"
    let pattern = searchQuery
    if (!searchUseRegex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
    if (searchWholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    const regex = new RegExp(pattern, flags)
    const matches = []
    let m
    while ((m = regex.exec(content)) !== null) {
      matches.push({ index: m.index, length: m[0].length })
      if (m[0].length === 0) regex.lastIndex++
    }

    if (matches.length > 0) {
      ydoc.transact(() => {
        for (let i = matches.length - 1; i >= 0; i--) {
          fileYText.delete(matches[i].index, matches[i].length)
          fileYText.insert(matches[i].index, replaceQuery)
        }
      })
    }
    setTimeout(performSearch, 50)
  }

  const handleReplaceAll = () => {
    if (!searchQuery) return

    const flags = searchMatchCase ? "g" : "gi"
    let pattern = searchQuery
    if (!searchUseRegex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    }
    if (searchWholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    const fileKeys = Array.from(yfiles.keys())

    ydoc.transact(() => {
      for (const fname of fileKeys) {
        if (fname.endsWith(".keep") && fileKeys.length > 1) continue
        const fileYText = ydoc.getText("file:" + fname)
        const content = fileYText.toString()
        const matches = []
        let m
        const fileRegex = new RegExp(pattern, flags)
        while ((m = fileRegex.exec(content)) !== null) {
          matches.push({ index: m.index, length: m[0].length })
          if (m[0].length === 0) fileRegex.lastIndex++
        }
        if (matches.length > 0) {
          for (let i = matches.length - 1; i >= 0; i--) {
            fileYText.delete(matches[i].index, matches[i].length)
            fileYText.insert(matches[i].index, replaceQuery)
          }
        }
      }
    })
    setTimeout(performSearch, 50)
  }

  const handleJoin = async (event) => {
    event.preventDefault()
    setJoinError("")
    setJoinLoading(true)

    const form = event.currentTarget
    const name = form.elements.username.value.trim()
    const roomInput = form.elements.room?.value.trim()
    const roomId = roomInput || room.trim()

    if (!name) {
      setJoinError("Please enter a username.")
      setJoinLoading(false)
      return
    }

    if (!roomId) {
      setJoinError("Please enter a room ID.")
      setJoinLoading(false)
      return
    }

    try {
      const response = await fetch(
        `http://localhost:8080/api/rooms/${encodeURIComponent(roomId)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*"
          }
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          setJoinError("Room not found. Check the room ID and try again.")
        } else {
          setJoinError("Unable to join the room. Please try again.")
        }
        return
      }

      setJoinError("")
      setUsername(name)
      setRoom(roomId)
      setDocumentReady(false)
      setJoined(true)

      const params = new URLSearchParams(window.location.search)
      params.set("room", roomId)
      params.set("username", name)
      window.history.pushState({}, "", `?${params.toString()}`)
    } catch (error) {
      console.error("Failed to join room", error)
      setJoinError("Unable to connect to the server. Please try again.")
    } finally {
      setJoinLoading(false)
    }
  }

  const handleCreateRoom = async (event) => {
    event.preventDefault()
    setCreateError("")
    setCreateLoading(true)

    const form = event.currentTarget
    const name = form.elements.username.value.trim()

    if (!name) {
      setCreateError("Please enter a username.")
      setCreateLoading(false)
      return
    }

    try {
      const response = await fetch("http://localhost:8080/api/rooms", {
        method: "POST"
      })

      if (!response.ok) {
        throw new Error(`Failed to create room: ${response.status}`)
      }

      const roomId = await response.text()
      if (!roomId.trim()) {
        throw new Error("Server returned an empty room ID")
      }

      const cleanRoomId = roomId.trim()
      setCreateError("")
      setUsername(name)
      setRoom(cleanRoomId)
      setDocumentReady(false)
      setJoined(true)

      const params = new URLSearchParams(window.location.search)
      params.set("room", cleanRoomId)
      params.set("username", name)
      window.history.pushState({}, "", `?${params.toString()}`)
    } catch (error) {
      console.error("Failed to create room", error)
      setCreateError("Unable to create room. Please try again.")
    } finally {
      setCreateLoading(false)
    }
  }

  const handleShareRoom = () => {
    setShareModalOpen(true)
  }

  const handleCopyShareLink = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey(null)
      }, 2000)
    } catch (err) {
      console.error("Failed to copy link", err)
    }
  }

  const workspaceMetrics = useMemo(() => {
    const files = Array.from(yfiles.keys()).filter(
      (f) => !f.endsWith(".keep") || yfiles.size === 1
    )
    let totalLines = 0
    let totalBytes = 0
    files.forEach((f) => {
      const text = ydoc.getText("file:" + f).toString()
      totalLines += text ? text.split("\n").length : 0
      totalBytes += text.length
    })
    return {
      fileCount: files.length,
      totalLines,
      totalKB: (totalBytes / 1024).toFixed(1),
      userCount: users.length
    }
  }, [yfiles, ydoc, users.length, contentRevision])

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null)
    }
    window.addEventListener("click", handleGlobalClick)
    return () => window.removeEventListener("click", handleGlobalClick)
  }, [])

  const handleLeaveRoom = () => {
    setJoined(false)
    setUsername("")
    setUsers([])
    setShareMessage("")
    setDocumentReady(false)
    setJoinError("")
    setCreateError("")
    setTerminalOpen(false)
    setTerminalMaximized(false)
    setPreviewOpen(false)
    setRoom("")
    window.history.pushState({}, "", window.location.pathname)
  }

  const errorsCount = diagnostics.filter((d) => d.severity === SEVERITY.ERROR).length
  const warningsCount = diagnostics.filter((d) => d.severity === SEVERITY.WARNING).length

  const visibleFilePaths = fileList.filter((f) => !f.endsWith(".keep") || fileList.length === 1)
  const fileTree = buildTreeFromPaths(fileList)

  /**
   * Recursive tree item renderer for VS Code style directory tree.
   */
  const renderTreeNode = (node, depth = 0) => {
    if (node.isDirectory) {
      const isExpanded = expandedFolders.has(node.path)
      const isRenaming = renamingNode?.path === node.path

      return (
        <div key={node.path} className="flex flex-col">
          <div
            onClick={(e) => {
              if (!isRenaming) toggleFolder(node.path, e)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setContextMenu({
                type: "explorer",
                x: e.clientX,
                y: e.clientY,
                target: node.path,
                isDirectory: true
              })
            }}
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="tree-node group"
          >
            <div className="tree-node-label">
              <svg
                className={`w-3 h-3 text-[#8b949e] transition-transform duration-150 flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <svg
                className={`w-3.5 h-3.5 flex-shrink-0 ${isExpanded ? "text-[#58a6ff]" : "text-[#8b949e]"}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {isExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                )}
              </svg>
              {isRenaming ? (
                <input
                  type="text"
                  autoFocus
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameNode(node.path, renameInput, true)
                    }
                    if (e.key === "Escape") {
                      setRenamingNode(null)
                      setRenameInput("")
                    }
                  }}
                  onBlur={() => {
                    if (renameInput.trim()) {
                      handleRenameNode(node.path, renameInput, true)
                    } else {
                      setRenamingNode(null)
                    }
                  }}
                  className="tree-inline-input"
                />
              ) : (
                <span className="font-semibold text-xs text-[#c9d1d9] truncate">{node.name}</span>
              )}
            </div>

            {!isRenaming && !isViewer && (
              <div className="tree-node-actions">
                <button
                  type="button"
                  title={`Rename ${node.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingNode({ path: node.path, name: node.name, isDirectory: true })
                    setRenameInput(node.name)
                  }}
                  className="tree-action-btn"
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="New File Inside Folder"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsCreatingNode({ type: "file", parentPath: node.path })
                    setExpandedFolders((prev) => new Set([...prev, node.path]))
                  }}
                  className="tree-action-btn"
                >
                  +
                </button>
                <button
                  type="button"
                  title={`Delete ${node.name}`}
                  onClick={(e) => handleDeleteFolder(node.path, e)}
                  className="tree-action-btn"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="flex flex-col">
              {isCreatingNode && isCreatingNode.parentPath === node.path && (
                <div style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }} className="tree-input-wrapper">
                  <input
                    type="text"
                    autoFocus
                    placeholder={isCreatingNode.type === "folder" ? "folder_name" : "filename.ext"}
                    value={newPathInput}
                    onChange={(e) => setNewPathInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const full = `${node.path}/${newPathInput}`
                        handleCreateNode(full, isCreatingNode.type === "folder")
                      }
                      if (e.key === "Escape") {
                        setIsCreatingNode(null)
                        setNewPathInput("")
                      }
                    }}
                    onBlur={() => {
                      if (newPathInput.trim()) {
                        handleCreateNode(`${node.path}/${newPathInput}`, isCreatingNode.type === "folder")
                      } else {
                        setIsCreatingNode(null)
                      }
                    }}
                    className="tree-inline-input"
                  />
                </div>
              )}
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    if (node.name === ".keep") return null

    const isActive = activeFile === node.path
    const isRenaming = renamingNode?.path === node.path

    return (
      <div
        key={node.path}
        onClick={() => {
          if (!isRenaming) handleSelectFile(node.path)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setContextMenu({
            type: "explorer",
            x: e.clientX,
            y: e.clientY,
            target: node.path,
            isDirectory: false
          })
        }}
        style={{ paddingLeft: `${depth * 14 + 16}px` }}
        className={`tree-node group ${isActive ? "active" : ""}`}
      >
        <div className="tree-node-label">
          <span className="text-xs">{getFileIcon(node.name)}</span>
          {isRenaming ? (
            <input
              type="text"
              autoFocus
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameNode(node.path, renameInput, false)
                }
                if (e.key === "Escape") {
                  setRenamingNode(null)
                  setRenameInput("")
                }
              }}
              onBlur={() => {
                if (renameInput.trim()) {
                  handleRenameNode(node.path, renameInput, false)
                } else {
                  setRenamingNode(null)
                }
              }}
              className="tree-inline-input"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-between pr-1">
              <span className="truncate">{node.name}</span>
              {gitStatusMap[node.path] && (
                <span
                  className={`git-badge ${
                    gitStatusMap[node.path] === "M"
                      ? "git-badge-modified"
                      : gitStatusMap[node.path] === "U"
                      ? "git-badge-untracked"
                      : "git-badge-deleted"
                  }`}
                  title={gitStatusMap[node.path] === "M" ? "Modified" : "Untracked"}
                >
                  {gitStatusMap[node.path]}
                </span>
              )}
            </div>
          )}
        </div>

        {!isRenaming && !isViewer && (
          <div className="tree-node-actions">
            <button
              type="button"
              title={`Rename ${node.name}`}
              onClick={(e) => {
                e.stopPropagation()
                setRenamingNode({ path: node.path, name: node.name, isDirectory: false })
                setRenameInput(node.name)
              }}
              className="tree-action-btn"
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            {visibleFilePaths.length > 1 && (
              <button
                type="button"
                title={`Delete ${node.name}`}
                onClick={(e) => handleDeleteFile(node.path, e)}
                className="tree-action-btn"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  /*
   * Join / Create Screen
   */
  if (!joined) {
    const hasRoomFromUrl = Boolean(room.trim())

    return (
      <main className="h-screen w-full bg-[#090d13] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-lg p-6 shadow-xl">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h1 className="text-xl font-bold text-[#f0f6fc]">SyncStream</h1>
          </div>

          <p className="text-[#8b949e] text-center mb-6 text-xs">
            Real-time collaborative code editor & workspace
          </p>

          {hasRoomFromUrl ? (
            <form onSubmit={handleJoin} className="flex flex-col gap-3">
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs">
                Room: <span className="text-[#58a6ff] font-mono font-medium">{room}</span>
              </div>

              <input
                type="text"
                name="username"
                placeholder="Username"
                className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-sm outline-none border border-[#30363d] focus:border-[#58a6ff]"
                required
              />

              {joinError && (
                <div className="p-2 rounded bg-[#f851491a] border border-[#f8514966] text-[#f85149] text-xs">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="p-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold disabled:opacity-50 transition"
              >
                {joinLoading ? "Joining..." : "Join Room"}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-sm outline-none border border-[#30363d] focus:border-[#58a6ff]"
                  required
                />

                {createError && (
                  <div className="p-2 rounded bg-[#f851491a] border border-[#f8514966] text-[#f85149] text-xs">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={createLoading}
                  className="p-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold disabled:opacity-50 transition"
                >
                  {createLoading ? "Creating Room..." : "Create New Room"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-[#30363d] flex-1" />
                <span className="text-[#8b949e] text-[10px] uppercase font-semibold">
                  OR
                </span>
                <div className="h-px bg-[#30363d] flex-1" />
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <input
                  type="text"
                  name="room"
                  placeholder="Room ID"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-sm outline-none border border-[#30363d] focus:border-[#58a6ff] font-mono"
                  required
                />

                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-sm outline-none border border-[#30363d] focus:border-[#58a6ff]"
                  required
                />

                {joinError && (
                  <div className="p-2 rounded bg-[#f851491a] border border-[#f8514966] text-[#f85149] text-xs">
                    {joinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={joinLoading}
                  className="p-2.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-semibold disabled:opacity-50 border border-[#30363d] transition"
                >
                  {joinLoading ? "Joining..." : "Join Room"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen w-full bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Hidden File Input for Importing ZIP / Project */}
      <input
        type="file"
        ref={importFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImportZipFile(e.target.files[0])
            e.target.value = ""
          }
        }}
        accept=".zip"
        style={{ display: "none" }}
      />

      {/* Top Navbar */}
      <header className="h-11 min-h-[44px] bg-[#161b22] border-b border-[#30363d] px-3 flex items-center justify-between select-none">
        {/* Left: Brand & Room ID */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm font-semibold text-[#f0f6fc]">SyncStream</span>
          </div>

          <div
            onClick={handleShareRoom}
            title="Click to copy room link"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px] text-[#8b949e] hover:text-[#c9d1d9] hover:border-[#8b949e] cursor-pointer transition"
          >
            <span>room:</span>
            <span className="text-[#58a6ff] font-mono">{room}</span>
          </div>
        </div>

        {/* Center: Language, Preview & Run Actions */}
        <div className="flex items-center gap-2">
          <select
            id="language"
            value={language}
            onChange={(event) => {
              const newLang = event.target.value
              setLanguage(newLang)
              if (editorRef.current && monacoRef.current) {
                const model = editorRef.current.getModel()
                if (model) {
                  monacoRef.current.editor.setModelLanguage(model, newLang)
                }
              }
            }}
            className="bg-[#0d1117] text-[#c9d1d9] text-xs rounded px-2.5 py-1 outline-none border border-[#30363d] hover:border-[#8b949e] focus:border-[#58a6ff] font-sans"
          >
            <option value="java">Java 21</option>
            <option value="python">Python 3</option>
            <option value="cpp">C++ (GCC)</option>
            <option value="c">C (GCC)</option>
            <option value="javascript">JavaScript (Node.js)</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="csharp">C#</option>
            <option value="ruby">Ruby</option>
            <option value="php">PHP</option>
            <option value="kotlin">Kotlin</option>
            <option value="swift">Swift</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="sql">SQL</option>
          </select>

          <button
            type="button"
            onClick={handleInsertTemplate}
            disabled={isViewer}
            title={isViewer ? "Viewers cannot edit" : "Insert boilerplate template for active file"}
            className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Template
          </button>

          <button
            type="button"
            onClick={handleFormatCode}
            disabled={isViewer}
            title={isViewer ? "Viewers cannot edit" : "Format Document (Shift+Alt+F)"}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
            </svg>
            <span>Format</span>
          </button>

          {isWebContext && (
            <button
              type="button"
              onClick={() => setPreviewOpen((c) => !c)}
              title="Toggle Live Web Preview"
              className={`px-2.5 py-1 rounded text-xs border transition flex items-center gap-1.5 ${
                previewOpen
                  ? "bg-[#1f6feb] text-white border-[#388bfd]"
                  : "bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d]"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Preview</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning || isViewer}
            title={isViewer ? "Viewers cannot run code" : "Run Project (Ctrl+Enter / F5)"}
            className="btn-primary-run disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Running...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Run</span>
              </>
            )}
          </button>

          {/* Center: Quick Open File Button */}
          <button
            type="button"
            onClick={() => {
              setPaletteMode("quickOpen")
              setPaletteQuery("")
              setPaletteSelectedIndex(0)
            }}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded text-xs text-[#8b949e] hover:text-[#c9d1d9] transition cursor-pointer"
            title="Quick Open File (Ctrl+P)"
          >
            <svg className="w-3.5 h-3.5 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="hidden sm:inline">Search files...</span>
            <kbd className="hidden sm:inline text-[10px] bg-[#161b22] px-1 py-0.2 rounded border border-[#30363d] text-[#8b949e]">Ctrl+P</kbd>
          </button>
        </div>

        {/* Right: Desktop Actions & Presence */}
        <div className="hidden md:flex items-center gap-2">
          {/* Follow Mode Status Indicator */}
          {followingUser && (
            <div
              onClick={() => setFollowingUser(null)}
              className="follow-active-badge cursor-pointer"
              title="Click to stop following cursor"
            >
              <span>Following: {followingUser}</span>
              <span className="ml-1 text-[9px] hover:text-white">✕</span>
            </div>
          )}

          {/* Collaborator Presence Avatar Stack */}
          {users.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-1" title={`${users.length} collaborator${users.length === 1 ? "" : "s"} online`}>
              {users.slice(0, 6).map((u) => {
                const uColor = getUserColor(u.username)
                return (
                  <div
                    key={u.clientId || u.username}
                    className="presence-avatar-circle"
                    style={{ backgroundColor: uColor }}
                    title={`${u.username} (${rolesMap[u.username] || "editor"})`}
                  >
                    {(u.username || "U").charAt(0).toUpperCase()}
                  </div>
                )
              })}
              {users.length > 6 && (
                <div
                  className="presence-avatar-circle bg-[#21262d] text-[#8b949e]"
                  title={`${users.length - 6} more collaborators`}
                >
                  +{users.length - 6}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === "CONNECTED" ? "bg-[#3fb950]" : "bg-[#d29922]"
              }`}
            />
            <span className="text-[#8b949e]">{username}</span>
            <span className={`role-badge role-badge-${myRole}`}>{myRole}</span>
          </div>

          <button
            type="button"
            onClick={handleShareRoom}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition"
          >
            Share
          </button>

          <button
            type="button"
            onClick={() => setShortcutsModalOpen(true)}
            className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition flex items-center gap-1"
            title="Keyboard Shortcuts Cheat-Sheet (Ctrl+/ or ?)"
          >
            <span className="font-bold text-xs">?</span>
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition flex items-center gap-1.5"
            title="Editor Settings (Theme, Font Size, Minimap)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setTerminalOpen((c) => !c)}
            className={`px-2.5 py-1 rounded text-xs border transition flex items-center gap-1.5 ${
              terminalOpen
                ? "bg-[#21262d] text-[#58a6ff] border-[#388bfd]"
                : "bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border-[#30363d]"
            }`}
            title="Toggle Terminal Panel (Ctrl+`)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6-6-6m8 14h8" />
            </svg>
            <span>Terminal</span>
          </button>

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="px-2.5 py-1 rounded hover:bg-[#f8514926] text-[#f85149] text-xs border border-[#f8514940] transition"
          >
            Leave
          </button>
        </div>

        {/* Right: Mobile Header Toggle Button */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((m) => !m)}
            className="p-1.5 rounded bg-[#21262d] text-[#c9d1d9] border border-[#30363d]"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Header Menu Drawer */}
      {mobileMenuOpen && (
        <>
          <div className="mobile-sidebar-backdrop md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="mobile-header-menu md:hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-2 border-b border-[#21262d]">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    connectionState === "CONNECTED" ? "bg-[#3fb950]" : "bg-[#d29922]"
                  }`}
                />
                <span className="font-semibold text-xs text-[#f0f6fc]">{username}</span>
              </div>
              <span className={`role-badge role-badge-${myRole}`}>{myRole}</span>
            </div>

            {users.length > 0 && (
              <div className="flex flex-col gap-1.5 py-1 border-b border-[#21262d]">
                <span className="text-[10px] uppercase font-bold text-[#8b949e]">
                  Active Collaborators ({users.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {users.map((u) => (
                    <div
                      key={u.clientId || u.username}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px]"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getUserColor(u.username) }}
                      />
                      <span className="text-[#c9d1d9]">{u.username}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                handleShareRoom()
              }}
              className="w-full text-left px-3 py-2 rounded bg-[#0d1117] hover:bg-[#21262d] text-xs text-[#c9d1d9] border border-[#30363d] flex items-center gap-2"
            >
              <span>🔗</span>
              <span>Share Workspace & Invite</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setShortcutsModalOpen(true)
              }}
              className="w-full text-left px-3 py-2 rounded bg-[#0d1117] hover:bg-[#21262d] text-xs text-[#c9d1d9] border border-[#30363d] flex items-center gap-2"
            >
              <span>⌨️</span>
              <span>Keyboard Shortcuts Reference</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                setSettingsModalOpen(true)
              }}
              className="w-full text-left px-3 py-2 rounded bg-[#0d1117] hover:bg-[#21262d] text-xs text-[#c9d1d9] border border-[#30363d] flex items-center gap-2"
            >
              <span>⚙️</span>
              <span>Editor Settings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                handleLeaveRoom()
              }}
              className="w-full text-left px-3 py-2 rounded bg-[#f8514915] text-[#f85149] hover:bg-[#f8514925] text-xs border border-[#f8514940] flex items-center gap-2"
            >
              <span>🚪</span>
              <span>Leave Room</span>
            </button>
          </div>
        </>
      )}

      {shareMessage && (
        <div className="fixed top-14 right-4 z-[9999] px-3 py-1.5 rounded bg-[#1f6feb] text-white text-xs shadow-lg animate-fade">
          ✓ {shareMessage}
        </div>
      )}

      {/* Main Body with VS Code Layout */}
      <div className="flex flex-1 min-h-0">
        {/* 1. VS Code Left Activity Bar Rail */}
        <nav className="vscode-activity-bar">
          <div className="activity-bar-group">
            <button
              type="button"
              onClick={() => {
                if (activeActivityTab === "explorer" && sidebarOpen) {
                  setSidebarOpen(false)
                } else {
                  setActiveActivityTab("explorer")
                  setSidebarOpen(true)
                }
              }}
              title="Explorer (Files & Folders)"
              className={`activity-bar-btn ${sidebarOpen && activeActivityTab === "explorer" ? "active" : ""}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeActivityTab === "search" && sidebarOpen) {
                  setSidebarOpen(false)
                } else {
                  setActiveActivityTab("search")
                  setSidebarOpen(true)
                  setTimeout(() => {
                    searchInputRef.current?.focus()
                  }, 50)
                }
              }}
              title="Search & Replace (Ctrl+Shift+F)"
              className={`activity-bar-btn ${sidebarOpen && activeActivityTab === "search" ? "active" : ""}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeActivityTab === "git" && sidebarOpen) {
                  setSidebarOpen(false)
                } else {
                  setActiveActivityTab("git")
                  setSidebarOpen(true)
                }
              }}
              title="Source Control"
              className={`activity-bar-btn ${sidebarOpen && activeActivityTab === "git" ? "active" : ""}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v12m12-9a9 9 0 00-9-9" />
              </svg>
              {gitChanges.length > 0 && activeActivityTab !== "git" && (
                <span className="activity-bar-badge">{gitChanges.length}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeActivityTab === "chat" && sidebarOpen) {
                  setSidebarOpen(false)
                } else {
                  setActiveActivityTab("chat")
                  setSidebarOpen(true)
                }
              }}
              title="Room Chat"
              className={`activity-bar-btn ${sidebarOpen && activeActivityTab === "chat" ? "active" : ""}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {unreadChatCount > 0 && activeActivityTab !== "chat" && (
                <span className="activity-bar-badge">{unreadChatCount}</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeActivityTab === "collaborators" && sidebarOpen) {
                  setSidebarOpen(false)
                } else {
                  setActiveActivityTab("collaborators")
                  setSidebarOpen(true)
                }
              }}
              title="Collaborators"
              className={`activity-bar-btn ${sidebarOpen && activeActivityTab === "collaborators" ? "active" : ""}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
          </div>

          {isWebContext && (
            <div className="activity-bar-group">
              <button
                type="button"
                onClick={() => setPreviewOpen((c) => !c)}
                title="Toggle Web Preview"
                className={`activity-bar-btn ${previewOpen ? "active" : ""}`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            </div>
          )}
        </nav>

        {/* 2. VS Code Primary Sidebar */}
        {sidebarOpen && (
          <div
            className="mobile-sidebar-backdrop md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {sidebarOpen && (
          <aside className="vscode-sidebar" style={{ width: `${sidebarWidth}px` }}>
            <div
              className={`sidebar-resize-handle ${isResizingSidebar ? "resizing" : ""}`}
              onMouseDown={handleStartSidebarResize}
              title="Drag to resize sidebar"
            />
            {/* View 1: Explorer (Files & Folders) */}
            {activeActivityTab === "explorer" && (
              <>
                <div className="sidebar-title-header">
                  <span>Explorer</span>
                  <div className="sidebar-action-icons">
                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          title="New File"
                          onClick={() => setIsCreatingNode({ type: "file", parentPath: "" })}
                          className="sidebar-icon-btn"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="New Folder"
                          onClick={() => setIsCreatingNode({ type: "folder", parentPath: "" })}
                          className="sidebar-icon-btn"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Import Project (ZIP)"
                          onClick={() => importFileInputRef.current?.click()}
                          className="sidebar-icon-btn"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      title="Export Project (ZIP)"
                      onClick={handleExportZip}
                      className="sidebar-icon-btn"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Collapse All Folders"
                      onClick={() => setExpandedFolders(new Set())}
                      className="sidebar-icon-btn"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7-7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Close Sidebar"
                      onClick={() => setSidebarOpen(false)}
                      className="sidebar-icon-btn md:hidden"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="tree-section-header">
                  <span className="uppercase text-[10px] tracking-wider">
                    ▼ {room ? room.toUpperCase() : "WORKSPACE"}
                  </span>
                  <span className="text-[10px] text-[#8b949e]">({visibleFilePaths.length})</span>
                </div>

                <div
                  className="tree-container"
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingOver(true)
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={handleDrop}
                >
                  {isDraggingOver && (
                    <div className="explorer-drop-zone">
                      <span className="text-xl">📥</span>
                      <span>Drop files or ZIP to import</span>
                    </div>
                  )}

                  {isCreatingNode && isCreatingNode.parentPath === "" && (
                    <div className="tree-input-wrapper">
                      <input
                        type="text"
                        autoFocus
                        placeholder={isCreatingNode.type === "folder" ? "folder_name" : "filename.ext"}
                        value={newPathInput}
                        onChange={(e) => setNewPathInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateNode(newPathInput, isCreatingNode.type === "folder")
                          }
                          if (e.key === "Escape") {
                            setIsCreatingNode(null)
                            setNewPathInput("")
                          }
                        }}
                        onBlur={() => {
                          if (newPathInput.trim()) {
                            handleCreateNode(newPathInput, isCreatingNode.type === "folder")
                          } else {
                            setIsCreatingNode(null)
                          }
                        }}
                        className="tree-inline-input"
                      />
                    </div>
                  )}

                  {fileTree.map((child) => renderTreeNode(child, 0))}
                </div>
              </>
            )}

            {/* View 2: Global Search & Replace (Ctrl+Shift+F) */}
            {activeActivityTab === "search" && (
              <div className="sidebar-search-container">
                <div className="sidebar-title-header">
                  <span>Search</span>
                  <div className="sidebar-action-icons">
                    <button
                      type="button"
                      title="Refresh Search"
                      onClick={performSearch}
                      className="sidebar-icon-btn"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Clear Search"
                      onClick={() => {
                        setSearchQuery("")
                        setSearchResults([])
                        setSearchStatus("")
                        searchInputRef.current?.focus()
                      }}
                      className="sidebar-icon-btn"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Collapse All Results"
                      onClick={() => {
                        setCollapsedSearchFiles(new Set(searchResults.map((r) => r.filePath)))
                      }}
                      className="sidebar-icon-btn"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7-7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Close Sidebar"
                      onClick={() => setSidebarOpen(false)}
                      className="sidebar-icon-btn md:hidden"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="sidebar-search-inputs">
                  {/* Search Input Box with Options */}
                  <div className="search-input-row">
                    <button
                      type="button"
                      className="search-drawer-toggle"
                      onClick={() => setShowReplaceDrawer((p) => !p)}
                      title="Toggle Replace Drawer"
                    >
                      <svg
                        className={`w-3 h-3 text-[#8b949e] transition-transform duration-100 ${showReplaceDrawer ? "rotate-90" : ""}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div className="search-input-wrapper">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search (e.g. function, class)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            performSearch()
                          }
                        }}
                        className="sidebar-search-input"
                      />
                      <div className="search-option-toggles">
                        <button
                          type="button"
                          className={`search-option-btn ${searchMatchCase ? "active" : ""}`}
                          onClick={() => setSearchMatchCase((c) => !c)}
                          title="Match Case (Aa)"
                        >
                          Aa
                        </button>
                        <button
                          type="button"
                          className={`search-option-btn ${searchWholeWord ? "active" : ""}`}
                          onClick={() => setSearchWholeWord((w) => !w)}
                          title="Match Whole Word (\b)"
                        >
                          {"\\b"}
                        </button>
                        <button
                          type="button"
                          className={`search-option-btn ${searchUseRegex ? "active" : ""}`}
                          onClick={() => setSearchUseRegex((r) => !r)}
                          title="Use Regular Expression (.*)"
                        >
                          .*
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Replace Input Box */}
                  {showReplaceDrawer && (
                    <div className="search-input-row">
                      <div className="w-[18px] flex-shrink-0" />
                      <div className="search-input-wrapper">
                        <input
                          type="text"
                          placeholder="Replace..."
                          value={replaceQuery}
                          onChange={(e) => setReplaceQuery(e.target.value)}
                          className="sidebar-search-input"
                        />
                        <button
                          type="button"
                          className="search-replace-all-btn"
                          onClick={handleReplaceAll}
                          title="Replace All across Workspace"
                          disabled={!searchQuery || searchResults.length === 0}
                        >
                          Replace All
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Filter Include / Exclude */}
                  <div className="pt-1">
                    <details className="text-[11px] text-[#8b949e] select-none">
                      <summary className="cursor-pointer hover:text-[#c9d1d9] py-0.5">files to include / exclude</summary>
                      <div className="flex flex-col gap-1.5 pt-1.5 pb-0.5">
                        <input
                          type="text"
                          placeholder="include e.g. *.js, *.css"
                          value={searchIncludeFilter}
                          onChange={(e) => setSearchIncludeFilter(e.target.value)}
                          className="sidebar-filter-input"
                          title="Files to include"
                        />
                        <input
                          type="text"
                          placeholder="exclude e.g. *.keep"
                          value={searchExcludeFilter}
                          onChange={(e) => setSearchExcludeFilter(e.target.value)}
                          className="sidebar-filter-input"
                          title="Files to exclude"
                        />
                      </div>
                    </details>
                  </div>
                </div>

                {/* Search Stats / Status */}
                {searchStatus && (
                  <div className="search-status-bar">
                    <span>{searchStatus}</span>
                  </div>
                )}

                {/* Search Results Tree */}
                <div className="search-results-list">
                  {searchQuery && searchResults.length === 0 && (
                    <div className="p-4 text-center text-[#8b949e] text-xs">
                      No results found for &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}

                  {searchResults.map((fileResult) => {
                    const isCollapsed = collapsedSearchFiles.has(fileResult.filePath)
                    return (
                      <div key={fileResult.filePath} className="search-file-group">
                        <div
                          className="search-file-header"
                          onClick={() => {
                            setCollapsedSearchFiles((prev) => {
                              const next = new Set(prev)
                              if (next.has(fileResult.filePath)) {
                                next.delete(fileResult.filePath)
                              } else {
                                next.add(fileResult.filePath)
                              }
                              return next
                            })
                          }}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <svg
                              className={`w-3 h-3 text-[#8b949e] transition-transform duration-100 flex-shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className="text-xs">{getFileIcon(fileResult.filePath)}</span>
                            <span className="search-file-name truncate">
                              {fileResult.filePath}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {showReplaceDrawer && (
                              <button
                                type="button"
                                title={`Replace all in ${fileResult.filePath}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleReplaceAllInFile(fileResult.filePath)
                                }}
                                className="search-inline-replace-btn"
                              >
                                Replace
                              </button>
                            )}
                            <span className="search-count-badge">
                              {fileResult.matches.length}
                            </span>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="search-file-matches">
                            {fileResult.matches.map((match) => (
                              <div
                                key={match.id}
                                className="search-match-item"
                                onClick={() => handleSelectSearchMatch(fileResult.filePath, match)}
                              >
                                <span className="search-match-line">
                                  {match.lineNumber}
                                </span>
                                <span className="search-match-preview truncate">
                                  <span>{match.previewBefore}</span>
                                  <mark className="search-match-highlight">{match.matchText}</mark>
                                  <span>{match.previewAfter}</span>
                                </span>
                                  {showReplaceDrawer && (
                                    <button
                                      type="button"
                                      title="Replace this match"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleReplaceSingleMatch(fileResult.filePath, match)
                                      }}
                                      className="search-single-replace-btn"
                                    >
                                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                      </svg>
                                    </button>
                                  )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* View: Source Control (Git) */}
            {activeActivityTab === "git" && (
              <div className="sidebar-git-container">
                <div className="sidebar-title-header">
                  <span>Source Control</span>
                  <div className="flex items-center gap-1.5 text-[#58a6ff] text-[11px] font-normal normal-case">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <span>main</span>
                  </div>
                </div>

                {/* Commit Input Box */}
                <form onSubmit={handleCommit} className="sidebar-git-commit-box">
                  <textarea
                    placeholder="Message (Ctrl+Enter to commit)"
                    value={gitCommitMessage}
                    onChange={(e) => setGitCommitMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        handleCommit(e)
                      }
                    }}
                    className="sidebar-git-commit-input"
                  />
                  <button
                    type="submit"
                    disabled={gitChanges.length === 0}
                    className="sidebar-git-commit-btn"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Commit ({gitChanges.length})</span>
                  </button>
                </form>

                {/* Changed Files Section */}
                <div className="tree-section-header">
                  <span className="uppercase text-[10px] tracking-wider">
                    CHANGES ({gitChanges.length})
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {gitChanges.length === 0 ? (
                    <div className="p-4 text-center text-[#8b949e] text-xs">
                      No uncommitted changes in workspace.
                    </div>
                  ) : (
                    <div className="flex flex-col py-1">
                      {gitChanges.map((change) => (
                        <div
                          key={change.filePath}
                          onClick={() => {
                            if (change.status !== "D") {
                              handleSelectFile(change.filePath)
                            }
                          }}
                          className={`tree-node group ${activeFile === change.filePath ? "active" : ""}`}
                        >
                          <div className="tree-node-label">
                            <span className="text-xs">{getFileIcon(change.filePath)}</span>
                            <span className="truncate">{change.filePath}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {change.status === "M" && (
                              <button
                                type="button"
                                title={`View Diff for ${change.filePath}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDiffModalFile(change.filePath)
                                }}
                                className="tree-action-btn"
                              >
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8m-8 5h8M4 5v14a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2z" />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              title={`Discard changes in ${change.filePath}`}
                              onClick={(e) => handleDiscardChange(change.filePath, change.status, e)}
                              className="tree-action-btn"
                            >
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2m0 0l-3-3m3 3l3-3M3 10l3 3m-3-3l3-3" />
                              </svg>
                            </button>
                            <span
                              className={`git-badge ${
                                change.status === "M"
                                  ? "git-badge-modified"
                                  : change.status === "U"
                                  ? "git-badge-untracked"
                                  : "git-badge-deleted"
                              }`}
                            >
                              {change.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Commit History Log */}
                  {commitsList.length > 0 && (
                    <>
                      <div className="tree-section-header mt-2">
                        <span className="uppercase text-[10px] tracking-wider">
                          COMMITS ({commitsList.length})
                        </span>
                      </div>
                      <div className="flex flex-col p-2 gap-1.5">
                        {[...commitsList].reverse().map((commit) => (
                          <div
                            key={commit.id}
                            className="p-2 rounded bg-[#161b22] border border-[#21262d] text-xs flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between text-[#8b949e] text-[10px]">
                              <span className="font-mono text-[#58a6ff]">{commit.id}</span>
                              <span>{new Date(commit.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <div className="text-[#f0f6fc] font-medium leading-snug">{commit.message}</div>
                            <div className="text-[#8b949e] text-[10px]">by {commit.author}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* View 3: Room Chat (Full Height in Sidebar - Never cut by dock!) */}
            {activeActivityTab === "chat" && (
              <div className="sidebar-chat-container">
                <div className="sidebar-title-header">
                  <span>Room Chat</span>
                  <span className="text-[10px] text-[#8b949e]">({chatMessages.length})</span>
                </div>

                <div className="sidebar-chat-messages">
                  {chatMessages.length === 0 ? (
                    <div className="p-4 text-center text-[#8b949e] text-xs">
                      No messages yet. Chat live with room collaborators!
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const isMine = msg.sender === username
                      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                      return (
                        <div
                          key={msg.id}
                          className={`sidebar-chat-bubble ${isMine ? "mine" : "peer"}`}
                        >
                          <div className="sidebar-chat-sender">
                            <span
                              className={
                                isMine
                                  ? "text-[#58a6ff] font-semibold"
                                  : "text-[#7ee787] font-semibold"
                              }
                            >
                              {isMine ? "You" : msg.sender}
                            </span>
                            <span>{timeStr}</span>
                          </div>
                          <div>{msg.text}</div>
                        </div>
                      )
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="sidebar-chat-form">
                  <input
                    type="text"
                    placeholder="Type message..."
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    className="sidebar-chat-input"
                  />
                  <button type="submit" className="sidebar-chat-send">
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* View 3: Collaborators */}
            {activeActivityTab === "collaborators" && (
              <>
                <div className="sidebar-title-header">
                  <span>Collaborators</span>
                  <span className="text-[10px] text-[#8b949e]">({users.length})</span>
                </div>

                <div className="p-2 flex-1 overflow-y-auto flex flex-col gap-1.5">
                  {users.map((user) => {
                    const userRole = rolesMap[user.username] || "editor"
                    const isSelf = user.username === username
                    const canPromote =
                      !isSelf &&
                      ((isOwner && (userRole === "viewer" || userRole === "editor")) ||
                        (isAdmin && userRole === "viewer"))
                    const canDemote =
                      !isSelf &&
                      ((isOwner && (userRole === "admin" || userRole === "editor")) ||
                        (isAdmin && userRole === "editor"))
                    const canKick =
                      !isSelf &&
                      ((isOwner && userRole !== "owner") ||
                        (isAdmin && (userRole === "editor" || userRole === "viewer")))

                    return (
                      <div
                        key={user.clientId}
                        className="flex items-center gap-1.5 p-2 rounded bg-[#161b22]/50 hover:bg-[#161b22] border border-[#21262d] text-xs text-[#c9d1d9]"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#3fb950] flex-shrink-0" />
                        <span className="truncate flex-1 font-medium">{user.username}</span>

                        {isSelf && (
                          <span className="text-[10px] text-[#8b949e] px-1 bg-[#21262d] rounded">You</span>
                        )}

                        <span className={`role-badge role-badge-${userRole}`}>{userRole}</span>

                        {/* Role & Follow Action Controls */}
                        <div className="flex items-center gap-1 ml-1">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                setFollowingUser((prev) =>
                                  prev === user.username ? null : user.username
                                )
                              }}
                              className={`collaborator-action-btn ${
                                followingUser === user.username ? "active" : ""
                              }`}
                              title={
                                followingUser === user.username
                                  ? "Stop following"
                                  : `Follow ${user.username}'s cursor`
                              }
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          )}

                          {canPromote && (
                            <button
                              type="button"
                              onClick={() => handlePromoteUser(user.username)}
                              className="collaborator-action-btn"
                              title={
                                userRole === "viewer" ? "Promote to Editor" : "Promote to Admin"
                              }
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                          )}

                          {canDemote && (
                            <button
                              type="button"
                              onClick={() => handleDemoteUser(user.username)}
                              className="collaborator-action-btn"
                              title={
                                userRole === "admin" ? "Demote to Editor" : "Demote to Viewer"
                              }
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}

                          {canKick && (
                            <button
                              type="button"
                              onClick={() => handleKickUser(user.username)}
                              className="collaborator-action-btn danger"
                              title="Kick user from room"
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="p-3 border-t border-[#21262d] text-center">
                  <button
                    type="button"
                    onClick={handleShareRoom}
                    className="w-full py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-xs text-[#c9d1d9] border border-[#30363d] transition"
                  >
                    Invite Collaborators
                  </button>
                </div>
              </>
            )}
          </aside>
        )}

        {/* 3. Center Code Area & Live Web Preview */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
          {connectionState !== "CONNECTED" && (
            <div className="px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] text-[#d29922] text-xs">
              {connectionTimedOut && "Unable to connect to room. Reconnecting..."}
              {!connectionTimedOut && connectionState === "CONNECTING" && "Connecting..."}
              {!connectionTimedOut && connectionState === "RECONNECTING" && "Reconnecting..."}
              {!connectionTimedOut && connectionState === "DISCONNECTED" && "Disconnected."}
            </div>
          )}

          {!documentReady && connectionState === "CONNECTED" && (
            <div className="flex-1 flex items-center justify-center text-[#8b949e] text-xs">
              Syncing shared document...
            </div>
          )}

          {documentReady && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* VS Code Editor Tabs Bar */}
              <div className="editor-tabs-bar">
                {openTabs.map((fname) => (
                  <div
                    key={fname}
                    onClick={() => setActiveFile(fname)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setContextMenu({
                        type: "tab",
                        x: e.clientX,
                        y: e.clientY,
                        target: fname
                      })
                    }}
                    className={`editor-tab ${activeFile === fname ? "active" : ""}`}
                  >
                    <span>{getFileIcon(fname)}</span>
                    <span>{fname}</span>
                    <span
                      onClick={(e) => handleCloseTab(fname, e)}
                      className="editor-tab-close"
                      title="Close Tab"
                    >
                      ×
                    </span>
                  </div>
                ))}
              </div>

              {/* VS Code Breadcrumbs Bar */}
              {activeFile && (
                <div className="editor-breadcrumbs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span>{room || "workspace"}</span>
                    <span>›</span>
                    {activeFile.split("/").map((part, idx, arr) => (
                      <span key={idx} className="flex items-center gap-1.5 truncate">
                        <span className={idx === arr.length - 1 ? "text-[#f0f6fc] font-medium" : ""}>
                          {part}
                        </span>
                        {idx < arr.length - 1 && <span>›</span>}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {(activeFile.endsWith(".md") || activeFile.endsWith(".markdown")) && (
                      <button
                        type="button"
                        onClick={() => setMarkdownPreviewOpen((p) => !p)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border transition flex items-center gap-1 ${
                          markdownPreviewOpen
                            ? "bg-[#1f6feb] text-white border-[#388bfd]"
                            : "bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border-[#30363d]"
                        }`}
                        title="Toggle Markdown Live Preview"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        <span>{markdownPreviewOpen ? "Hide Preview" : "Preview Markdown"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleFormatCode}
                      className="px-2 py-0.5 rounded text-[11px] text-[#8b949e] hover:text-[#c9d1d9] bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition"
                      title="Format Document (Shift+Alt+F)"
                    >
                      Format
                    </button>
                  </div>
                </div>
              )}

              {/* Split Editor and Live Web / Markdown Preview Container */}
              <div className="preview-split-container">
                {/* When No Tabs Open */}
                {(!activeFile || openTabs.length === 0) ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-[#8b949e] bg-[#0d1117] select-none p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[#58a6ff] mb-3">
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#f0f6fc] mb-1">No File Open</h3>
                    <p className="text-xs text-[#8b949e] max-w-xs mb-4">
                      Select a file from the explorer on the left or create a new file to start editing.
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
                      <span className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] font-mono">Ctrl+B</span>
                      <span>Toggle Explorer</span>
                      <span className="mx-1">•</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d] font-mono">Ctrl+Shift+F</span>
                      <span>Search</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Monaco Editor */}
                    <div className={(previewOpen || (markdownPreviewOpen && (activeFile?.endsWith(".md") || activeFile?.endsWith(".markdown")))) ? "w-1/2 min-h-0 flex flex-col" : "flex-1 min-h-0 flex flex-col"}>
                      <Editor
                        height="100%"
                        language={language}
                        defaultValue=""
                        theme={editorTheme}
                        onMount={handleMount}
                        options={{
                          automaticLayout: true,
                          minimap: { enabled: editorMinimap },
                          scrollBeyondLastLine: false,
                          fontSize: editorFontSize,
                          fontFamily: "Consolas, 'Menlo', monospace",
                          tabSize: tabSize,
                          padding: { top: 8, bottom: 8 },
                          renderLineHighlight: "all",
                          cursorBlinking: "smooth",
                          smoothScrolling: true,
                          bracketPairColorization: { enabled: true },
                          guides: { bracketPairs: true, indentation: true },
                          renderWhitespace: "selection",
                          lineNumbersMinChars: 3,
                          wordWrap: wordWrap,
                          readOnly: isViewer
                        }}
                      />
                    </div>
                  </>
                )}

                {/* Live Markdown Preview Panel */}
                {markdownPreviewOpen && activeFile && (activeFile.endsWith(".md") || activeFile.endsWith(".markdown")) && (
                  <div className="markdown-preview-container">
                    <div className="markdown-preview-header">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#f0f6fc]">Markdown Live Preview</span>
                        <span className="text-[11px] text-[#8b949e]">({activeFile})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMarkdownPreviewOpen(false)}
                        title="Close Markdown Preview"
                        className="terminal-action-btn"
                      >
                        ✕
                      </button>
                    </div>
                    <div
                      className="markdown-preview-content"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(ydoc.getText("file:" + activeFile).toString())
                      }}
                    />
                  </div>
                )}

                {/* Live Web Preview Panel */}
                {previewOpen && (
                  <div className="preview-panel">
                    <div className="preview-header">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#f0f6fc]">Live Preview</span>
                        <div className="preview-address-bar">
                          <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
                          <span>http://localhost/syncstream-preview</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="preview-device-group">
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("desktop")}
                            className={`preview-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                            title="Desktop View"
                          >
                            Desktop
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("tablet")}
                            className={`preview-device-btn ${previewDevice === "tablet" ? "active" : ""}`}
                            title="Tablet View (768px)"
                          >
                            Tablet
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDevice("mobile")}
                            className={`preview-device-btn ${previewDevice === "mobile" ? "active" : ""}`}
                            title="Mobile View (375px)"
                          >
                            Mobile
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPreviewKey((k) => k + 1)
                            updatePreview()
                          }}
                          title="Reload Preview"
                          className="terminal-action-btn"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPreviewOpen(false)}
                          title="Close Preview"
                          className="terminal-action-btn"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="preview-frame-container">
                      <div
                        className="preview-frame-wrapper"
                        style={{
                          width:
                            previewDevice === "mobile"
                              ? "375px"
                              : previewDevice === "tablet"
                              ? "768px"
                              : "100%"
                        }}
                      >
                        <iframe
                          key={previewKey}
                          title="SyncStream Live Web Preview"
                          srcDoc={previewSrcDoc}
                          sandbox="allow-scripts"
                          className="preview-iframe"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Bar */}
              <div className="editor-status-bar">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => {
                      setTerminalOpen(true)
                      setActiveBottomTab("problems")
                    }}
                    className="flex items-center gap-2 cursor-pointer hover:text-[#c9d1d9] transition-colors"
                  >
                    <span className="flex items-center gap-1 text-[#f85149]">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                      </svg>
                      <span>{errorsCount}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[#d29922]">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>{warningsCount}</span>
                    </span>
                  </div>

                  <span>Ln {cursorPos.lineNumber}, Col {cursorPos.column}</span>
                  <span>UTF-8</span>
                  <button
                    type="button"
                    onClick={() => setTabSize((prev) => (prev === 4 ? 2 : 4))}
                    title="Click to toggle Indentation (2 vs 4 spaces)"
                    className="hover:text-[#58a6ff] cursor-pointer transition-colors"
                  >
                    Spaces: {tabSize}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleWordWrap}
                    title="Click or press Alt+Z to toggle Word Wrap"
                    className="hover:text-[#58a6ff] cursor-pointer transition-colors"
                  >
                    Wrap: {wordWrap.toUpperCase()}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#58a6ff]">{activeFile}</span>
                  <span className="capitalize text-[#c9d1d9]">{language}</span>
                </div>
              </div>

              {/* Bottom Dock Panel */}
              {terminalOpen && (
                <div
                  className="terminal-panel"
                  style={{
                    height: terminalMaximized ? "80%" : `${terminalHeight}px`
                  }}
                >
                  {!terminalMaximized && (
                    <div
                      className={`terminal-resize-handle ${isResizingTerminal ? "resizing" : ""}`}
                      onMouseDown={handleStartTerminalResize}
                      title="Drag to resize dock"
                    />
                  )}

                  {/* Dock Tabs Header */}
                  <div className="dock-header">
                    <div className="dock-tabs">
                      <button
                        type="button"
                        onClick={() => setActiveBottomTab("terminal")}
                        className={`dock-tab ${activeBottomTab === "terminal" ? "active" : ""}`}
                      >
                        <span>Terminal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveBottomTab("problems")}
                        className={`dock-tab ${activeBottomTab === "problems" ? "active" : ""}`}
                      >
                        <span>Problems</span>
                        {errorsCount > 0 && (
                          <span className="dock-badge dock-badge-error">{errorsCount}</span>
                        )}
                        {warningsCount > 0 && errorsCount === 0 && (
                          <span className="dock-badge dock-badge-warning">{warningsCount}</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveBottomTab("output")}
                        className={`dock-tab ${activeBottomTab === "output" ? "active" : ""}`}
                      >
                        <span>Output</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {activeBottomTab === "output" && (
                        <button
                          type="button"
                          className="text-[11px] px-2 py-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9] bg-[#21262d] border border-[#30363d] transition-colors"
                          onClick={() => setOutputLogs("")}
                        >
                          Clear
                        </button>
                      )}

                      <button
                        type="button"
                        className="terminal-action-btn"
                        title={terminalMaximized ? "Restore" : "Maximize"}
                        onClick={() => setTerminalMaximized((c) => !c)}
                      >
                        {terminalMaximized ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <polyline points="9 9 9 15 15 15" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        )}
                      </button>

                      <button
                        type="button"
                        className="terminal-action-btn"
                        title="Close dock"
                        onClick={() => {
                          setTerminalOpen(false)
                          setTerminalMaximized(false)
                        }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: Terminal */}
                  <div
                    ref={terminalContainerRef}
                    className="terminal-container"
                    style={{
                      display: activeBottomTab === "terminal" ? "block" : "none"
                    }}
                  />

                  {/* Tab 2: Problems */}
                  {activeBottomTab === "problems" && (
                    <div className="problems-panel">
                      {diagnostics.length === 0 ? (
                        <div className="p-4 text-center text-[#8b949e] text-xs">
                          No syntax errors detected.
                        </div>
                      ) : (
                        diagnostics.map((prob, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleProblemClick(prob)}
                            className="problem-row"
                          >
                            <span className="flex-shrink-0">
                              {prob.severity === SEVERITY.ERROR ? (
                                <svg className="w-3.5 h-3.5 text-[#f85149]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="15" y1="9" x2="9" y2="15" />
                                  <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                              ) : (
                                <svg className="w-3.5 h-3.5 text-[#d29922]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                  <line x1="12" y1="9" x2="12" y2="13" />
                                  <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                              )}
                            </span>
                            <span className="problem-msg">{prob.message}</span>
                            <span className="text-[11px] text-[#8b949e]">
                              [{prob.startLineNumber}, {prob.startColumn}]
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab 3: Output */}
                  {activeBottomTab === "output" && (
                    <div className="output-panel">
                      {outputLogs || "[No execution output. Click 'Run' to execute code.]"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* 4. Quick Open & Command Palette Modal */}
      {paletteMode && (
        <div
          className="palette-overlay"
          onClick={() => {
            setPaletteMode(null)
            setPaletteQuery("")
          }}
        >
          <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
            <div className="palette-header">
              <svg className="w-4 h-4 text-[#8b949e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {paletteMode === "quickOpen" ? (
                  <>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </>
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                )}
              </svg>
              <input
                type="text"
                autoFocus
                placeholder={
                  paletteMode === "quickOpen"
                    ? "Search files by name..."
                    : "Type a command or action..."
                }
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value)
                  setPaletteSelectedIndex(0)
                }}
                onKeyDown={handlePaletteKeyDown}
                className="palette-input"
              />
              <span className="text-[10px] text-[#8b949e] px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d]">
                Esc to close
              </span>
            </div>

            <div className="palette-list">
              {filteredPaletteItems.length === 0 ? (
                <div className="palette-empty">No matching items found.</div>
              ) : (
                filteredPaletteItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => handleExecutePaletteItem(item)}
                    className={`palette-item ${idx === paletteSelectedIndex ? "selected" : ""}`}
                  >
                    <div className="palette-item-left">
                      {paletteMode === "quickOpen" ? (
                        <>
                          <span className="text-xs">{getFileIcon(item.id)}</span>
                          <span className="truncate">{item.id}</span>
                        </>
                      ) : (
                        <>
                          <span>{item.icon || "•"}</span>
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </div>
                    {item.shortcut && (
                      <span className="palette-keybinding">{item.shortcut}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Git Diff Viewer Modal */}
      {diffModalFile && (
        <div className="diff-modal-overlay" onClick={() => setDiffModalFile(null)}>
          <div className="diff-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="diff-modal-header">
              <div className="diff-modal-title">
                <span>{getFileIcon(diffModalFile)}</span>
                <span>{diffModalFile} (Working Tree ⟷ Baseline)</span>
              </div>
              <div className="diff-modal-actions">
                <button
                  type="button"
                  onClick={() => setDiffInline((d) => !d)}
                  className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition"
                >
                  {diffInline ? "Side-by-Side View" : "Inline View"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDiscardChange(diffModalFile, "M")
                    setDiffModalFile(null)
                  }}
                  className="px-2.5 py-1 rounded bg-[#f8514926] hover:bg-[#f8514940] text-[#f85149] text-xs border border-[#f8514940] transition"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={() => setDiffModalFile(null)}
                  className="terminal-action-btn"
                  title="Close Diff (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-[#0d1117]">
              <DiffEditor
                height="100%"
                language={getLanguageFromFileName(diffModalFile)}
                original={baselineFiles[diffModalFile] || ""}
                modified={ydoc.getText("file:" + diffModalFile).toString()}
                theme={editorTheme}
                options={{
                  readOnly: true,
                  renderSideBySide: !diffInline,
                  automaticLayout: true,
                  fontSize: editorFontSize,
                  minimap: { enabled: editorMinimap },
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Editor Settings & Appearance Modal */}
      {settingsModalOpen && (
        <div className="diff-modal-overlay" onClick={() => setSettingsModalOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <div className="flex items-center gap-2">
                <span>⚙️</span>
                <span>Editor & Workspace Settings</span>
              </div>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(false)}
                className="terminal-action-btn"
                title="Close Settings (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="settings-body">
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Color Theme</div>
                  <div className="settings-row-desc">Select the active Monaco editor color theme</div>
                </div>
                <select
                  value={editorTheme}
                  onChange={(e) => setEditorTheme(e.target.value)}
                  className="settings-select"
                >
                  <option value="vs-dark">VS Code Dark</option>
                  <option value="light">VS Code Light</option>
                  <option value="hc-black">High Contrast (Black)</option>
                </select>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Font Size</div>
                  <div className="settings-row-desc">Editor font size (pixels)</div>
                </div>
                <select
                  value={editorFontSize}
                  onChange={(e) => setEditorFontSize(Number(e.target.value))}
                  className="settings-select"
                >
                  <option value={12}>12 px</option>
                  <option value={13.5}>13.5 px (Default)</option>
                  <option value={15}>15 px</option>
                  <option value={16}>16 px</option>
                  <option value={18}>18 px</option>
                </select>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Editor Minimap</div>
                  <div className="settings-row-desc">Show miniature code overview scrollbar</div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditorMinimap((m) => !m)}
                  className={`px-3 py-1 rounded text-xs border transition ${
                    editorMinimap ? "bg-[#1f6feb] text-white border-[#388bfd]" : "bg-[#21262d] text-[#8b949e] border-[#30363d]"
                  }`}
                >
                  {editorMinimap ? "Enabled" : "Disabled"}
                </button>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Tab Indentation</div>
                  <div className="settings-row-desc">Number of spaces per indentation level</div>
                </div>
                <select
                  value={tabSize}
                  onChange={(e) => setTabSize(Number(e.target.value))}
                  className="settings-select"
                >
                  <option value={2}>2 Spaces</option>
                  <option value={4}>4 Spaces (Default)</option>
                </select>
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Word Wrap</div>
                  <div className="settings-row-desc">Wrap lines that exceed viewport width</div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleWordWrap}
                  className={`px-3 py-1 rounded text-xs border transition ${
                    wordWrap === "on" ? "bg-[#1f6feb] text-white border-[#388bfd]" : "bg-[#21262d] text-[#8b949e] border-[#30363d]"
                  }`}
                >
                  {wordWrap.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Floating Context Menu (Tabs & Explorer) */}
      {contextMenu && (
        <div
          className="context-menu-container"
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 260)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 210)}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "tab" ? (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  handleCloseTab(contextMenu.target)
                  setContextMenu(null)
                }}
              >
                <span>✕</span>
                <span>Close Tab</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleCloseOtherTabs(contextMenu.target)}
              >
                <span>⊞</span>
                <span>Close Others</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleCloseTabsToRight(contextMenu.target)}
              >
                <span>⇥</span>
                <span>Close to the Right</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleCloseAllTabs()}
              >
                <span>✕✕</span>
                <span>Close All Tabs</span>
              </div>
              <div className="context-menu-divider" />
              <div
                className="context-menu-item"
                onClick={() => handleDuplicateFile(contextMenu.target)}
              >
                <span>📄</span>
                <span>Duplicate File</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleDownloadFile(contextMenu.target)}
              >
                <span>📥</span>
                <span>Download File</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => handleCopyPath(contextMenu.target)}
              >
                <span>📋</span>
                <span>Copy Relative Path</span>
              </div>
            </>
          ) : (
            <>
              {contextMenu.isDirectory ? (
                <>
                  {!isViewer && (
                    <>
                      <div
                        className="context-menu-item"
                        onClick={() => {
                          setIsCreatingNode({ type: "file", parentPath: contextMenu.target })
                          setExpandedFolders((prev) => new Set([...prev, contextMenu.target]))
                          setContextMenu(null)
                        }}
                      >
                        <span>+</span>
                        <span>New File Inside</span>
                      </div>
                      <div
                        className="context-menu-item"
                        onClick={() => {
                          setIsCreatingNode({ type: "folder", parentPath: contextMenu.target })
                          setExpandedFolders((prev) => new Set([...prev, contextMenu.target]))
                          setContextMenu(null)
                        }}
                      >
                        <span>📁</span>
                        <span>New Folder Inside</span>
                      </div>
                      <div className="context-menu-divider" />
                      <div
                        className="context-menu-item"
                        onClick={() => {
                          const nodeName = contextMenu.target.split("/").pop()
                          setRenamingNode({ path: contextMenu.target, name: nodeName, isDirectory: true })
                          setRenameInput(nodeName)
                          setContextMenu(null)
                        }}
                      >
                        <span>✎</span>
                        <span>Rename Folder</span>
                      </div>
                      <div
                        className="context-menu-item danger"
                        onClick={() => {
                          handleDeleteFolder(contextMenu.target)
                          setContextMenu(null)
                        }}
                      >
                        <span>🗑</span>
                        <span>Delete Folder</span>
                      </div>
                    </>
                  )}
                  <div className="context-menu-divider" />
                  <div
                    className="context-menu-item"
                    onClick={() => handleCopyPath(contextMenu.target)}
                  >
                    <span>📋</span>
                    <span>Copy Path</span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      handleSelectFile(contextMenu.target)
                      setContextMenu(null)
                    }}
                  >
                    <span>📂</span>
                    <span>Open File</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => handleDuplicateFile(contextMenu.target)}
                  >
                    <span>📄</span>
                    <span>Duplicate File</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => handleDownloadFile(contextMenu.target)}
                  >
                    <span>📥</span>
                    <span>Download File</span>
                  </div>
                  {!isViewer && (
                    <>
                      <div className="context-menu-divider" />
                      <div
                        className="context-menu-item"
                        onClick={() => {
                          const nodeName = contextMenu.target.split("/").pop()
                          setRenamingNode({ path: contextMenu.target, name: nodeName, isDirectory: false })
                          setRenameInput(nodeName)
                          setContextMenu(null)
                        }}
                      >
                        <span>✎</span>
                        <span>Rename</span>
                      </div>
                      <div
                        className="context-menu-item danger"
                        onClick={() => {
                          handleDeleteFile(contextMenu.target)
                          setContextMenu(null)
                        }}
                      >
                        <span>🗑</span>
                        <span>Delete File</span>
                      </div>
                    </>
                  )}
                  <div className="context-menu-divider" />
                  <div
                    className="context-menu-item"
                    onClick={() => handleCopyPath(contextMenu.target)}
                  >
                    <span>📋</span>
                    <span>Copy Relative Path</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* 8. Advanced Share & Embed Dialog Modal */}
      {shareModalOpen && (
        <div className="diff-modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <div className="flex items-center gap-2">
                <span>🔗</span>
                <span>Share Workspace & Invite Collaborators</span>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="terminal-action-btn"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="share-modal-body">
              {/* Workspace Summary Stats */}
              <div className="share-stats-grid">
                <div className="share-stat-card">
                  <span className="share-stat-val">{workspaceMetrics.userCount}</span>
                  <span className="share-stat-lbl">Active Users</span>
                </div>
                <div className="share-stat-card">
                  <span className="share-stat-val">{workspaceMetrics.fileCount}</span>
                  <span className="share-stat-lbl">Workspace Files</span>
                </div>
                <div className="share-stat-card">
                  <span className="share-stat-val">{workspaceMetrics.totalLines}</span>
                  <span className="share-stat-lbl">Total Lines of Code</span>
                </div>
              </div>

              {/* 1. Collaborate (Editor) Invite Link */}
              <div className="share-section">
                <div className="share-section-title">
                  <span>Collaborate (Editor Link)</span>
                  <span className="text-[10px] text-[#3fb950] font-normal">Full Read & Write Access</span>
                </div>
                <div className="share-link-box">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?room=${room}&role=editor`}
                    className="share-link-input"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyShareLink(
                        "editor",
                        `${window.location.origin}${window.location.pathname}?room=${room}&role=editor`
                      )
                    }
                    className={`share-copy-btn ${copiedKey === "editor" ? "copied" : ""}`}
                  >
                    {copiedKey === "editor" ? "✓ Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              {/* 2. Read-Only (Viewer) Invite Link */}
              <div className="share-section">
                <div className="share-section-title">
                  <span>Read-Only (Viewer Link)</span>
                  <span className="text-[10px] text-[#8b949e] font-normal">Observer Mode (Read-Only)</span>
                </div>
                <div className="share-link-box">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}${window.location.pathname}?room=${room}&role=viewer`}
                    className="share-link-input"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyShareLink(
                        "viewer",
                        `${window.location.origin}${window.location.pathname}?room=${room}&role=viewer`
                      )
                    }
                    className={`share-copy-btn ${copiedKey === "viewer" ? "copied" : ""}`}
                  >
                    {copiedKey === "viewer" ? "✓ Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              {/* 3. Embed HTML iFrame */}
              <div className="share-section">
                <div className="share-section-title">
                  <span>Embed in Website / Documentation</span>
                  <span className="text-[10px] text-[#8b949e] font-normal">&lt;iframe&gt; embed code</span>
                </div>
                <div className="share-link-box">
                  <input
                    type="text"
                    readOnly
                    value={`<iframe src="${window.location.origin}${window.location.pathname}?room=${room}&role=viewer" width="100%" height="600" frameborder="0" allow="clipboard-write"></iframe>`}
                    className="share-link-input"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyShareLink(
                        "embed",
                        `<iframe src="${window.location.origin}${window.location.pathname}?room=${room}&role=viewer" width="100%" height="600" frameborder="0" allow="clipboard-write"></iframe>`
                      )
                    }
                    className={`share-copy-btn ${copiedKey === "embed" ? "copied" : ""}`}
                  >
                    {copiedKey === "embed" ? "✓ Copied" : "Copy Embed"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Keyboard Shortcuts Cheat-Sheet Modal (Ctrl+/) */}
      {shortcutsModalOpen && (
        <div className="diff-modal-overlay" onClick={() => setShortcutsModalOpen(false)}>
          <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-modal-header">
              <div className="flex items-center gap-2">
                <span>⌨️</span>
                <span>Keyboard Shortcuts Reference</span>
              </div>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="terminal-action-btn"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="shortcuts-modal-body">
              <div className="shortcuts-grid">
                {/* General Navigation */}
                <div className="shortcut-category-card">
                  <span className="shortcut-category-title">General Navigation</span>
                  <div className="shortcut-item-row">
                    <span>Quick Open File</span>
                    <kbd className="shortcut-kbd">Ctrl + P</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Command Palette</span>
                    <kbd className="shortcut-kbd">Ctrl + Shift + P / F1</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Toggle File Explorer</span>
                    <kbd className="shortcut-kbd">Ctrl + B</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Global Search & Replace</span>
                    <kbd className="shortcut-kbd">Ctrl + Shift + F</kbd>
                  </div>
                </div>

                {/* Execution & Terminal */}
                <div className="shortcut-category-card">
                  <span className="shortcut-category-title">Execution & Terminal</span>
                  <div className="shortcut-item-row">
                    <span>Run Code / Project</span>
                    <kbd className="shortcut-kbd">Ctrl + Enter / F5</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Toggle Terminal Panel</span>
                    <kbd className="shortcut-kbd">Ctrl + `</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Commit Changes (Git)</span>
                    <kbd className="shortcut-kbd">Ctrl + Enter</kbd>
                  </div>
                </div>

                {/* Editor & Formatting */}
                <div className="shortcut-category-card">
                  <span className="shortcut-category-title">Editor & Formatting</span>
                  <div className="shortcut-item-row">
                    <span>Format Document</span>
                    <kbd className="shortcut-kbd">Shift + Alt + F</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>IntelliSense Autocomplete</span>
                    <kbd className="shortcut-kbd">Ctrl + Space</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Toggle Word Wrap</span>
                    <kbd className="shortcut-kbd">Alt + Z</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Keyboard Shortcuts</span>
                    <kbd className="shortcut-kbd">Ctrl + /</kbd>
                  </div>
                </div>

                {/* Collaboration & Panels */}
                <div className="shortcut-category-card">
                  <span className="shortcut-category-title">Collaboration & Views</span>
                  <div className="shortcut-item-row">
                    <span>Toggle Markdown Preview</span>
                    <kbd className="shortcut-kbd">Toolbar (.md)</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Toggle Web Preview</span>
                    <kbd className="shortcut-kbd">Activity Bar</kbd>
                  </div>
                  <div className="shortcut-item-row">
                    <span>Close Active Modal / Tab</span>
                    <kbd className="shortcut-kbd">Escape</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation Bar (hidden on desktop via CSS) */}
      <nav className="mobile-bottom-bar">
        {/* Explorer */}
        <button
          type="button"
          onClick={() => {
            if (activeActivityTab === "explorer" && sidebarOpen) {
              setSidebarOpen(false)
            } else {
              setActiveActivityTab("explorer")
              setSidebarOpen(true)
            }
          }}
          className={`mobile-bottom-tab ${sidebarOpen && activeActivityTab === "explorer" ? "active" : ""}`}
          title="Explorer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Files</span>
        </button>

        {/* Chat */}
        <button
          type="button"
          onClick={() => {
            if (activeActivityTab === "chat" && sidebarOpen) {
              setSidebarOpen(false)
            } else {
              setActiveActivityTab("chat")
              setSidebarOpen(true)
            }
          }}
          className={`mobile-bottom-tab ${sidebarOpen && activeActivityTab === "chat" ? "active" : ""}`}
          title="Chat"
        >
          {unreadChatCount > 0 && activeActivityTab !== "chat" && (
            <span className="mobile-tab-badge">{unreadChatCount > 9 ? "9+" : unreadChatCount}</span>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Chat</span>
        </button>

        {/* Terminal */}
        <button
          type="button"
          onClick={() => setTerminalOpen((c) => !c)}
          className={`mobile-bottom-tab ${terminalOpen ? "active" : ""}`}
          title="Terminal"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6-6-6m8 14h8" />
          </svg>
          <span>Terminal</span>
        </button>

        {/* Git */}
        <button
          type="button"
          onClick={() => {
            if (activeActivityTab === "git" && sidebarOpen) {
              setSidebarOpen(false)
            } else {
              setActiveActivityTab("git")
              setSidebarOpen(true)
            }
          }}
          className={`mobile-bottom-tab ${sidebarOpen && activeActivityTab === "git" ? "active" : ""}`}
          title="Source Control"
        >
          {gitChanges.length > 0 && activeActivityTab !== "git" && (
            <span className="mobile-tab-badge">{gitChanges.length > 9 ? "9+" : gitChanges.length}</span>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v12m12-9a9 9 0 00-9-9" />
          </svg>
          <span>Git</span>
        </button>

        {/* Collaborators */}
        <button
          type="button"
          onClick={() => {
            if (activeActivityTab === "collaborators" && sidebarOpen) {
              setSidebarOpen(false)
            } else {
              setActiveActivityTab("collaborators")
              setSidebarOpen(true)
            }
          }}
          className={`mobile-bottom-tab ${sidebarOpen && activeActivityTab === "collaborators" ? "active" : ""}`}
          title="Collaborators"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span>Users</span>
        </button>
      </nav>

    </main>
  )
}

export default App