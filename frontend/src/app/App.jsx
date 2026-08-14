import "./App.css"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useMemo, useState, useEffect } from "react"
import * as Y from "yjs"
import { SpringWebSocketProvider } from "../yjs/SpringWebSocketProvider"

function App() {
  const editorRef = useRef(null)
  const providerRef = useRef(null)

  const remoteCursorsRef = useRef(new Map())
  const remoteCursorWidgetsRef = useRef(new Map())
  const remoteSelectionsRef = useRef(new Map())

  const [username, setUsername] = useState("")
  const [users, setUsers] = useState([])

  const [room, setRoom] = useState(
    new URLSearchParams(window.location.search).get("room") || ""
  )

  const [connectionState, setConnectionState] =
  useState("CONNECTING")

  const [joined, setJoined] = useState(false)

  const ydoc = useMemo(
    () => new Y.Doc(),
    []
  )

  const yText = useMemo(
    () => ydoc.getText("monaco"),
    [ydoc]
  )

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

    /*
     * Remote username
     */

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

  // Remote user leaves
  (clientId) => {
    const editor =
      editorRef.current

    if (!editor) {
      return
    }

    /*
     * Remove cursor
     */

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

    /*
     * Remove username
     */

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

    /*
     * Remove selection
     */

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

  // Remote selection
    // Remote selection
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

  // Connection state
  (state) => {
    setConnectionState(state)
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
  /*
   * Remove all remote cursors
   */

  const decorations = [
    ...remoteCursorsRef.current.values()
  ]

  editor.deltaDecorations(
    decorations,
    []
  )

  /*
   * Remove all remote username widgets
   */

  for (
    const widget of
    remoteCursorWidgetsRef.current.values()
  ) {
    editor.removeContentWidget(
      widget
    )
  }

  /*
   * Remove all remote selections
   */

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

  const handleMount = (
    editor
  ) => {
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

  const handleJoin = (
    event
  ) => {
    event.preventDefault()

    const name =
      event.target.username.value.trim()

    const roomId =
      event.target.room.value.trim()

    if (!name || !roomId) {
      return
    }

    setUsername(name)
    setRoom(roomId)
    setJoined(true)

    window.history.pushState(
      {},
      "",
      `?room=${encodeURIComponent(roomId)}`
    )
  }

  if (!joined) {
    return (
      <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-4"
        >
          <input
            type="text"
            name="username"
            placeholder="Enter your username"
            className="p-2 rounded-lg bg-gray-800 text-white"
          />

          <input
            type="text"
            name="room"
            placeholder="Enter room ID"
            className="p-2 rounded-lg bg-gray-800 text-white"
          />

          <button
            type="submit"
            className="p-2 rounded-lg bg-amber-50 text-gray-950 font-bold"
          >
            Join
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="h-screen w-full bg-gray-950 flex gap-4 p-4">
      <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded bg-gray-800 text-white text-sm">
  {connectionState}
</div>
      <aside className="h-full w-1/4 bg-amber-50 rounded-lg">
        <h2 className="text-2xl font-bold p-4 border-b border-gray-300">
          Users
        </h2>

        <ul className="p-4">
          {users.map(
            (user) => (
              <li
                key={user.clientId}
                className="p-2 bg-gray-800 text-white rounded mb-2"
              >
                {user.username}
              </li>
            )
          )}
        </ul>
      </aside>

      <section className="w-3/4 bg-neutral-800 rounded-lg overflow-hidden">
        <Editor
          height="90vh"
          defaultLanguage="javascript"
          defaultValue="// some comment"
          theme="vs-dark"
          onMount={handleMount}
        />
      </section>
    </main>
  )
}

export default App