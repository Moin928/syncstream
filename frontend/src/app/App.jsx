import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from "react"
import * as Y from "yjs"
import { SpringWebSocketProvider } from "../yjs/SpringWebSocketProvider"

function App() {
  const editorRef = useRef(null)
  const providerRef = useRef(null)
  const connectionTimeoutRef = useRef(null)
  const remoteCursorsRef = useRef(new Map())
  const remoteCursorWidgetsRef = useRef(new Map())
  const remoteSelectionsRef = useRef(new Map())

  const [username, setUsername] = useState(() => {
    return new URLSearchParams(window.location.search).get("username") || ""
  })
  const [users, setUsers] = useState([])

  const [room, setRoom] = useState(
    new URLSearchParams(window.location.search).get("room") || ""
  )

  const [connectionState, setConnectionState] = useState("CONNECTING")
  const [connectionTimedOut, setConnectionTimedOut] = useState(false)
  const [documentReady, setDocumentReady] = useState(false)

  const [language, setLanguage] = useState("javascript")

  const [joined, setJoined] = useState(() => {
    const params = new URLSearchParams(window.location.search)

    return Boolean(
      params.get("room") &&
      params.get("username")
    )
  })
  const [shareMessage, setShareMessage] = useState("")

  const [joinError, setJoinError] = useState("")
  const [createError, setCreateError] = useState("")

  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)

  // creates the shared Yjs document used by the editor
  const ydoc = useMemo(
    () => new Y.Doc(),
    []
  )

  // stores shared room metadata such as the selected language
  const ymetadata = useMemo(
    () => ydoc.getMap("metadata"),
    [ydoc]
  )

  // stores the actual code shared between all connected users
  const yText = useMemo(
    () => ydoc.getText("monaco"),
    [ydoc]
  )

  useEffect(() => {
    if (!joined) {
      return
    }

    // creates the websocket provider once the user joins a room
    const provider = new SpringWebSocketProvider(
      room,
      ydoc,
      username,
      setUsers,

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

        // keeps remote cursor positions inside the current editor bounds
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
          // creates a small label that shows who owns the remote cursor
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

      (clientId) => {
        const editor =
          editorRef.current

        if (!editor) {
          return
        }

        // removes the cursor decoration when a user leaves
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

        // makes sure the remote selection stays inside the current document
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

      (state) => {
        setConnectionState(state)
      },

      () => {
        setDocumentReady(true)
      }
    )

    providerRef.current =
      provider

    return () => {
      // disconnects the provider and clears remote editor state
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

  useEffect(() => {
    // reads the shared language whenever another user changes it
    const handleLanguageChange = () => {
      const sharedLanguage =
        ymetadata.get("language")

      if (
        typeof sharedLanguage ===
        "string"
      ) {
        setLanguage(sharedLanguage)
      }
    }

    if (!ymetadata.has("language")) {
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

  useEffect(() => {
    if (!joined) {
      setConnectionTimedOut(false)

      if (connectionTimeoutRef.current) {
        clearTimeout(
          connectionTimeoutRef.current
        )

        connectionTimeoutRef.current =
          null
      }

      return
    }

    setConnectionTimedOut(false)

    // gives the websocket connection a limited amount of time before showing an error
    connectionTimeoutRef.current =
      setTimeout(() => {
        setConnectionTimedOut(true)
        connectionTimeoutRef.current =
          null
      }, 15000)

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(
          connectionTimeoutRef.current
        )

        connectionTimeoutRef.current =
          null
      }
    }
  }, [joined])

  useEffect(() => {
    if (
      connectionState !==
      "CONNECTED"
    ) {
      return
    }

    setConnectionTimedOut(false)

    if (connectionTimeoutRef.current) {
      clearTimeout(
        connectionTimeoutRef.current
      )

      connectionTimeoutRef.current =
        null
    }
  }, [connectionState])

  const handleMount = (editor) => {
    editorRef.current =
      editor

    // connects Monaco's text model to the shared Yjs document
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

  const handleJoin = async (event) => {
  event.preventDefault()

  setJoinError("")
  setJoinLoading(true)

  const form = event.currentTarget

  const name =
    form.elements.username.value.trim()

  const roomInput =
    form.elements.room?.value.trim()

  const roomId =
    roomInput || room.trim()

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
    // Check that the room exists before opening the WebSocket connection.
    const response =
      await fetch(
        `http://localhost:8080/api/rooms/${encodeURIComponent(roomId)}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json, text/plain, */*"
          }
        }
      )

    if (!response.ok) {
      if (response.status === 404) {
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

    params.set("room", roomId)
    params.set("username", name)

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

  const handleCreateRoom = async (event) => {
  event.preventDefault()

  setCreateError("")
  setCreateLoading(true)

  const form = event.currentTarget

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
    // Create a new room through the backend API.
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

    setCreateError("")

    setUsername(name)
    setRoom(roomId.trim())
    setDocumentReady(false)
    setJoined(true)

    const params =
      new URLSearchParams(
        window.location.search
      )

    params.set("room", roomId.trim())
    params.set("username", name)

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

  const handleShareRoom = async () => {
    try {
      // copies the current room link so it can be shared with another user
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

  const handleLeaveRoom = () => {
    setJoined(false)
    setUsername("")
    setUsers([])
    setShareMessage("")
    setDocumentReady(false)
    setJoinError("")
    setCreateError("")

    setRoom("")

    // removes the room parameter from the browser url
    window.history.pushState(
      {},
      "",
      window.location.pathname
    )
  }

  const getConnectionStatus = () => {
    switch (connectionState) {
      case "CONNECTED":
        return {
          label: "Connected",
          className:
            "bg-green-500/15 text-green-400"
        }

      case "CONNECTING":
        return {
          label: connectionTimedOut
            ? "Connection unavailable"
            : "Connecting...",

          className:
            connectionTimedOut
              ? "bg-red-500/15 text-red-400"
              : "bg-yellow-500/15 text-yellow-400"
        }

      case "RECONNECTING":
        return {
          label: connectionTimedOut
            ? "Connection unavailable"
            : "Reconnecting...",

          className:
            connectionTimedOut
              ? "bg-red-500/15 text-red-400"
              : "bg-yellow-500/15 text-yellow-400"
        }

      case "DISCONNECTED":
        return {
          label: "Disconnected",
          className:
            "bg-red-500/15 text-red-400"
        }

      default:
        return {
          label: connectionState,
          className:
            "bg-gray-800 text-gray-400"
        }
    }
  }

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
            onClick={handleLeaveRoom}
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
                  key={user.clientId}
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

              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={language}
                  defaultValue=""
                  theme="vs-dark"
                  onMount={handleMount}
                />
              </div>

            </div>
          )}

        </section>

      </div>
    </main>
  )
}

export default App