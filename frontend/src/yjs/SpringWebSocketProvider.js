import * as Y from "yjs"

export class SpringWebSocketProvider {
  constructor(
    room,
    ydoc,
    username,
    onUsersChange,
    onCursorChange,
    onUserLeave,
    onSelectionChange,
    onConnectionStateChange
  ) {
    this.clientId = crypto.randomUUID()

    this.room = room
    this.ydoc = ydoc
    this.username = username

    this.onUsersChange = onUsersChange
    this.onCursorChange = onCursorChange
    this.onUserLeave = onUserLeave
    this.onSelectionChange = onSelectionChange
    this.onConnectionStateChange =
      onConnectionStateChange

    this.users = []

    this.socket = null

    this.intentionalDisconnect = false
    this.reconnectTimer = null
    this.reconnectAttempt = 0

    this.handleUpdate = (
      update,
      origin
    ) => {
      if (
        origin === this ||
        !this.socket ||
        this.socket.readyState !==
          WebSocket.OPEN
      ) {
        return
      }

      const data =
        new Uint8Array(
          1 + update.length
        )

      data[0] = 0

      data.set(
        update,
        1
      )

      this.socket.send(data)
    }

    this.ydoc.on(
      "update",
      this.handleUpdate
    )

    this.connect()
  }

  connect() {
    if (
      this.intentionalDisconnect
    ) {
      return
    }

    if (
      this.socket &&
      (
        this.socket.readyState ===
          WebSocket.OPEN ||
        this.socket.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      return
    }

    this.setConnectionState(
      "CONNECTING"
    )

    const socket =
      new WebSocket(
        `ws://localhost:8080/ws?room=${encodeURIComponent(
          this.room
        )}&clientId=${encodeURIComponent(
          this.clientId
        )}`
      )

    this.socket = socket

    socket.binaryType =
      "arraybuffer"

    socket.onopen = () => {
      if (
        socket !== this.socket
      ) {
        return
      }

      console.log(
        `Connected to room: ${this.room}`
      )

      this.reconnectAttempt = 0

      this.setConnectionState(
        "CONNECTED"
      )

      this.sendJoin()

      this.requestSync()
    }

    socket.onmessage = (
      event
    ) => {
      if (
        socket !== this.socket
      ) {
        return
      }

      this.handleMessage(event)
    }

    socket.onerror = () => {
      if (
        socket !== this.socket
      ) {
        return
      }

      console.error(
        "WebSocket connection error"
      )
    }

    socket.onclose = () => {
      if (
        socket !== this.socket
      ) {
        return
      }

      console.log(
        `Disconnected from room: ${this.room}`
      )

      if (
        this.intentionalDisconnect
      ) {
        return
      }

      this.setConnectionState(
        "RECONNECTING"
      )

      this.scheduleReconnect()
    }
  }

  sendJoin() {
    const join = {
      action: "join",
      clientId: this.clientId,
      username: this.username
    }

    this.sendPresence(join)
  }

  requestSync() {
    if (
      !this.socket ||
      this.socket.readyState !==
        WebSocket.OPEN
    ) {
      return
    }

    const request =
      new Uint8Array(37)

    request[0] = 1

    const clientIdBytes =
      new TextEncoder().encode(
        this.clientId
      )

    request.set(
      clientIdBytes,
      1
    )

    this.socket.send(request)
  }

  handleMessage(event) {
    const data =
      new Uint8Array(
        event.data
      )

    if (data.length === 0) {
      return
    }

    const messageType =
      data[0]

    if (
      messageType === 0
    ) {
      const update =
        data.slice(1)

      Y.applyUpdate(
        this.ydoc,
        update,
        this
      )

      return
    }

    if (
      messageType === 1
    ) {
      this.handleSyncRequest(
        data
      )

      return
    }

    if (
      messageType === 2
    ) {
      this.handleSyncResponse(
        data
      )

      return
    }

    if (
      messageType === 3
    ) {
      this.handlePresence(
        data
      )
    }

    if (
      messageType === 4
    ) {
      this.handleSyncComplete(data)
      return
    }
  }

  handleSyncRequest(
    data
  ) {
    const targetClientId =
      new TextDecoder().decode(
        data.slice(1, 37)
      )

    const update =
      Y.encodeStateAsUpdate(
        this.ydoc
      )

    const response =
      new Uint8Array(
        37 + update.length
      )

    response[0] = 2

    const targetClientIdBytes =
      new TextEncoder().encode(
        targetClientId
      )

    response.set(
      targetClientIdBytes,
      1
    )

    response.set(
      update,
      37
    )

    if (
      this.socket &&
      this.socket.readyState ===
        WebSocket.OPEN
    ) {
      this.socket.send(
        response
      )
    }
  }

  handleSyncResponse(
    data
  ) {
    const targetClientId =
      new TextDecoder().decode(
        data.slice(1, 37)
      )

    if (
      targetClientId !==
      this.clientId
    ) {
      return
    }

    const update =
      data.slice(37)

    Y.applyUpdate(
      this.ydoc,
      update,
      this
    )
  }

  handleSyncComplete(data) {
  const targetClientId =
    new TextDecoder().decode(
      data.slice(1, 37)
    )

  if (
    targetClientId !==
    this.clientId
  ) {
    return
  }

  const update =
    Y.encodeStateAsUpdate(
      this.ydoc
    )

  const message =
    new Uint8Array(
      1 + update.length
    )

  message[0] = 0

  message.set(
    update,
    1
  )

  if (
    this.socket &&
    this.socket.readyState ===
      WebSocket.OPEN
  ) {
    this.socket.send(message)
  }
}

  handlePresence(
    data
  ) {
    try {
      const json =
        new TextDecoder().decode(
          data.slice(1)
        )

      const presence =
        JSON.parse(json)

      if (
        presence.action ===
        "state"
      ) {
        this.users =
          Object.entries(
            presence.users || {}
          ).map(
            ([clientId, username]) => ({
              clientId,
              username
            })
          )

        this.onUsersChange?.(
          [...this.users]
        )

        return
      }

      if (
        presence.action ===
        "join"
      ) {
        const exists =
          this.users.some(
            user =>
              user.clientId ===
              presence.clientId
          )

        if (!exists) {
          this.users.push({
            clientId:
              presence.clientId,
            username:
              presence.username
          })
        }

        this.onUsersChange?.(
          [...this.users]
        )

        return
      }

      if (
        presence.action ===
        "cursor"
      ) {
        this.onCursorChange?.(
          presence
        )

        return
      }

      if (
        presence.action ===
        "selection"
      ) {
        this.onSelectionChange?.(
          presence
        )

        return
      }

      if (
        presence.action ===
        "leave"
      ) {
        this.users =
          this.users.filter(
            user =>
              user.clientId !==
              presence.clientId
          )

        this.onUsersChange?.(
          [...this.users]
        )

        this.onUserLeave?.(
          presence.clientId
        )
      }
    } catch (error) {
      console.error(
        "Failed to handle presence message",
        error
      )
    }
  }

  sendCursorPosition(
    lineNumber,
    column
  ) {
    const cursor = {
      action: "cursor",
      clientId:
        this.clientId,
      username:
        this.username,
      lineNumber,
      column
    }

    this.sendPresence(
      cursor
    )
  }

  sendSelection(
    selection
  ) {
    const message = {
      action: "selection",
      clientId:
        this.clientId,
      username:
        this.username,
      selection
    }

    this.sendPresence(
      message
    )
  }

  sendPresence(
    presence
  ) {
    if (
      !this.socket ||
      this.socket.readyState !==
        WebSocket.OPEN
    ) {
      return
    }

    const json =
      JSON.stringify(
        presence
      )

    const jsonBytes =
      new TextEncoder().encode(
        json
      )

    const message =
      new Uint8Array(
        1 + jsonBytes.length
      )

    message[0] = 3

    message.set(
      jsonBytes,
      1
    )

    this.socket.send(
      message
    )
  }

  scheduleReconnect() {
    if (
      this.intentionalDisconnect ||
      this.reconnectTimer
    ) {
      return
    }

    const delay =
      Math.min(
        1000 *
          Math.pow(
            2,
            this.reconnectAttempt
          ),
        10000
      )

    this.reconnectAttempt++

    console.log(
      `Reconnecting in ${delay}ms`
    )

    this.reconnectTimer =
      setTimeout(() => {
        this.reconnectTimer =
          null

        this.connect()
      }, delay)
  }

  setConnectionState(
    state
  ) {
    this.onConnectionStateChange?.(
      state
    )
  }

  disconnect() {
    this.intentionalDisconnect =
      true

    if (
      this.reconnectTimer
    ) {
      clearTimeout(
        this.reconnectTimer
      )

      this.reconnectTimer =
        null
    }

    this.ydoc.off(
      "update",
      this.handleUpdate
    )

    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    this.setConnectionState(
      "DISCONNECTED"
    )
  }
}