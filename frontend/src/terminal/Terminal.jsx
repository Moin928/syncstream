import { useEffect, useRef } from "react"
import { Terminal } from "@xterm/xterm"
import "@xterm/xterm/css/xterm.css"

function TerminalPanel() {
  const terminalRef = useRef(null)

  useEffect(() => {
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Consolas, 'Courier New', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#d4d4d4",
        cursor: "#ffffff"
      }
    })

    terminal.open(terminalRef.current)

    terminal.write("SyncStream Terminal")
    terminal.write("\r\n")
    terminal.write("$ ")

    let currentInput = ""

    const input = terminal.onData((data) => {
      if (data === "\r") {
        terminal.write("\r\n")

        if (currentInput.trim()) {
          terminal.write(`You entered: ${currentInput}`)
          terminal.write("\r\n")
        }

        currentInput = ""
        terminal.write("$ ")
        return
      }

      if (data === "\u007F") {
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1)
          terminal.write("\b \b")
        }

        return
      }

      if (data >= " ") {
        currentInput += data
        terminal.write(data)
      }
    })

    return () => {
      input.dispose()
      terminal.dispose()
    }
  }, [])

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
    />
  )
}

export default TerminalPanel