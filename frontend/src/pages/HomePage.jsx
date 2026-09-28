import { useState, useRef } from "react"

/**
 * SpotlightCard component inspired by React Bits (reactbits.dev).
 * Tracks cursor proximity and renders a smooth radial spotlight on dark surface.
 */
function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(88, 166, 255, 0.08)",
}) {
  const divRef = useRef(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [opacity, setOpacity] = useState(0)

  const handleMouseMove = (e) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handleMouseEnter = () => setOpacity(1)
  const handleMouseLeave = () => setOpacity(0)

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative rounded-md border border-[#30363d] bg-[#161b22] overflow-hidden transition-colors ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
        style={{
          opacity,
          background: `radial-gradient(350px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 80%)`,
        }}
      />
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  )
}

/**
 * SyncStream – Technical Overview & Landing Page
 * Clean, developer-focused interface with React Bits Bento Grid architecture overview.
 */
export function HomePage({
  onStartRoom,
  onJoinRoom,
  user,
  isAuthenticated,
  onSignIn,
  onSignUp,
  onSignOut,
}) {
  const [activeTab, setActiveTab] = useState("editor") // "editor" | "terminal" | "tree" | "preview"
  const [copiedCurl, setCopiedCurl] = useState(false)
  const [inlineRoomId, setInlineRoomId] = useState("")

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(
      'curl -X POST https://syncstream.dev/api/rooms -H "Content-Type: application/json"'
    )
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  const handleInlineJoinSubmit = (e) => {
    e.preventDefault()
    if (inlineRoomId.trim()) {
      window.location.search = `?room=${encodeURIComponent(inlineRoomId.trim())}`
    } else {
      onJoinRoom()
    }
  }

  return (
    <div className="w-full min-h-screen overflow-y-auto bg-[#090d13] text-[#f0f6fc] font-sans antialiased selection:bg-[#1f6feb] selection:text-white">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#21262d] bg-[#0d1117]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-13 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <svg
              aria-hidden="true"
              className="w-5 h-5 text-[#58a6ff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-[#f0f6fc]">
              SyncStream
            </span>
          </div>

          {/* Navigation Links & Auth */}
          <nav className="flex items-center gap-3 sm:gap-5 text-xs" aria-label="Main Navigation">
            <a
              href="#architecture"
              className="hidden md:inline-block text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              Architecture
            </a>
            <a
              href="#api"
              className="hidden md:inline-block text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              API
            </a>
            <a
              href="#shortcuts"
              className="hidden md:inline-block text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              Keymap
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              GitHub
            </a>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-3 border-l border-[#30363d]">
                <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-medium text-[#c9d1d9] bg-[#30363d]">
                  {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                </span>
                <span className="text-xs text-[#c9d1d9] truncate max-w-[100px]">
                  {user.displayName || user.username}
                </span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-[11px] text-[#8b949e] hover:text-[#f85149] transition-colors cursor-pointer ml-1"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-3 border-l border-[#30363d]">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-xs text-[#c9d1d9] hover:text-[#f0f6fc] px-1.5 py-1 transition-colors cursor-pointer"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="text-xs text-[#58a6ff] hover:text-[#79c0ff] px-1.5 py-1 transition-colors cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onStartRoom}
              className="px-3 py-1.5 text-xs font-medium rounded bg-[#238636] hover:bg-[#2ea043] text-white transition-colors cursor-pointer"
            >
              Start Room
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-12">
        <div className="max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#f0f6fc] mb-3">
            Collaborative code editor in the browser
          </h1>

          <p className="text-sm sm:text-base text-[#8b949e] leading-relaxed mb-6 max-w-2xl">
            Real-time CRDT document synchronization, shared terminal streaming,
            and execution across 15+ language environments. No installation or
            account setup required.
          </p>

          {/* Functional Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartRoom}
              className="px-4 py-2 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Start new room
            </button>

            <form onSubmit={handleInlineJoinSubmit} className="flex items-center gap-1.5">
              <input
                type="text"
                value={inlineRoomId}
                onChange={(e) => setInlineRoomId(e.target.value)}
                placeholder="Enter room ID to join..."
                className="px-3 py-1.5 rounded bg-[#161b22] text-[#f0f6fc] text-xs font-mono border border-[#30363d] focus:border-[#58a6ff] focus:outline-none placeholder:text-[#6e7681] transition-colors w-48 sm:w-56"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] text-xs font-medium transition-colors cursor-pointer"
              >
                Join
              </button>
            </form>
          </div>

          <div className="mt-3 text-[11px] text-[#6e7681]">
            Guest rooms are ephemeral and expire after 15 minutes of inactivity.
          </div>
        </div>

        {/* ── Simulated IDE Viewport ─────────────────────────────────── */}
        <div className="mt-10 rounded-md border border-[#30363d] bg-[#0d1117] overflow-hidden">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/40" title="Close" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/40" title="Minimize" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/40" title="Maximize" />
              </div>

              <div className="flex items-center gap-1 border-l border-[#30363d] pl-3">
                {[
                  { id: "editor", label: "Editor" },
                  { id: "terminal", label: "Terminal" },
                  { id: "tree", label: "Files" },
                  { id: "preview", label: "Preview" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-[#21262d] text-[#f0f6fc] font-medium border border-[#30363d]"
                        : "text-[#8b949e] hover:text-[#c9d1d9]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-[#8b949e]">
              <span className="text-[#3fb950]">2 users online</span>
              <span className="text-[#6e7681]">room: 550e8400-e29b</span>
            </div>
          </div>

          {/* Viewport Content */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[360px] bg-[#0d1117] font-mono text-xs">
            {/* File Explorer Sidebar */}
            <div className="hidden md:flex md:col-span-3 border-r border-[#21262d] bg-[#0d1117] flex-col">
              <div className="px-3 py-2 text-[11px] font-medium text-[#8b949e] border-b border-[#21262d]">
                FILES
              </div>
              <div className="py-2 px-1 flex flex-col gap-0.5 text-xs text-[#c9d1d9]">
                <div className="px-2 py-1 text-[#8b949e] font-semibold">src/</div>
                <div className="flex items-center justify-between px-4 py-1 rounded bg-[#21262d] text-[#58a6ff]">
                  <span>crdt_sync.ts</span>
                  <span className="text-[10px] text-[#3fb950]">M</span>
                </div>
                <div className="px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span>server.go</span>
                </div>
                <div className="px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span>engine.rs</span>
                </div>
                <div className="px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span>package.json</span>
                </div>
              </div>

              <div className="mt-auto p-3 border-t border-[#21262d] bg-[#161b22]/40">
                <div className="text-[11px] text-[#8b949e] mb-1.5">Participants</div>
                <div className="space-y-1 text-xs">
                  <div className="text-[#c9d1d9]">● Alex (You)</div>
                  <div className="text-[#3fb950]">● Sarah (Line 12)</div>
                </div>
              </div>
            </div>

            {/* Editor Canvas */}
            <div className="col-span-1 md:col-span-9 flex flex-col">
              <div className="flex items-center justify-between px-3 h-8 bg-[#161b22] border-b border-[#21262d]">
                <div className="flex items-center h-full">
                  <div className="px-3 h-full flex items-center bg-[#0d1117] border-r border-[#21262d] text-xs text-[#f0f6fc]">
                    crdt_sync.ts
                  </div>
                  <div className="px-3 h-full flex items-center text-xs text-[#8b949e]">
                    server.go
                  </div>
                </div>
                <div className="text-[11px] text-[#8b949e]">TypeScript 5.4</div>
              </div>

              {activeTab === "editor" && (
                <div className="p-4 sm:p-5 overflow-x-auto leading-6 flex-1">
                  <div className="text-[#8b949e] flex gap-4">
                    <div className="select-none text-[#484f58] text-right font-mono pr-2 border-r border-[#21262d]/80">
                      <div>01</div>
                      <div>02</div>
                      <div>03</div>
                      <div>04</div>
                      <div>05</div>
                      <div>06</div>
                      <div>07</div>
                      <div>08</div>
                      <div>09</div>
                      <div>10</div>
                      <div>11</div>
                      <div>12</div>
                    </div>
                    <div className="flex-1 font-mono text-xs">
                      <div>
                        <span className="text-[#ff7b72]">import</span>{" "}
                        <span className="text-[#8b949e]">{"* as"}</span>{" "}
                        <span className="text-[#79c0ff]">Y</span>{" "}
                        <span className="text-[#ff7b72]">from</span>{" "}
                        <span className="text-[#a5d6ff]">"yjs"</span>
                      </div>
                      <div>
                        <span className="text-[#ff7b72]">import</span>{" "}
                        <span className="text-[#8b949e]">{"{"}</span>{" "}
                        <span className="text-[#79c0ff]">SpringWebSocketProvider</span>{" "}
                        <span className="text-[#8b949e]">{"}"}</span>{" "}
                        <span className="text-[#ff7b72]">from</span>{" "}
                        <span className="text-[#a5d6ff]">"./provider"</span>
                      </div>
                      <div className="text-[#6e7681]">{"\n"}// Initialize CRDT doc with state vector synchronization</div>
                      <div>
                        <span className="text-[#ff7b72]">export function</span>{" "}
                        <span className="text-[#d2a8ff]">initSyncSession</span>
                        <span className="text-[#8b949e]">(</span>
                        <span className="text-[#ffa657]">roomId</span>
                        <span className="text-[#8b949e]">):</span>{" "}
                        <span className="text-[#79c0ff]">void</span>{" "}
                        <span className="text-[#8b949e]">{"{"}</span>
                      </div>
                      <div className="pl-4">
                        <span className="text-[#ff7b72]">const</span>{" "}
                        <span className="text-[#79c0ff]">doc</span>{" "}
                        <span className="text-[#ff7b72]">=</span>{" "}
                        <span className="text-[#ff7b72]">new</span>{" "}
                        <span className="text-[#79c0ff]">Y.Doc</span>
                        <span className="text-[#8b949e]">()</span>
                      </div>
                      <div className="pl-4">
                        <span className="text-[#ff7b72]">const</span>{" "}
                        <span className="text-[#79c0ff]">provider</span>{" "}
                        <span className="text-[#ff7b72]">=</span>{" "}
                        <span className="text-[#ff7b72]">new</span>{" "}
                        <span className="text-[#79c0ff]">SpringWebSocketProvider</span>
                        <span className="text-[#8b949e]">(roomId, doc)</span>
                      </div>
                      <div className="pl-4 flex items-center relative">
                        <span className="text-[#6e7681]">// Remote cursor active</span>
                        <span className="ml-2 px-1.5 py-0.2 text-[10px] text-[#3fb950] border border-[#3fb950] rounded bg-[#3fb950]/10">
                          Sarah: editing
                        </span>
                      </div>
                      <div className="pl-4">
                        <span className="text-[#79c0ff]">provider</span>
                        <span className="text-[#8b949e]">.</span>
                        <span className="text-[#d2a8ff]">awareness</span>
                        <span className="text-[#8b949e]">.</span>
                        <span className="text-[#d2a8ff]">setLocalStateField</span>
                        <span className="text-[#8b949e]">(</span>
                        <span className="text-[#a5d6ff]">"cursor"</span>
                        <span className="text-[#8b949e]">, {"{"} line: 12, col: 4 {"}"})</span>
                      </div>
                      <div className="pl-4">
                        <span className="text-[#ff7b72]">return</span>{" "}
                        <span className="text-[#8b949e]">{"{"}</span> doc, provider <span className="text-[#8b949e]">{"}"}</span>
                      </div>
                      <div>
                        <span className="text-[#8b949e]">{"}"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "terminal" && (
                <div className="p-4 bg-[#090d13] font-mono text-xs flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="text-[#8b949e]">
                      <span className="text-[#3fb950]">user@syncstream</span>:~/workspace$ npm test
                    </div>
                    <div className="text-[#3fb950] pl-2 pt-1">
                      PASS tests/crdt.spec.ts (4 passed)<br />
                      PASS tests/websocket.spec.ts (6 passed)<br />
                      PASS tests/cleanup.spec.ts (3 passed)
                    </div>
                    <div className="text-[#f0f6fc] pt-2">
                      Test Suites: 3 passed, 3 total<br />
                      Tests: 13 passed, 13 total
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#21262d] text-[#6e7681]">
                    PTY bash session connected
                  </div>
                </div>
              )}

              {activeTab === "tree" && (
                <div className="p-5 bg-[#090d13] font-mono text-xs flex-1 space-y-1.5 text-[#c9d1d9]">
                  <div>📁 project/</div>
                  <div className="pl-4">📄 index.html</div>
                  <div className="pl-4">📁 src/</div>
                  <div className="pl-8 text-[#58a6ff]">📄 crdt_sync.ts</div>
                  <div className="pl-8">📄 server.go</div>
                  <div className="pl-4">📄 package.json</div>
                </div>
              )}

              {activeTab === "preview" && (
                <div className="p-5 bg-[#090d13] font-mono text-xs flex-1 flex flex-col justify-center items-center text-center">
                  <div className="p-4 rounded bg-[#161b22] border border-[#30363d] max-w-sm text-left">
                    <div className="text-xs text-[#58a6ff] font-semibold mb-1">Live Preview</div>
                    <div className="text-xs text-[#8b949e]">Sandboxed iframe execution for HTML/JS projects.</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-t border-[#21262d] text-[11px] text-[#8b949e]">
                <span>Ln 12, Col 4</span>
                <span className="text-[#3fb950]">Synced</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── React Bits Bento Grid: Architecture & Capabilities ───────── */}
      <section
        id="architecture"
        className="border-t border-[#21262d] bg-[#0d1117] py-16"
        aria-labelledby="arch-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2
              id="arch-heading"
              className="text-xl sm:text-2xl font-semibold text-[#f0f6fc] mb-2"
            >
              Architecture & Capabilities
            </h2>
            <p className="text-sm text-[#8b949e]">
              Engineered for low latency, isolated execution, and real-time pair programming.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bento Card 1: 2-column span -> CRDT Engine */}
            <SpotlightCard className="md:col-span-2 p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  Conflict-Free Document Merging
                </h3>
                <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed max-w-xl">
                  Local edits apply immediately on the client and propagate as binary delta vectors over WebSockets. Concurrent operations merge deterministically without central server locks.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                State vector delta encoding · Yjs CRDT engine
              </div>
            </SpotlightCard>

            {/* Bento Card 2: 1-column span -> Terminal & PTY */}
            <SpotlightCard className="p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  Interactive Terminal & PTY
                </h3>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Real-time pseudoterminal multiplexed across all peers with full ANSI color support and process signal control.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                Shared pseudoterminal streaming
              </div>
            </SpotlightCard>

            {/* Bento Card 3: 1-column span -> Ephemeral Lifecycle */}
            <SpotlightCard className="p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  Ephemeral Guest Workspaces
                </h3>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Guest rooms automatically purge after 15 minutes of inactivity with zero residual server footprint. Registered accounts retain persistent storage.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                15-minute inactivity TTL cleanup
              </div>
            </SpotlightCard>

            {/* Bento Card 4: 2-column span -> AST & Language Diagnostics */}
            <SpotlightCard className="md:col-span-2 p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  In-Browser Compiler Diagnostics & Linting
                </h3>
                <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed max-w-xl">
                  Real-time error squiggles, syntax completions, keyword auto-suggestions, and document formatting for Python, TypeScript, Java, C++, Go, and Rust.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                Monaco language server integration
              </div>
            </SpotlightCard>

            {/* Bento Card 5: 1-column span -> Runtimes */}
            <SpotlightCard className="p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  15+ Language Environments
                </h3>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Pre-configured execution environments for Python 3, TypeScript, Go, Rust, C++, Java, and SQL with zero local setup.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                Python · TypeScript · Go · Rust · C++ · Java
              </div>
            </SpotlightCard>

            {/* Bento Card 6: 2-column span -> Virtual File Tree */}
            <SpotlightCard className="md:col-span-2 p-6 flex flex-col justify-between min-h-[190px]">
              <div>
                <h3 className="text-base font-semibold text-[#f0f6fc] mb-2">
                  Virtual File Tree & ZIP Portability
                </h3>
                <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed">
                  Organize multi-file projects with nested directories, global search & replace, and export your entire workspace as a standard ZIP bundle.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#21262d] text-xs font-mono text-[#6e7681]">
                In-memory virtual directory tree · Export .zip
              </div>
            </SpotlightCard>
          </div>
        </div>
      </section>

      {/* ── API Section ─────────────────────────────────────────────── */}
      <section
        id="api"
        className="border-t border-[#21262d] py-14 bg-[#090d13]"
        aria-labelledby="api-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5">
              <h2
                id="api-heading"
                className="text-lg sm:text-xl font-semibold text-[#f0f6fc] mb-2"
              >
                REST API Integration
              </h2>
              <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed mb-3">
                Create rooms programmatically for interviews, CI test sandboxes,
                or documentation examples.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded border border-[#30363d] bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
                  <span className="text-xs font-mono text-[#8b949e]">POST /api/rooms</span>
                  <button
                    type="button"
                    onClick={handleCopyCurl}
                    className="text-[11px] font-mono text-[#58a6ff] hover:text-[#79c0ff] cursor-pointer"
                  >
                    {copiedCurl ? "Copied" : "Copy cURL"}
                  </button>
                </div>
                <pre className="p-3 text-xs font-mono text-[#c9d1d9] leading-relaxed overflow-x-auto">
                  <span className="text-[#ff7b72]">curl</span> -X POST https://syncstream.dev/api/rooms \{"\n"}
                  {"  "}-H <span className="text-[#a5d6ff]">"Content-Type: application/json"</span>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Keymap Section ──────────────────────────────────────────── */}
      <section
        id="shortcuts"
        className="border-t border-[#21262d] py-14 bg-[#0d1117]"
        aria-labelledby="keymap-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-6">
            <h2
              id="keymap-heading"
              className="text-lg sm:text-xl font-semibold text-[#f0f6fc] mb-1"
            >
              Keyboard Shortcuts
            </h2>
            <p className="text-xs text-[#8b949e]">
              Standard editor shortcuts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {[
              { key: "Ctrl + `", action: "Toggle Terminal" },
              { key: "Ctrl + Shift + F", action: "Workspace Search" },
              { key: "F5", action: "Run Code" },
              { key: "Ctrl + Shift + P", action: "Command Palette" },
              { key: "Alt + Z", action: "Toggle Word Wrap" },
              { key: "Ctrl + S", action: "Run Diagnostics" },
              { key: "Ctrl + B", action: "Toggle Sidebar" },
              { key: "Escape", action: "Close Dialogs" },
            ].map(({ key, action }) => (
              <div
                key={key}
                className="p-2.5 rounded bg-[#161b22] border border-[#30363d] flex items-center justify-between"
              >
                <span className="text-xs text-[#c9d1d9]">{action}</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#58a6ff] bg-[#0d1117] border border-[#30363d] rounded">
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#21262d] bg-[#0d1117] py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6e7681]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#c9d1d9]">SyncStream</span>
            <span>·</span>
            <span>Real-time code collaboration</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
