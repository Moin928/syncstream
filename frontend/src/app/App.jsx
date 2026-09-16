import "./App.css"
import "@xterm/xterm/css/xterm.css"

import { Editor } from "@monaco-editor/react"
import { Terminal } from "@xterm/xterm"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect, useCallback } from "react"
import * as Y from "yjs"

import { SpringWebSocketProvider } from "../yjs/SpringWebSocketProvider"
import {
  runDiagnostics,
  parseCompilerOutput,
  LANGUAGE_STARTERS,
  SEVERITY
} from "../diagnostics"

function getExecutionCommand(language, code) {
  switch (language) {
    case "java":
      return `cat << 'EOF' > Main.java\n${code}\nEOF\njavac Main.java && java Main\n`
    case "python":
      return `cat << 'EOF' > main.py\n${code}\nEOF\npython3 main.py || python main.py\n`
    case "cpp":
      return `cat << 'EOF' > main.cpp\n${code}\nEOF\ng++ -O2 -std=c++17 main.cpp -o main && ./main\n`
    case "c":
      return `cat << 'EOF' > main.c\n${code}\nEOF\ngcc -O2 main.c -o main && ./main\n`
    case "javascript":
      return `cat << 'EOF' > index.js\n${code}\nEOF\nnode index.js\n`
    case "typescript":
      return `cat << 'EOF' > index.ts\n${code}\nEOF\nnpx -y tsx index.ts || node index.js\n`
    case "go":
      return `cat << 'EOF' > main.go\n${code}\nEOF\ngo run main.go\n`
    case "rust":
      return `cat << 'EOF' > main.rs\n${code}\nEOF\nrustc main.rs -o main && ./main\n`
    case "sql":
      return `cat << 'EOF' > query.sql\n${code}\nEOF\ncat query.sql\n`
    default:
      return `cat << 'EOF' > code.txt\n${code}\nEOF\ncat code.txt\n`
  }
}

function App() {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const providerRef = useRef(null)

  const terminalRef = useRef(null)
  const terminalContainerRef = useRef(null)
  const terminalSocketRef = useRef(null)
  const terminalResizeObserverRef = useRef(null)

  const connectionTimeoutRef = useRef(null)
  const validationTimerRef = useRef(null)

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

  const [connectionState, setConnectionState] =
    useState("CONNECTING")

  const [connectionTimedOut, setConnectionTimedOut] =
    useState(false)

  const [documentReady, setDocumentReady] =
    useState(false)

  const [language, setLanguage] =
    useState("javascript")

  const [terminalOpen, setTerminalOpen] =
    useState(true)

  const [activeBottomTab, setActiveBottomTab] =
    useState("terminal")

  const [diagnostics, setDiagnostics] =
    useState([])

  const [outputLogs, setOutputLogs] =
    useState("")

  const [isRunning, setIsRunning] =
    useState(false)

  const [cursorPos, setCursorPos] =
    useState({ lineNumber: 1, column: 1 })

  const [terminalHeight, setTerminalHeight] =
    useState(240)

  const [terminalMaximized, setTerminalMaximized] =
    useState(false)

  const [joined, setJoined] = useState(() => {
    const params =
      new URLSearchParams(
        window.location.search
      )

    return Boolean(
      params.get("room") &&
      params.get("username")
    )
  })

  const [shareMessage, setShareMessage] =
    useState("")

  const [joinError, setJoinError] =
    useState("")

  const [createError, setCreateError] =
    useState("")

  const [createLoading, setCreateLoading] =
    useState(false)

  const [joinLoading, setJoinLoading] =
    useState(false)

  const ydoc = useMemo(
    () => new Y.Doc(),
    []
  )

  const ymetadata = useMemo(
    () => ydoc.getMap("metadata"),
    [ydoc]
  )

  const yText = useMemo(
    () => ydoc.getText("monaco"),
    [ydoc]
  )

  const languageRef = useRef(language)
  const validateCodeRef = useRef(null)

  useEffect(() => {
    languageRef.current = language
  }, [language])

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
   * Re-validate and update Monaco language when language changes.
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
   * Creates the WebSocket provider when the user joins.
   */
  useEffect(() => {
    if (!joined) {
      return
    }

    const provider =
      new SpringWebSocketProvider(
        room,
        ydoc,
        username,
        setUsers,

        /*
         * Remote cursor
         */
        (cursor) => {
          if (
            cursor.clientId ===
            provider.clientId
          ) {
            return
          }

          const editor =
            editorRef.current

          if (!editor) {
            return
          }

          const model =
            editor.getModel()

          if (!model) {
            return
          }

          const lineNumber =
            Math.max(
              1,
              Math.min(
                cursor.lineNumber,
                model.getLineCount()
              )
            )

          const maxColumn =
            model.getLineMaxColumn(
              lineNumber
            )

          const column =
            Math.max(
              1,
              Math.min(
                cursor.column,
                maxColumn
              )
            )

          const oldDecoration =
            remoteCursorsRef.current.get(
              cursor.clientId
            )

          const decorations =
            editor.deltaDecorations(
              oldDecoration
                ? [oldDecoration]
                : [],
              [
                {
                  range: {
                    startLineNumber:
                      lineNumber,
                    startColumn:
                      column,
                    endLineNumber:
                      lineNumber,
                    endColumn:
                      column
                  },
                  options: {
                    beforeContentClassName:
                      "remote-cursor"
                  }
                }
              ]
            )

          remoteCursorsRef.current.set(
            cursor.clientId,
            decorations[0]
          )

          let widget =
            remoteCursorWidgetsRef.current.get(
              cursor.clientId
            )

          if (!widget) {
            widget = {
              id:
                `remote-cursor-${cursor.clientId}`,

              position: {
                lineNumber,
                column
              },

              username:
                cursor.username,

              domNode: null,

              getId() {
                return this.id
              },

              getDomNode() {
                if (!this.domNode) {
                  const node =
                    document.createElement(
                      "div"
                    )

                  node.className =
                    "remote-cursor-label"

                  node.textContent =
                    this.username

                  this.domNode =
                    node
                }

                return this.domNode
              },

              getPosition() {
                return {
                  position:
                    this.position,
                  preference: [
                    1,
                    2
                  ]
                }
              }
            }

            remoteCursorWidgetsRef.current.set(
              cursor.clientId,
              widget
            )

            editor.addContentWidget(
              widget
            )
          } else {
            widget.position = {
              lineNumber,
              column
            }

            widget.username =
              cursor.username

            if (widget.domNode) {
              widget.domNode.textContent =
                cursor.username
            }

            editor.layoutContentWidget(
              widget
            )
          }
        },

        /*
         * Remote user disconnected
         */
        (clientId) => {
          const editor =
            editorRef.current

          if (!editor) {
            return
          }

          const decoration =
            remoteCursorsRef.current.get(
              clientId
            )

          if (decoration) {
            editor.deltaDecorations(
              [decoration],
              []
            )

            remoteCursorsRef.current.delete(
              clientId
            )
          }

          const widget =
            remoteCursorWidgetsRef.current.get(
              clientId
            )

          if (widget) {
            editor.removeContentWidget(
              widget
            )

            remoteCursorWidgetsRef.current.delete(
              clientId
            )
          }

          const selection =
            remoteSelectionsRef.current.get(
              clientId
            )

          if (selection) {
            editor.deltaDecorations(
              [selection],
              []
            )

            remoteSelectionsRef.current.delete(
              clientId
            )
          }
        },

        /*
         * Remote selection
         */
        (selection) => {
          if (
            selection.clientId ===
            provider.clientId
          ) {
            return
          }

          const editor =
            editorRef.current

          if (!editor) {
            return
          }

          const model =
            editor.getModel()

          if (!model) {
            return
          }

          const clientId =
            selection.clientId

          const remoteSelection =
            selection.selection

          const oldDecoration =
            remoteSelectionsRef.current.get(
              clientId
            )

          if (oldDecoration) {
            editor.deltaDecorations(
              [oldDecoration],
              []
            )

            remoteSelectionsRef.current.delete(
              clientId
            )
          }

          if (!remoteSelection) {
            return
          }

          const startLineNumber =
            Math.max(
              1,
              Math.min(
                remoteSelection.startLineNumber,
                model.getLineCount()
              )
            )

          const endLineNumber =
            Math.max(
              startLineNumber,
              Math.min(
                remoteSelection.endLineNumber,
                model.getLineCount()
              )
            )

          const startColumn =
            Math.max(
              1,
              Math.min(
                remoteSelection.startColumn,
                model.getLineMaxColumn(
                  startLineNumber
                )
              )
            )

          const endColumn =
            Math.max(
              1,
              Math.min(
                remoteSelection.endColumn,
                model.getLineMaxColumn(
                  endLineNumber
                )
              )
            )

          const decorations =
            editor.deltaDecorations(
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
                    className:
                      "remote-selection"
                  }
                }
              ]
            )

          remoteSelectionsRef.current.set(
            clientId,
            decorations[0]
          )
        },

        /*
         * Connection state
         */
        (state) => {
          setConnectionState(state)
        },

        /*
         * Document synchronization completed
         */
        () => {
          setDocumentReady(true)
        }
      )

    providerRef.current =
      provider

    return () => {
      provider.disconnect()

      providerRef.current =
        null

      const editor =
        editorRef.current

      if (editor) {
        const decorations = [
          ...remoteCursorsRef.current.values()
        ]

        editor.deltaDecorations(
          decorations,
          []
        )

        for (
          const widget of
          remoteCursorWidgetsRef.current.values()
        ) {
          editor.removeContentWidget(
            widget
          )
        }

        const selectionDecorations = [
          ...remoteSelectionsRef.current.values()
        ]

        editor.deltaDecorations(
          selectionDecorations,
          []
        )
      }

      remoteCursorsRef.current.clear()
      remoteCursorWidgetsRef.current.clear()
      remoteSelectionsRef.current.clear()
    }
  }, [
    joined,
    username,
    room,
    ydoc
  ])

  /*
   * Shared language metadata.
   */
  useEffect(() => {
    const handleLanguageChange =
      () => {
        const sharedLanguage =
          ymetadata.get("language")

        if (
          typeof sharedLanguage ===
          "string"
        ) {
          setLanguage(
            sharedLanguage
          )
        }
      }

    if (
      !ymetadata.has("language")
    ) {
      ymetadata.set(
        "language",
        "javascript"
      )
    }

    handleLanguageChange()

    ymetadata.observe(
      handleLanguageChange
    )

    return () => {
      ymetadata.unobserve(
        handleLanguageChange
      )
    }
  }, [ymetadata])

  /*
   * Connection timeout.
   */
  useEffect(() => {
    if (!joined) {
      setConnectionTimedOut(false)

      if (
        connectionTimeoutRef.current
      ) {
        clearTimeout(
          connectionTimeoutRef.current
        )

        connectionTimeoutRef.current =
          null
      }

      return
    }

    setConnectionTimedOut(false)

    connectionTimeoutRef.current =
      setTimeout(() => {
        setConnectionTimedOut(true)

        connectionTimeoutRef.current =
          null
      }, 15000)

    return () => {
      if (
        connectionTimeoutRef.current
      ) {
        clearTimeout(
          connectionTimeoutRef.current
        )

        connectionTimeoutRef.current =
          null
      }
    }
  }, [joined])

  /*
   * Stop timeout once connected.
   */
  useEffect(() => {
    if (
      connectionState !==
      "CONNECTED"
    ) {
      return
    }

    setConnectionTimedOut(false)

    if (
      connectionTimeoutRef.current
    ) {
      clearTimeout(
        connectionTimeoutRef.current
      )

      connectionTimeoutRef.current =
        null
    }
  }, [connectionState])

  /*
   * Xterm terminal initialization.
   */
  useEffect(() => {
    if (
      !terminalOpen ||
      !terminalContainerRef.current
    ) {
      return
    }

    const terminal =
      new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily:
          "Consolas, 'Courier New', monospace",
        convertEol: true,

        theme: {
          background: "#090d13",
          foreground: "#c9d1d9",
          cursor: "#58a6ff",
          cursorAccent:
            "#090d13",
          selectionBackground:
            "#1f6feb40"
        },

        scrollback: 5000,
        allowTransparency: false
      })

    terminal.open(
      terminalContainerRef.current
    )

    terminalRef.current =
      terminal

    const protocol =
      window.location.protocol ===
      "https:"
        ? "wss:"
        : "ws:"

    const clientId =
      providerRef.current?.clientId ||
      ""

    const socket =
      new WebSocket(
        `${protocol}//${window.location.hostname}:8080/ws/terminal?room=${encodeURIComponent(
          room
        )}&username=${encodeURIComponent(
          username
        )}&clientId=${encodeURIComponent(
          clientId
        )}`
      )

    socket.binaryType =
      "arraybuffer"

    terminalSocketRef.current =
      socket

    socket.onopen = () => {
      console.log(
        "Terminal WebSocket connected"
      )
    }

    socket.onmessage =
      (event) => {
        let text = ""
        if (
          typeof event.data ===
          "string"
        ) {
          text = event.data
        } else if (
          event.data instanceof
          ArrayBuffer
        ) {
          text = new TextDecoder().decode(
            new Uint8Array(
              event.data
            )
          )
        }

        terminal.write(text)
        setOutputLogs((prev) => prev + text)

        if (text.includes("Execution Finished") || text.includes("exited with code") || text.includes("$ ")) {
          setIsRunning(false)
        }

        // Check for compiler runtime error markers
        const runtimeMarkers = parseCompilerOutput(text, language)
        if (runtimeMarkers.length > 0 && editorRef.current && monacoRef.current) {
          const model = editorRef.current.getModel()
          if (model) {
            const currentMarkers = monacoRef.current.editor.getModelMarkers({ resource: model.uri })
            const combined = [...currentMarkers, ...runtimeMarkers]
            monacoRef.current.editor.setModelMarkers(model, "syncstream-diagnostics", combined)
            setDiagnostics(combined)
          }
        }
      }

    socket.onerror =
      (error) => {
        console.error(
          "Terminal WebSocket error",
          error
        )

        terminal.write(
          "\r\n[Terminal connection error]\r\n"
        )
        setIsRunning(false)
      }

    socket.onclose = () => {
      terminal.write(
        "\r\n[Terminal disconnected]\r\n"
      )
      setIsRunning(false)
    }

    let command = ""

    const dataDisposable =
      terminal.onData(
        (data) => {
          if (
            data === "\r" ||
            data === "\n"
          ) {
            terminal.write(
              "\r\n"
            )

            if (
              command.trim()
            ) {
              if (
                socket.readyState ===
                WebSocket.OPEN
              ) {
                socket.send(
                  command
                )
              }
            } else {
              terminal.write(
                "$ "
              )
            }

            command = ""

            return
          }

          if (
            data === "\u007F"
          ) {
            if (
              command.length > 0
            ) {
              command =
                command.slice(
                  0,
                  -1
                )

              terminal.write(
                "\b \b"
              )
            }

            return
          }

          if (
            data === "\u0003"
          ) {
            command = ""

            if (
              socket.readyState ===
              WebSocket.OPEN
            ) {
              socket.send("\u0003")
            }

            terminal.write(
              "^C\r\n"
            )
            setIsRunning(false)

            return
          }

          if (
            data >= " " &&
            data <= "~"
          ) {
            command += data

            terminal.write(
              data
            )
          }
        }
      )

    const resizeTerminal =
      () => {
        const container =
          terminalContainerRef.current

        if (!container) {
          return
        }

        const rect =
          container.getBoundingClientRect()

        if (
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          return
        }

        const cellWidth = 8.0
        const cellHeight = 16.5

        const cols =
          Math.max(
            2,
            Math.floor(
              rect.width /
              cellWidth
            )
          )

        const rows =
          Math.max(
            1,
            Math.floor(
              rect.height /
              cellHeight
            )
          )

        terminal.resize(
          cols,
          rows
        )
      }

    terminalResizeObserverRef.current =
      new ResizeObserver(
        resizeTerminal
      )

    terminalResizeObserverRef.current.observe(
      terminalContainerRef.current
    )

    requestAnimationFrame(
      resizeTerminal
    )

    return () => {
      dataDisposable.dispose()

      if (
        terminalResizeObserverRef.current
      ) {
        terminalResizeObserverRef.current.disconnect()

        terminalResizeObserverRef.current =
          null
      }

      if (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      ) {
        socket.close()
      }

      terminalSocketRef.current =
        null

      terminal.dispose()

      terminalRef.current =
        null
    }
  }, [
    terminalOpen,
    room,
    username,
    language
  ])

  /*
   * Focus terminal when opened.
   */
  useEffect(() => {
    if (
      terminalOpen &&
      activeBottomTab === "terminal" &&
      terminalRef.current
    ) {
      requestAnimationFrame(() => {
        terminalRef.current?.focus()
      })
    }
  }, [terminalOpen, activeBottomTab])

  /*
   * Keep terminal sized correctly.
   */
  useEffect(() => {
    if (
      !terminalOpen ||
      !terminalRef.current
    ) {
      return
    }

    const timer =
      setTimeout(() => {
        window.dispatchEvent(
          new Event("resize")
        )
      }, 0)

    return () => {
      clearTimeout(timer)
    }
  }, [
    terminalHeight,
    terminalMaximized,
    activeBottomTab
  ])

  /*
   * Execute code in runner via clean shell command.
   */
  const handleRunCode = useCallback(() => {
    if (!editorRef.current) {
      return
    }

    const code = editorRef.current.getValue()

    if (!terminalOpen) {
      setTerminalOpen(true)
    }
    setActiveBottomTab("terminal")
    setIsRunning(true)

    const cmd = getExecutionCommand(language, code)

    const sendCmd = () => {
      if (
        terminalSocketRef.current &&
        terminalSocketRef.current.readyState === WebSocket.OPEN
      ) {
        terminalSocketRef.current.send(cmd)
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
  }, [editorRef, terminalOpen, language])

  /*
   * Keyboard shortcuts: Ctrl+` (toggle terminal) and Ctrl+Enter / F5 (Run).
   */
  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          event.ctrlKey &&
          event.key === "`"
        ) {
          event.preventDefault()

          setTerminalOpen(
            (current) => !current
          )
        } else if (
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter"
        ) {
          event.preventDefault()
          handleRunCode()
        } else if (event.key === "F5") {
          event.preventDefault()
          handleRunCode()
        }
      }

    window.addEventListener(
      "keydown",
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      )
    }
  }, [handleRunCode])

  /*
   * Terminal resizing.
   */
  useEffect(() => {
    if (
      !terminalOpen ||
      terminalMaximized
    ) {
      return
    }

    const handleResize =
      (event) => {
        const startY =
          event.clientY

        const startHeight =
          terminalHeight

        document.body.style.cursor =
          "ns-resize"

        document.body.style.userSelect =
          "none"

        const onMove =
          (moveEvent) => {
            const delta =
              startY -
              moveEvent.clientY

            const maxHeight =
              Math.floor(
                window.innerHeight *
                0.75
              )

            const nextHeight =
              Math.max(
                140,
                Math.min(
                  maxHeight,
                  startHeight +
                    delta
                )
              )

            setTerminalHeight(
              nextHeight
            )
          }

        const onUp =
          () => {
            document.body.style.cursor =
              ""

            document.body.style.userSelect =
              ""

            window.removeEventListener(
              "mousemove",
              onMove
            )

            window.removeEventListener(
              "mouseup",
              onUp
            )
          }

        window.addEventListener(
          "mousemove",
          onMove
        )

        window.addEventListener(
          "mouseup",
          onUp
        )
      }

    const handle =
      document.querySelector(
        ".terminal-resize-handle"
      )

    if (!handle) {
      return
    }

    handle.addEventListener(
      "mousedown",
      handleResize
    )

    return () => {
      handle.removeEventListener(
        "mousedown",
        handleResize
      )
    }
  }, [
    terminalOpen,
    terminalMaximized,
    terminalHeight
  ])

  /*
   * Monaco editor setup.
   */
  const handleMount =
    (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      new MonacoBinding(
        yText,
        editor.getModel(),
        new Set([editor])
      )

      editor.onDidChangeCursorPosition(
        (event) => {
          const position = event.position
          setCursorPos({
            lineNumber: position.lineNumber,
            column: position.column
          })

          providerRef.current?.sendCursorPosition(
            position.lineNumber,
            position.column
          )
        }
      )

      editor.onDidChangeCursorSelection(
        (event) => {
          const selection =
            event.selection

          const hasSelection =
            selection.startLineNumber !==
              selection.endLineNumber ||
            selection.startColumn !==
              selection.endColumn

          providerRef.current?.sendSelection(
            hasSelection
              ? {
                  startLineNumber:
                    selection.startLineNumber,

                  startColumn:
                    selection.startColumn,

                  endLineNumber:
                    selection.endLineNumber,

                  endColumn:
                    selection.endColumn
                }
              : null
          )
        }
      )

      editor.onDidChangeModelContent(() => {
        if (validationTimerRef.current) {
          clearTimeout(validationTimerRef.current)
        }

        validationTimerRef.current = setTimeout(() => {
          validateCodeRef.current?.()
        }, 200)
      })

      setTimeout(() => {
        validateCodeRef.current?.()
      }, 250)
    }

  const handleProblemClick = (problem) => {
    if (!editorRef.current) {
      return
    }

    editorRef.current.revealLineInCenter(problem.startLineNumber)
    editorRef.current.setPosition({
      lineNumber: problem.startLineNumber,
      column: problem.startColumn
    })
    editorRef.current.focus()
  }

  const handleInsertTemplate = () => {
    const starter = LANGUAGE_STARTERS[language]
    if (!starter || !editorRef.current) {
      return
    }

    ydoc.transact(() => {
      yText.delete(0, yText.length)
      yText.insert(0, starter)
    })
  }

  const handleJoin =
    async (event) => {
      event.preventDefault()

      setJoinError("")
      setJoinLoading(true)

      const form =
        event.currentTarget

      const name =
        form.elements.username.value.trim()

      const roomInput =
        form.elements.room?.value.trim()

      const roomId =
        roomInput ||
        room.trim()

      if (!name) {
        setJoinError(
          "Please enter a username."
        )

        setJoinLoading(false)
        return
      }

      if (!roomId) {
        setJoinError(
          "Please enter a room ID."
        )

        setJoinLoading(false)
        return
      }

      try {
        const response =
          await fetch(
            `http://localhost:8080/api/rooms/${encodeURIComponent(
              roomId
            )}`,
            {
              method: "GET",
              headers: {
                Accept:
                  "application/json, text/plain, */*"
              }
            }
          )

        if (!response.ok) {
          if (
            response.status ===
            404
          ) {
            setJoinError(
              "Room not found. Check the room ID and try again."
            )
          } else {
            setJoinError(
              "Unable to join the room. Please try again."
            )
          }

          return
        }

        setJoinError("")

        setUsername(name)
        setRoom(roomId)
        setDocumentReady(false)
        setJoined(true)

        const params =
          new URLSearchParams(
            window.location.search
          )

        params.set(
          "room",
          roomId
        )

        params.set(
          "username",
          name
        )

        window.history.pushState(
          {},
          "",
          `?${params.toString()}`
        )
      } catch (error) {
        console.error(
          "Failed to join room",
          error
        )

        setJoinError(
          "Unable to connect to the server. Please try again."
        )
      } finally {
        setJoinLoading(false)
      }
    }

  const handleCreateRoom =
    async (event) => {
      event.preventDefault()

      setCreateError("")
      setCreateLoading(true)

      const form =
        event.currentTarget

      const name =
        form.elements.username.value.trim()

      if (!name) {
        setCreateError(
          "Please enter a username."
        )

        setCreateLoading(false)
        return
      }

      try {
        const response =
          await fetch(
            "http://localhost:8080/api/rooms",
            {
              method: "POST"
            }
          )

        if (!response.ok) {
          throw new Error(
            `Failed to create room: ${response.status}`
          )
        }

        const roomId =
          await response.text()

        if (!roomId.trim()) {
          throw new Error(
            "Server returned an empty room ID"
          )
        }

        const cleanRoomId =
          roomId.trim()

        setCreateError("")

        setUsername(name)
        setRoom(cleanRoomId)
        setDocumentReady(false)
        setJoined(true)

        const params =
          new URLSearchParams(
            window.location.search
          )

        params.set(
          "room",
          cleanRoomId
        )

        params.set(
          "username",
          name
        )

        window.history.pushState(
          {},
          "",
          `?${params.toString()}`
        )
      } catch (error) {
        console.error(
          "Failed to create room",
          error
        )

        setCreateError(
          "Unable to create room. Please try again."
        )
      } finally {
        setCreateLoading(false)
      }
    }

  const handleShareRoom =
    async () => {
      try {
        await navigator.clipboard.writeText(
          window.location.href
        )

        setShareMessage(
          "Room link copied"
        )

        setTimeout(() => {
          setShareMessage("")
        }, 2000)
      } catch (error) {
        console.error(
          "Failed to copy room link",
          error
        )

        setShareMessage(
          "Failed to copy link"
        )
      }
    }

  const handleLeaveRoom =
    () => {
      setJoined(false)
      setUsername("")
      setUsers([])
      setShareMessage("")
      setDocumentReady(false)
      setJoinError("")
      setCreateError("")
      setTerminalOpen(false)
      setTerminalMaximized(false)
      setRoom("")

      window.history.pushState(
        {},
        "",
        window.location.pathname
      )
    }

  const errorsCount = diagnostics.filter(
    (d) => d.severity === SEVERITY.ERROR
  ).length

  const warningsCount = diagnostics.filter(
    (d) => d.severity === SEVERITY.WARNING
  ).length

  /*
   * Join/create screen.
   */
  if (!joined) {
    const hasRoomFromUrl =
      Boolean(room.trim())

    return (
      <main className="h-screen w-full bg-[#090d13] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-lg p-6 shadow-xl">

          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <h1 className="text-xl font-bold text-[#f0f6fc]">
              SyncStream
            </h1>
          </div>

          <p className="text-[#8b949e] text-center mb-6 text-xs">
            Collaborative IDE & Code Runner
          </p>

          {hasRoomFromUrl ? (
            <form
              onSubmit={handleJoin}
              className="flex flex-col gap-3"
            >
              <div className="p-2.5 rounded bg-[#0d1117] border border-[#30363d] text-[#8b949e] text-xs">
                Room: <span className="text-[#58a6ff] font-mono font-medium">{room}</span>
              </div>

              <input
                type="text"
                name="username"
                placeholder="Username"
                className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff]"
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
                {joinLoading
                  ? "Joining..."
                  : "Join Room"}
              </button>
            </form>
          ) : (
            <>
              <form
                onSubmit={handleCreateRoom}
                className="flex flex-col gap-3"
              >
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff]"
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
                  {createLoading
                    ? "Creating Room..."
                    : "Create New Room"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-4">
                <div className="h-px bg-[#30363d] flex-1" />
                <span className="text-[#8b949e] text-[10px] uppercase font-semibold">
                  OR
                </span>
                <div className="h-px bg-[#30363d] flex-1" />
              </div>

              <form
                onSubmit={handleJoin}
                className="flex flex-col gap-3"
              >
                <input
                  type="text"
                  name="room"
                  placeholder="Room ID"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] font-mono"
                  required
                />

                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  className="p-2.5 rounded bg-[#0d1117] text-[#c9d1d9] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff]"
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
                  {joinLoading
                    ? "Joining..."
                    : "Join Room"}
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

      {/* Top Navbar */}
      <header className="h-11 min-h-[44px] bg-[#161b22] border-b border-[#30363d] px-3 flex items-center justify-between select-none">

        {/* Left: Brand & Room ID */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm font-semibold text-[#f0f6fc]">
              SyncStream
            </span>
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

        {/* Center: Language & Run Actions */}
        <div className="flex items-center gap-2">

          <select
            id="language"
            value={language}
            onChange={(event) => {
              ymetadata.set("language", event.target.value)
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
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="sql">SQL</option>
          </select>

          <button
            type="button"
            onClick={handleInsertTemplate}
            title="Insert boilerplate template for selected language"
            className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition"
          >
            Template
          </button>

          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            title="Run Code (Ctrl+Enter / F5)"
            className="btn-primary-run"
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

        </div>

        {/* Right: User Presence, Share & Leave */}
        <div className="flex items-center gap-2">

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === "CONNECTED"
                  ? "bg-[#3fb950]"
                  : "bg-[#d29922]"
              }`}
            />
            <span className="text-[#8b949e]">
              {username}
            </span>
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
            onClick={() => setTerminalOpen((c) => !c)}
            className="px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs border border-[#30363d] transition"
          >
            {terminalOpen ? "Hide Console" : "Console"}
          </button>

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="px-2.5 py-1 rounded hover:bg-[#f8514926] text-[#f85149] text-xs border border-[#f8514940] transition"
          >
            Leave
          </button>

        </div>
      </header>

      {shareMessage && (
        <div className="absolute top-14 right-4 z-40 px-3 py-1.5 rounded bg-[#1f6feb] text-white text-xs shadow-lg animate-fade">
          ✓ {shareMessage}
        </div>
      )}

      {/* Main Body */}
      <div className="flex flex-1 min-h-0">

        {/* Left Sidebar: Collaborators */}
        <aside className="w-48 bg-[#0d1117] border-r border-[#30363d] flex flex-col select-none">
          <div className="px-3 py-2 border-b border-[#21262d] flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8b949e]">
              Collaborators ({users.length})
            </span>
          </div>

          <div className="p-2 flex-1 overflow-y-auto flex flex-col gap-0.5">
            {users.map((user) => (
              <div
                key={user.clientId}
                className="sidebar-user-item"
              >
                <span className="w-2 h-2 rounded-full bg-[#3fb950] flex-shrink-0" />
                <span className="truncate flex-1 text-xs">
                  {user.username}
                </span>
                {user.username === username && (
                  <span className="text-[10px] text-[#8b949e]">
                    You
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="p-2 border-t border-[#21262d] text-[10px] text-[#8b949e] text-center">
            Shortcut: <kbd className="px-1 py-0.5 bg-[#161b22] text-[#c9d1d9] rounded border border-[#30363d] font-mono">Ctrl+Enter</kbd>
          </div>
        </aside>

        {/* Center Code Area */}
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

              {/* Monaco Editor */}
              <div className={terminalOpen ? "flex-1 min-h-0" : "flex-1 min-h-0"}>
                <Editor
                  height="100%"
                  language={language}
                  defaultValue=""
                  theme="vs-dark"
                  onMount={handleMount}
                  options={{
                    automaticLayout: true,
                    minimap: {
                      enabled: false
                    },
                    scrollBeyondLastLine: false,
                    fontSize: 13,
                    fontFamily: "Consolas, 'Courier New', monospace",
                    tabSize: 4,
                    padding: {
                      top: 8
                    }
                  }}
                />
              </div>

              {/* Status Bar */}
              <div className="editor-status-bar">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => {
                      setTerminalOpen(true)
                      setActiveBottomTab("problems")
                    }}
                    className="flex items-center gap-1.5 cursor-pointer hover:text-[#c9d1d9]"
                  >
                    <span className="text-[#f85149]">⊗ {errorsCount}</span>
                    <span className="text-[#d29922]">⚠ {warningsCount}</span>
                  </div>

                  <span>Ln {cursorPos.lineNumber}, Col {cursorPos.column}</span>
                  <span>UTF-8</span>
                  <span>Spaces: 4</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="capitalize">{language}</span>
                  <span>SyncStream</span>
                </div>
              </div>

              {/* Bottom Dock Panel */}
              {terminalOpen && (
                <div
                  className="terminal-panel"
                  style={{
                    height:
                      terminalMaximized
                        ? "80%"
                        : `${terminalHeight}px`
                  }}
                >
                  {!terminalMaximized && (
                    <div
                      className="terminal-resize-handle"
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
                          <span className="dock-badge dock-badge-error">
                            {errorsCount}
                          </span>
                        )}
                        {warningsCount > 0 && errorsCount === 0 && (
                          <span className="dock-badge dock-badge-warning">
                            {warningsCount}
                          </span>
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
                          className="text-[11px] px-2 py-0.5 rounded text-[#8b949e] hover:text-[#c9d1d9] bg-[#21262d]"
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
                        {terminalMaximized ? "◱" : "□"}
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
                        ✕
                      </button>

                    </div>
                  </div>

                  {/* Tab 1: Terminal */}
                  <div
                    ref={terminalContainerRef}
                    className="terminal-container"
                    style={{
                      display:
                        activeBottomTab === "terminal"
                          ? "block"
                          : "none"
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
                            <span
                              className={
                                prob.severity === SEVERITY.ERROR
                                  ? "text-[#f85149] font-bold"
                                  : "text-[#d29922] font-bold"
                              }
                            >
                              {prob.severity === SEVERITY.ERROR ? "⊗" : "⚠"}
                            </span>

                            <span className="problem-msg">
                              {prob.message}
                            </span>

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

    </main>
  )
}

export default App