import "./App.css"
import "@xterm/xterm/css/xterm.css"

import { Editor } from "@monaco-editor/react"
import { Terminal } from "@xterm/xterm"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from "react"
import * as Y from "yjs"

import { SpringWebSocketProvider } from "../yjs/SpringWebSocketProvider"

function App() {
  const editorRef = useRef(null)
  const providerRef = useRef(null)

  const terminalRef = useRef(null)
  const terminalContainerRef = useRef(null)
  const terminalSocketRef = useRef(null)
  const terminalResizeObserverRef = useRef(null)

  const connectionTimeoutRef = useRef(null)

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
    useState(false)

  const [terminalHeight, setTerminalHeight] =
    useState(260)

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
   * Xterm terminal.
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
        fontSize: 14,
        fontFamily:
          "Consolas, 'Courier New', monospace",
        convertEol: true,

        theme: {
          background: "#0a0a0a",
          foreground: "#d4d4d4",
          cursor: "#ffffff",
          cursorAccent:
            "#0a0a0a",
          selectionBackground:
            "#264f78"
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
        if (
          typeof event.data ===
          "string"
        ) {
          terminal.write(
            event.data
          )

          return
        }

        if (
          event.data instanceof
          ArrayBuffer
        ) {
          terminal.write(
            new TextDecoder().decode(
              new Uint8Array(
                event.data
              )
            )
          )
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
      }

    socket.onclose = () => {
      terminal.write(
        "\r\n[Terminal disconnected]\r\n"
      )
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

            terminal.write(
              "^C\r\n$ "
            )

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

        const cellWidth = 8.4
        const cellHeight = 17

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
    username
  ])

  /*
   * Focus terminal when opened.
   */
  useEffect(() => {
    if (
      terminalOpen &&
      terminalRef.current
    ) {
      requestAnimationFrame(() => {
        terminalRef.current?.focus()
      })
    }
  }, [terminalOpen])

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
    terminalMaximized
  ])

  /*
   * Terminal keyboard shortcuts.
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
  }, [])

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
                0.7
              )

            const nextHeight =
              Math.max(
                180,
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
    (editor) => {
      editorRef.current =
        editor

      new MonacoBinding(
        yText,
        editor.getModel(),
        new Set([editor])
      )

      editor.onDidChangeCursorPosition(
        (event) => {
          const position =
            event.position

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
    }

  /*
   * Join room.
   */
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

  /*
   * Create room.
   */
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

  /*
   * Share room.
   */
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

  /*
   * Leave room.
   */
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

  /*
   * Connection status display.
   */
  const getConnectionStatus =
    () => {
      switch (
        connectionState
      ) {
        case "CONNECTED":
          return {
            label:
              "Connected",
            className:
              "bg-green-500/15 text-green-400"
          }

        case "CONNECTING":
          return {
            label:
              connectionTimedOut
                ? "Connection unavailable"
                : "Connecting...",
            className:
              connectionTimedOut
                ? "bg-red-500/15 text-red-400"
                : "bg-yellow-500/15 text-yellow-400"
          }

        case "RECONNECTING":
          return {
            label:
              connectionTimedOut
                ? "Connection unavailable"
                : "Reconnecting...",
            className:
              connectionTimedOut
                ? "bg-red-500/15 text-red-400"
                : "bg-yellow-500/15 text-yellow-400"
          }

        case "DISCONNECTED":
          return {
            label:
              "Disconnected",
            className:
              "bg-red-500/15 text-red-400"
          }

        default:
          return {
            label:
              connectionState,
            className:
              "bg-gray-800 text-gray-400"
          }
      }
    }

  /*
   * Join/create screen.
   */
  if (!joined) {
    const hasRoomFromUrl =
      Boolean(room.trim())

    return (
      <main className="h-screen w-full bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-neutral-900 rounded-xl p-6 shadow-xl">

          <h1 className="text-3xl font-bold text-white text-center">
            SyncStream
          </h1>

          <p className="text-gray-400 text-center mt-2 mb-6">
            Real-time collaborative code editor
          </p>

          {hasRoomFromUrl ? (
            <form
              onSubmit={handleJoin}
              className="flex flex-col gap-4"
            >
              <div className="p-3 rounded-lg bg-gray-800 text-gray-300">
                Joining room:{" "}
                <span className="text-white font-semibold">
                  {room}
                </span>
              </div>

              <input
                type="text"
                name="username"
                placeholder="Enter your username"
                className="p-3 rounded-lg bg-gray-800 text-white outline-none"
                required
              />

              {joinError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joinLoading}
                className="p-3 rounded-lg bg-gray-800 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading
                  ? "Joining Room..."
                  : "Join Room"}
              </button>
            </form>
          ) : (
            <>
              <form
                onSubmit={handleCreateRoom}
                className="flex flex-col gap-4"
              >
                <input
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  className="p-3 rounded-lg bg-gray-800 text-white outline-none"
                  required
                />

                {createError && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                    {createError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={createLoading}
                  className="p-3 rounded-lg bg-amber-50 text-gray-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading
                    ? "Creating Room..."
                    : "Create Room"}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-gray-700 flex-1" />

                <span className="text-gray-500 text-sm">
                  OR
                </span>

                <div className="h-px bg-gray-700 flex-1" />
              </div>

              <form
                onSubmit={handleJoin}
                className="flex flex-col gap-4"
              >
                <input
                  type="text"
                  name="room"
                  placeholder="Enter room ID"
                  className="p-3 rounded-lg bg-gray-800 text-white outline-none"
                  required
                />

                <input
                  type="text"
                  name="username"
                  placeholder="Enter your username"
                  className="p-3 rounded-lg bg-gray-800 text-white outline-none"
                  required
                />

                {joinError && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                    {joinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={joinLoading}
                  className="p-3 rounded-lg bg-gray-800 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joinLoading
                    ? "Joining Room..."
                    : "Join Room"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    )
  }

  const connectionStatus =
    getConnectionStatus()

  return (
    <main className="h-screen w-full bg-gray-950 flex flex-col gap-3 p-4">

      <header className="w-full bg-neutral-900 rounded-lg px-4 py-3 flex items-center justify-between">

        <div className="flex items-center gap-4">

          <div>
            <h1 className="text-lg font-bold text-white">
              SyncStream
            </h1>

            <p className="text-sm text-gray-400">
              Room: {room}
            </p>
          </div>

          <div className="text-sm text-gray-400">
            User:{" "}
            <span className="text-white">
              {username}
            </span>
          </div>

        </div>

        <div className="flex items-center gap-3">

          <div
            className={`px-3 py-1 rounded text-sm font-medium ${connectionStatus.className}`}
          >
            <span className="mr-2">
              ●
            </span>

            {connectionStatus.label}
          </div>

          <button
            type="button"
            onClick={handleShareRoom}
            className="px-3 py-1 rounded bg-gray-800 text-white text-sm hover:bg-gray-700"
          >
            Share Room
          </button>

          <button
            type="button"
            onClick={() =>
              setTerminalOpen(
                (current) =>
                  !current
              )
            }
            className="px-3 py-1 rounded bg-gray-800 text-white text-sm hover:bg-gray-700"
          >
            {terminalOpen
              ? "Hide Terminal"
              : "Terminal"}
          </button>

          <button
            type="button"
            onClick={
              handleLeaveRoom
            }
            className="px-3 py-1 rounded bg-red-500 text-white text-sm hover:bg-red-600"
          >
            Leave
          </button>

        </div>
      </header>

      {shareMessage && (
        <div className="absolute top-20 right-4 z-20 px-3 py-2 rounded bg-gray-800 text-white text-sm">
          {shareMessage}
        </div>
      )}

      <div className="flex flex-1 gap-4 min-h-0">

        <aside className="h-full w-1/4 bg-amber-50 rounded-lg overflow-hidden">

          <h2 className="text-2xl font-bold p-4 border-b border-gray-300">
            Users
          </h2>

          <ul className="p-4 overflow-y-auto">
            {users.map(
              (user) => (
                <li
                  key={
                    user.clientId
                  }
                  className="p-2 bg-gray-800 text-white rounded mb-2 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />

                  <span className="text-white">
                    {user.username}
                  </span>

                  {user.username ===
                    username && (
                    <span className="ml-auto text-xs text-gray-400">
                      You
                    </span>
                  )}
                </li>
              )
            )}
          </ul>

        </aside>

        <section className="flex-1 bg-neutral-800 rounded-lg overflow-hidden flex flex-col">

          {connectionState !==
            "CONNECTED" && (
            <div className="px-4 py-2 bg-gray-900 text-gray-400 text-sm">

              {connectionTimedOut &&
                "Unable to connect to the room. Retrying..."}

              {!connectionTimedOut &&
                connectionState ===
                  "CONNECTING" &&
                "Connecting to the room..."}

              {!connectionTimedOut &&
                connectionState ===
                  "RECONNECTING" &&
                "Connection lost. Reconnecting..."}

              {!connectionTimedOut &&
                connectionState ===
                  "DISCONNECTED" &&
                "Disconnected from the room."}

            </div>
          )}

          {!documentReady &&
            connectionState ===
              "CONNECTED" && (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              Syncing document...
            </div>
          )}

          {documentReady && (
            <div className="flex-1 min-h-0 flex flex-col">

              <div className="px-3 py-2 bg-neutral-900 border-b border-gray-700 flex items-center justify-between">

                <label
                  htmlFor="language"
                  className="text-sm text-gray-400"
                >
                  Language
                </label>

                <select
                  id="language"
                  value={language}
                  onChange={(event) => {
                    ymetadata.set(
                      "language",
                      event.target.value
                    )
                  }}
                  className="bg-gray-800 text-white text-sm rounded px-2 py-1 outline-none"
                >
                  <option value="javascript">
                    JavaScript
                  </option>

                  <option value="typescript">
                    TypeScript
                  </option>

                  <option value="java">
                    Java
                  </option>

                  <option value="python">
                    Python
                  </option>

                  <option value="cpp">
                    C++
                  </option>

                  <option value="csharp">
                    C#
                  </option>

                  <option value="go">
                    Go
                  </option>

                  <option value="rust">
                    Rust
                  </option>

                  <option value="html">
                    HTML
                  </option>

                  <option value="css">
                    CSS
                  </option>

                  <option value="json">
                    JSON
                  </option>

                  <option value="sql">
                    SQL
                  </option>
                </select>

              </div>

              <div
                className={
                  terminalOpen
                    ? "min-h-0 flex-1"
                    : "flex-1 min-h-0"
                }
              >
                <Editor
                  height="100%"
                  language={
                    language
                  }
                  defaultValue=""
                  theme="vs-dark"
                  onMount={
                    handleMount
                  }
                  options={{
                    automaticLayout:
                      true,
                    minimap: {
                      enabled: true
                    },
                    scrollBeyondLastLine:
                      false,
                    fontSize: 14,
                    padding: {
                      top: 8
                    }
                  }}
                />
              </div>

              {terminalOpen && (
                <div
                  className="terminal-panel"
                  style={{
                    height:
                      terminalMaximized
                        ? "70%"
                        : `${terminalHeight}px`
                  }}
                >
                  {!terminalMaximized && (
                    <div
                      className="terminal-resize-handle"
                      title="Drag to resize terminal"
                    />
                  )}

                  <div className="terminal-header">

                    <div className="terminal-title">
                      <span>
                        TERMINAL
                      </span>
                    </div>

                    <div className="terminal-actions">

                      <button
                        type="button"
                        className="terminal-action"
                        title={
                          terminalMaximized
                            ? "Restore terminal"
                            : "Maximize terminal"
                        }
                        onClick={() =>
                          setTerminalMaximized(
                            (current) =>
                              !current
                          )
                        }
                      >
                        {terminalMaximized
                          ? "▣"
                          : "□"}
                      </button>

                      <button
                        type="button"
                        className="terminal-action"
                        title="Close terminal"
                        onClick={() => {
                          setTerminalOpen(
                            false
                          )

                          setTerminalMaximized(
                            false
                          )
                        }}
                      >
                        ×
                      </button>

                    </div>
                  </div>

                  <div
                    ref={
                      terminalContainerRef
                    }
                    className="terminal-container"
                  />
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