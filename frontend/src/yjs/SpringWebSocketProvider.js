import * as Y from "yjs"

export class SpringWebSocketProvider {
  constructor(
    room,
    ydoc,
    username,
    onUsersChange,
    onCursorChange,
    onUserLeave
  ) {
    this.clientId = crypto.randomUUID()
    this.room = room
    this.ydoc = ydoc
    this.username = username

    this.onUsersChange = onUsersChange
    this.onCursorChange = onCursorChange
    this.onUserLeave = onUserLeave

    this.users = []

    this.socket = new WebSocket(
      `ws://localhost:8080/ws?room=${encodeURIComponent(room)}&clientId=${encodeURIComponent(this.clientId)}`
    )

    this.socket.binaryType = "arraybuffer"

    this.handleUpdate = (update, origin) => {
      if (
        origin === this ||
        this.socket.readyState !== WebSocket.OPEN
      ) {
        return
      }

      const data = new Uint8Array(
        1 + update.length
      )

      data[0] = 0
      data.set(update, 1)

      this.socket.send(data)
    }

    this.ydoc.on(
      "update",
      this.handleUpdate
    )

    this.socket.onopen = () => {
      console.log(
        `Connected to room: ${room}`
      )

      const join = {
        action: "join",
        clientId: this.clientId,
        username: this.username
      }

      this.sendPresence(join)

      const request = new Uint8Array(37)

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

    this.socket.onmessage = (event) => {
      const data = new Uint8Array(
        event.data
      )

      if (data.length === 0) {
        return
      }

      const messageType = data[0]

      if (messageType === 0) {
        const update = data.slice(1)

        Y.applyUpdate(
          this.ydoc,
          update,
          this
        )

        return
      }

      if (messageType === 1) {
        this.handleSyncRequest(data)
        return
      }

      if (messageType === 2) {
        this.handleSyncResponse(data)
        return
      }

      if (messageType === 3) {
        this.handlePresence(data)
        return
      }
    }

    this.socket.onclose = () => {
      console.log(
        `Disconnected from room: ${room}`
      )
    }
  }

  handleSyncRequest(data) {
    const targetClientId =
      new TextDecoder().decode(
        data.slice(1, 37)
      )

    const update =
      Y.encodeStateAsUpdate(
        this.ydoc
      )

    const response = new Uint8Array(
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
      this.socket.readyState ===
      WebSocket.OPEN
    ) {
      this.socket.send(response)
    }
  }

  handleSyncResponse(data) {
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

  handlePresence(data) {
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

        return
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

    this.sendPresence(cursor)
  }

  sendPresence(presence) {
    const json =
      JSON.stringify(presence)

    const jsonBytes =
      new TextEncoder().encode(json)

    const message =
      new Uint8Array(
        1 + jsonBytes.length
      )

    message[0] = 3

    message.set(
      jsonBytes,
      1
    )

    if (
      this.socket.readyState ===
      WebSocket.OPEN
    ) {
      this.socket.send(message)
    }
  }

  disconnect() {
    this.ydoc.off(
      "update",
      this.handleUpdate
    )

    this.socket.close()
  }
}