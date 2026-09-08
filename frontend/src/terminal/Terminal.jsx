import { useEffect, useRef } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"

function TerminalPanel({
  room,
  username,
  clientId,
  terminalRef,
  terminalContainerRef
}) {
  const socketRef = useRef(null)

  useEffect(() => {
    if (!terminalContainerRef.current) {
      return
    }

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily:
        "Cascadia Mono, Consolas, 'Courier New', monospace",
      convertEol: true,
      scrollback: 5000,
      allowTransparency: false,

      theme: {
        background: "#0a0a0a",
        foreground: "#d4d4d4",
        cursor: "#ffffff",
        cursorAccent: "#0a0a0a",
        selectionBackground: "#264f78"
      }
    })

    terminal.open(
      terminalContainerRef.current
    )

    terminalRef.current = terminal

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:"

    const socket = new WebSocket(
      `${protocol}//${window.location.hostname}:8080/ws/terminal?room=${encodeURIComponent(
        room
      )}&username=${encodeURIComponent(
        username
      )}&clientId=${encodeURIComponent(
        clientId || ""
      )}`
    )

    socket.binaryType = "arraybuffer"

    socketRef.current = socket

    socket.onopen = () => {
      console.log(
        "Terminal WebSocket connected"
      )
    }

    socket.onmessage = (event) => {
      if (
        typeof event.data === "string"
      ) {
        terminal.write(
          event.data
        )

        return
      }

      if (
        event.data instanceof ArrayBuffer
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

    socket.onerror = (error) => {
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
    let history = []
    let historyIndex = -1

    const dataDisposable =
      terminal.onData((data) => {
        /*
         * Enter
         */
        if (
          data === "\r" ||
          data === "\n"
        ) {
          terminal.write(
            "\r\n"
          )

          if (command.trim()) {
            if (
              socket.readyState ===
              WebSocket.OPEN
            ) {
              socket.send(
                command
              )

              history = [
                ...history.filter(
                  item =>
                    item !== command
                ),
                command
              ]

              historyIndex =
                history.length
            }
          } else {
            terminal.write(
              "$ "
            )
          }

          command = ""

          return
        }

        /*
         * Backspace
         */
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

        /*
         * Ctrl + C
         */
        if (
          data === "\u0003"
        ) {
          command = ""
          historyIndex =
            history.length

          terminal.write(
            "^C\r\n$ "
          )

          return
        }

        /*
         * Arrow up
         */
        if (
          data === "\u001b[A"
        ) {
          if (
            history.length === 0
          ) {
            return
          }

          if (
            historyIndex > 0
          ) {
            historyIndex--
          }

          const previousCommand =
            history[
              historyIndex
            ] || ""

          terminal.write(
            "\r\x1b[K$ " +
              previousCommand
          )

          command =
            previousCommand

          return
        }

        /*
         * Arrow down
         */
        if (
          data === "\u001b[B"
        ) {
          if (
            history.length === 0
          ) {
            return
          }

          if (
            historyIndex <
            history.length
          ) {
            historyIndex++
          }

          const nextCommand =
            historyIndex <
            history.length
              ? history[
                  historyIndex
                ]
              : ""

          terminal.write(
            "\r\x1b[K$ " +
              nextCommand
          )

          command =
            nextCommand

          return
        }

        /*
         * Printable characters
         */
        if (
          data >= " " &&
          data <= "~"
        ) {
          command += data

          terminal.write(
            data
          )
        }
      })

    /*
     * Resize terminal whenever
     * the container changes.
     */
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

        /*
         * Approximate character cell
         * dimensions for the current
         * monospace font.
         */
        const cellWidth = 8.4
        const cellHeight = 17

        const cols = Math.max(
          2,
          Math.floor(
            rect.width /
              cellWidth
          )
        )

        const rows = Math.max(
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

    const observer =
      new ResizeObserver(
        resizeTerminal
      )

    observer.observe(
      terminalContainerRef.current
    )

    window.addEventListener(
      "resize",
      resizeTerminal
    )

    requestAnimationFrame(
      resizeTerminal
    )

    return () => {
      dataDisposable.dispose()

      observer.disconnect()

      window.removeEventListener(
        "resize",
        resizeTerminal
      )

      if (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      ) {
        socket.close()
      }

      socketRef.current =
        null

      terminal.dispose()

      terminalRef.current =
        null
    }
  }, [
    room,
    username,
    clientId,
    terminalRef,
    terminalContainerRef
  ])

  return null
}

export default TerminalPanel