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

  const [username, setUsername] = useState("")
  const [users, setUsers] = useState([])

  const [room, setRoom] = useState(
    new URLSearchParams(window.location.search).get("room") || ""
  )

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

        /*
         * Remote cursor
         */

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
      }

      remoteCursorsRef.current.clear()

      remoteCursorWidgetsRef.current.clear()
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