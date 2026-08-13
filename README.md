# Code Mesh

Code Mesh is a real time collaborative code editor where multiple users can work on the same code inside a shared room.

The editor uses Monaco Editor for the coding experience, Yjs for collaborative document synchronization, and a custom WebSocket provider connected to a Spring Boot backend.

## Features

### Collaborative Editing

Multiple users can edit the same code document at the same time.

Changes made by one user are synchronized with every other user connected to the same room.

### Room Based Collaboration

Users join a room using a room ID.

Users inside the same room share the same document.

Users in different rooms remain isolated from each other.

### User Presence

The editor displays the users currently connected to the room.

When a user joins, their username appears in the users list.

When a user leaves, they are removed from the list.

### Remote Cursors

Each user's cursor position is synchronized in real time.

Remote cursors are displayed as red vertical lines inside the editor.

### Cursor Usernames

Each remote cursor displays the username of the user controlling it.

The username follows the cursor as the user moves through the editor.

### Remote Cursor Cleanup

When a user leaves the room, their cursor and username are removed from the other users' editors.

### Yjs Synchronization

Yjs manages the shared editor document and handles concurrent changes between connected clients.

The Monaco editor is connected to the Yjs document using y monaco.

## Tech Stack

### Frontend

React

Vite

JavaScript

Monaco Editor

Yjs

y monaco

Tailwind CSS

### Backend

Java

Spring Boot

Spring WebSocket

WebSocket

### Collaboration

Yjs provides the shared document model.

The custom SpringWebSocketProvider handles communication between the Yjs document and the Spring Boot WebSocket server.

Presence information such as usernames, cursor positions, joins, and leaves is transmitted separately from the Yjs document updates.

## Project Structure

```text
code mesh
│
├── backend
│   ├── src
│   │   └── main
│   │       ├── java
│   │       │   └── com
│   │       │       └── codemesh
│   │       │           └── backend
│   │       │               ├── controllers
│   │       │               │   └── HealthController.java
│   │       │               │
│   │       │               ├── websocket
│   │       │               │   ├── CodeWebSocketHandler.java
│   │       │               │   ├── RoomHandshakeInterceptor.java
│   │       │               │   ├── WebSocketConfig.java
│   │       │               │   └── WebSocketRoomManager.java
│   │       │               │
│   │       │               └── BackendApplication.java
│   │       │
│   │       └── resources
│   │           └── application.properties
│   │
│   ├── pom.xml
│   ├── mvnw
│   └── mvnw.cmd
│
└── frontend
    ├── src
    │   ├── app
    │   │   ├── App.jsx
    │   │   └── App.css
    │   │
    │   ├── yjs
    │   │   └── SpringWebSocketProvider.js
    │   │
    │   └── main.jsx
    │
    ├── package.json
    ├── vite.config.js
    └── index.html
