import { useState } from "react"

/**
 * SyncStream – Technical Overview & Landing Page
 *
 * Designed for engineers: high information density, authentic IDE preview,
 * deep technical specifications, and zero marketing bloat.
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

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(
      'curl -X POST https://syncstream.dev/api/rooms -H "Content-Type: application/json"'
    )
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#090d13] text-[#f0f6fc] font-sans antialiased selection:bg-[#1f6feb] selection:text-white">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#21262d] bg-[#0d1117]/95 backdrop-blur-none">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand & Technical Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
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
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono text-[#8b949e] bg-[#161b22] border border-[#30363d]">
              CRDT v2.4
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-4 text-xs" aria-label="Main Navigation">
            <a
              href="#architecture"
              className="hidden md:inline-block text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              Architecture
            </a>
            <a
              href="#specs"
              className="hidden md:inline-block text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              Specifications
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
              className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#f0f6fc] transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              <span className="hidden sm:inline">Source</span>
            </a>

            {/* Auth Pill / Buttons */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[#30363d]">
                <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-[#0d1117] bg-[#388bfd]">
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
              <div className="flex items-center gap-2 pl-2 border-l border-[#30363d]">
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-xs text-[#c9d1d9] hover:text-[#f0f6fc] px-2 py-1 transition-colors cursor-pointer"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={onSignUp}
                  className="hidden sm:inline-flex text-xs text-[#58a6ff] hover:text-[#79c0ff] px-2 py-1 transition-colors cursor-pointer"
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
              Launch Workspace
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16">
        <div className="max-w-3xl">
          {/* Architecture Status Tag */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-6 rounded bg-[#161b22] border border-[#30363d] text-xs font-mono text-[#8b949e]">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" />
            <span>WEBSOCKET SYNC ACTIVE</span>
            <span className="text-[#30363d]">·</span>
            <span className="text-[#58a6ff]">ZERO INSTALLATION</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#f0f6fc] leading-[1.15] mb-5">
            Realtime collaborative IDE for pair programming and code reviews.
          </h1>

          <p className="text-base sm:text-lg text-[#8b949e] leading-relaxed mb-8 max-w-2xl">
            Conflict-free CRDT synchronization, embedded terminal streaming,
            multi-file workspaces, and real-time execution across 15+ runtimes.
            Open a room and start collaborating in seconds.
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStartRoom}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Instant Room</span>
            </button>

            <button
              type="button"
              onClick={onJoinRoom}
              className="flex items-center gap-2 px-5 py-2.5 rounded border border-[#30363d] bg-[#161b22] hover:bg-[#21262d] text-[#c9d1d9] text-sm font-medium transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Join with Room ID</span>
            </button>

            <span className="text-xs font-mono text-[#6e7681] ml-1">
              Guest rooms auto-clean after 15m inactivity
            </span>
          </div>
        </div>

        {/* ── Interactive High-Fidelity IDE Showcase ────────────────── */}
        <div className="mt-12 rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden shadow-2xl">
          {/* Top Window Header Bar */}
          <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] gap-2">
            <div className="flex items-center gap-3">
              {/* Window Controls */}
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f85149]/70" />
                <span className="w-3 h-3 rounded-full bg-[#e3b341]/70" />
                <span className="w-3 h-3 rounded-full bg-[#3fb950]/70" />
              </div>

              {/* Viewport Modes */}
              <div className="flex items-center gap-1 border-l border-[#30363d] pl-3">
                {[
                  { id: "editor", label: "Editor & CRDT Sync", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
                  { id: "terminal", label: "Shared Terminal (PTY)", icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                  { id: "tree", label: "Multi-File Tree", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
                  { id: "preview", label: "Live Web Preview", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-[#21262d] text-[#f0f6fc] font-medium border border-[#30363d]"
                        : "text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                    </svg>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Room Diagnostics / Latency Status */}
            <div className="flex items-center gap-3 text-xs font-mono text-[#8b949e]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
                <span className="text-[#3fb950]">2 peers connected</span>
              </span>
              <span className="hidden sm:inline text-[#6e7681]">RTT: 21ms</span>
              <span className="px-1.5 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-[11px] text-[#58a6ff]">
                room: sync-core-89a
              </span>
            </div>
          </div>

          {/* IDE Canvas Viewport */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-[#0d1117] font-mono text-xs">
            {/* Left Activity / Explorer Sidebar (Hidden on mobile, 3 cols on desktop) */}
            <div className="hidden md:flex md:col-span-3 border-r border-[#21262d] bg-[#0d1117] flex-col">
              <div className="px-3 py-2 text-[11px] font-semibold text-[#8b949e] uppercase tracking-wider border-b border-[#21262d]">
                Explorer: Workspace
              </div>
              <div className="py-2 px-1 flex flex-col gap-0.5 text-xs text-[#c9d1d9]">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[#8b949e]">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                  <span className="font-semibold text-[#8b949e]">src/</span>
                </div>
                <div className="flex items-center justify-between px-4 py-1 rounded bg-[#21262d]/60 text-[#58a6ff]">
                  <span className="flex items-center gap-2">
                    <span className="text-[#388bfd]">TS</span>
                    <span>crdt_sync.ts</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#e3b341]" title="Modified" />
                </div>
                <div className="flex items-center justify-between px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span className="flex items-center gap-2">
                    <span className="text-[#3fb950]">GO</span>
                    <span>server.go</span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span className="flex items-center gap-2">
                    <span className="text-[#d2a8ff]">RS</span>
                    <span>engine.rs</span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-1 text-[#8b949e] hover:text-[#c9d1d9]">
                  <span className="flex items-center gap-2">
                    <span className="text-[#ffa657]">JSON</span>
                    <span>package.json</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 mt-2 text-[#8b949e]">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 17l5-5-5-5z" />
                  </svg>
                  <span>tests/</span>
                </div>
              </div>

              {/* Connected Collaborators Pill Bar */}
              <div className="mt-auto p-3 border-t border-[#21262d] bg-[#161b22]/50">
                <div className="text-[11px] text-[#8b949e] mb-2 flex items-center justify-between">
                  <span>Collaborators (2)</span>
                  <span className="text-[10px] text-[#3fb950]">Live Sync</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center bg-[#a371f7] text-[#0d1117]">
                      A
                    </span>
                    <span className="text-xs text-[#c9d1d9]">Alex (You)</span>
                    <span className="text-[10px] text-[#8b949e] ml-auto">Ln 14</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center bg-[#3fb950] text-[#0d1117]">
                      S
                    </span>
                    <span className="text-xs text-[#c9d1d9]">Sarah Dev</span>
                    <span className="text-[10px] text-[#3fb950] ml-auto">Typing...</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Code & Viewport Area (9 cols on desktop) */}
            <div className="col-span-1 md:col-span-9 flex flex-col">
              {/* Tab Strip */}
              <div className="flex items-center justify-between px-3 h-8 bg-[#161b22] border-b border-[#21262d]">
                <div className="flex items-center h-full">
                  <div className="flex items-center gap-2 px-3 h-full bg-[#0d1117] border-r border-[#21262d] border-t-2 border-t-[#58a6ff] text-xs text-[#f0f6fc]">
                    <span>crdt_sync.ts</span>
                    <span className="text-[10px] text-[#8b949e]">×</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 h-full text-xs text-[#8b949e] border-r border-[#21262d]/50">
                    <span>server.go</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#8b949e]">
                  <span className="text-[#3fb950]">● Saved</span>
                  <span>TypeScript 5.4</span>
                </div>
              </div>

              {/* Dynamic Tab Body */}
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
                        <span className="text-[#8b949e]">:</span>{" "}
                        <span className="text-[#79c0ff]">string</span>
                        <span className="text-[#8b949e]">) {"{"}</span>
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
                        <span className="text-[#6e7681]">// Remote cursor active selection</span>
                        {/* Remote Cursor Sarah Highlight */}
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-[#3fb950]/20 border border-[#3fb950] text-[10px] text-[#3fb950] font-mono">
                          Sarah: streaming edit
                          <span className="inline-block w-1.5 h-3 bg-[#3fb950] ml-1 animate-pulse" />
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
                      <span className="text-[#3fb950]">user@syncstream</span>
                      <span className="text-[#f0f6fc]">:</span>
                      <span className="text-[#58a6ff]">~/workspace</span>
                      <span className="text-[#f0f6fc]">$</span> npm run test:unit
                    </div>
                    <div className="text-[#8b949e] pl-2">
                      &gt; test:unit<br />
                      &gt; vitest run --reporter=verbose
                    </div>
                    <div className="text-[#3fb950] pl-2">
                      ✓ tests/crdt.spec.ts (4 tests passed, 18ms)<br />
                      ✓ tests/websocket_transport.spec.ts (6 tests passed, 32ms)<br />
                      ✓ tests/session_cleanup.spec.ts (3 tests passed, 14ms)
                    </div>
                    <div className="text-[#f0f6fc] font-semibold pt-2">
                      Test Files  <span className="text-[#3fb950]">3 passed</span> (3)<br />
                      Tests       <span className="text-[#3fb950]">13 passed</span> (13)<br />
                      Duration    <span className="text-[#8b949e]">124ms</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-4 border-t border-[#21262d] text-[#8b949e]">
                    <span className="text-[#3fb950]">● Connected to backend PTY (session #8419)</span>
                    <span className="ml-auto text-[#6e7681]">bash 5.2</span>
                  </div>
                </div>
              )}

              {activeTab === "tree" && (
                <div className="p-5 bg-[#090d13] font-mono text-xs flex-1">
                  <div className="text-[#8b949e] mb-3">
                    Virtual Multi-File Project Architecture:
                  </div>
                  <div className="space-y-1 text-[#c9d1d9]">
                    <div>📁 project-root/</div>
                    <div className="pl-4">📄 index.html <span className="text-[#6e7681]">— Entry document</span></div>
                    <div className="pl-4">📁 src/</div>
                    <div className="pl-8">📄 main.tsx <span className="text-[#6e7681]">— React DOM mount</span></div>
                    <div className="pl-8">📄 crdt_sync.ts <span className="text-[#58a6ff]">— Yjs state coordinator</span></div>
                    <div className="pl-8">📄 styles.css <span className="text-[#6e7681]">— GitHub dark styles</span></div>
                    <div className="pl-4">📁 backend/</div>
                    <div className="pl-8">📄 main.go <span className="text-[#3fb950]">— WebSocket handler & PTY bridge</span></div>
                    <div className="pl-4">📄 package.json <span className="text-[#6e7681]">— Dependency manifest</span></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#21262d] flex items-center gap-3">
                    <span className="text-[11px] text-[#8b949e]">Export options:</span>
                    <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[11px] text-[#58a6ff]">
                      .ZIP Archive Export
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[11px] text-[#58a6ff]">
                      Direct Share URL
                    </span>
                  </div>
                </div>
              )}

              {activeTab === "preview" && (
                <div className="p-5 bg-[#090d13] font-mono text-xs flex-1 flex flex-col justify-center items-center text-center">
                  <div className="w-full max-w-md p-4 rounded bg-[#161b22] border border-[#30363d] text-left">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#21262d]">
                      <span className="text-[11px] text-[#8b949e]">Live Render Sandbox</span>
                      <span className="text-[10px] text-[#3fb950]">Hot Reload Active</span>
                    </div>
                    <div className="p-3 bg-[#0d1117] rounded border border-[#21262d] text-[#f0f6fc]">
                      <h4 className="font-semibold text-sm mb-1 text-[#58a6ff]">App Preview</h4>
                      <p className="text-xs text-[#8b949e]">Real-time DOM evaluation via isolated sandboxed iframe.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status Bar Footer */}
              <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-t border-[#21262d] text-[11px] text-[#8b949e]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[#58a6ff]">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z" />
                    </svg>
                    <span>0 Errors, 0 Warnings</span>
                  </span>
                  <span>UTF-8</span>
                  <span>Spaces: 2</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>Ln 12, Col 4</span>
                  <span className="text-[#3fb950]">Yjs Doc Synchronized</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Technical Architecture & Engineering Specifications ─────── */}
      <section
        id="architecture"
        className="border-t border-[#21262d] bg-[#0d1117] py-20"
        aria-labelledby="arch-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-12">
            <span className="text-xs font-mono text-[#58a6ff] uppercase tracking-wider">
              Core Architecture
            </span>
            <h2
              id="arch-heading"
              className="text-2xl sm:text-3xl font-semibold text-[#f0f6fc] mt-1 mb-3"
            >
              Engineered from the ground up for low latency and zero data leaks.
            </h2>
            <p className="text-sm sm:text-base text-[#8b949e] leading-relaxed">
              Every room runs on an isolated CRDT engine with binary delta
              encoding, in-memory virtual filesystem abstraction, and automated
              session lifecycle management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Feature 1 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">01 / CRDT</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#3fb950] bg-[#3fb950]/10">
                  Yjs v13
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Conflict-Free Replicated State
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Deterministic text merging without locking or central OT
                servers. Local edits apply immediately and resolve concurrently
                with delta vector exchange.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">02 / PTY</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#3fb950] bg-[#3fb950]/10">
                  xterm.js
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Shared Pseudoterminal Streaming
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Real-time interactive shell multiplexed across all collaborators.
                Full ANSI color support, stdin/stdout stream routing, and
                process kill signals.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">03 / LIFECYCLE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#e3b341] bg-[#e3b341]/10">
                  15m TTL
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Ephemeral Guest Workspaces
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Guest sessions leave zero lingering database records. Inactive
                guest rooms are purged by background schedulers after 15 minutes,
                guaranteeing code hygiene.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">04 / AST</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#58a6ff] bg-[#58a6ff]/10">
                  Monaco
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                In-Browser IntelliSense & Linting
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Syntax diagnostics, type definitions, autocomplete keyword
                providers, and AST error squiggles for Python, Java, C++, Go,
                Rust, and web stacks.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">05 / RUNTIMES</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#3fb950] bg-[#3fb950]/10">
                  15+ Stacks
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Multi-Language Support
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Native templates for Python 3, Node.js, TypeScript, Go 1.22,
                Rust, C++ (GCC 13), Java 21, Ruby, Kotlin, SQL, PHP, and C#.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 rounded-md bg-[#161b22] border border-[#30363d] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#58a6ff]">06 / VFS</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[#58a6ff] bg-[#58a6ff]/10">
                  In-Memory
                </span>
              </div>
              <h3 className="text-sm font-semibold text-[#f0f6fc]">
                Virtual Filesystem & Zip Export
              </h3>
              <p className="text-xs text-[#8b949e] leading-5">
                Multi-file workspace tree management with nested folders, drag
                and drop upload, batch search & replace, and one-click ZIP archive
                export.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── API / cURL Quick Connect Strip ───────────────────────────── */}
      <section
        id="specs"
        className="border-t border-[#21262d] py-16 bg-[#090d13]"
        aria-labelledby="api-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <span className="text-xs font-mono text-[#58a6ff] uppercase tracking-wider">
                Programmable API
              </span>
              <h2
                id="api-heading"
                className="text-xl sm:text-2xl font-semibold text-[#f0f6fc] mt-1 mb-3"
              >
                Create rooms programmatically.
              </h2>
              <p className="text-xs sm:text-sm text-[#8b949e] leading-relaxed mb-4">
                Integrate SyncStream into your interview workflows, CI/CD triage
                bots, or documentation sandboxes via standard REST endpoints.
              </p>
              <div className="flex items-center gap-4 text-xs font-mono text-[#6e7681]">
                <span>Status: 201 Created</span>
                <span>Payload: JSON</span>
                <span>Auth: Optional Bearer</span>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-md border border-[#30363d] bg-[#0d1117] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d]">
                  <span className="text-xs font-mono text-[#8b949e]">POST /api/rooms</span>
                  <button
                    type="button"
                    onClick={handleCopyCurl}
                    className="text-[11px] font-mono text-[#58a6ff] hover:text-[#79c0ff] cursor-pointer"
                  >
                    {copiedCurl ? "Copied to clipboard" : "Copy cURL"}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-[#c9d1d9] leading-relaxed overflow-x-auto">
                  <span className="text-[#8b949e]"># Create an ephemeral workspace</span>{"\n"}
                  <span className="text-[#ff7b72]">curl</span> -X POST https://syncstream.dev/api/rooms \{"\n"}
                  {"  "}-H <span className="text-[#a5d6ff]">"Content-Type: application/json"</span> \{"\n"}
                  {"  "}-d <span className="text-[#a5d6ff]">'{"{"}"name": "pairing-session-1"{"}"}'</span>{"\n\n"}
                  <span className="text-[#8b949e]"># Response:</span>{"\n"}
                  <span className="text-[#3fb950]">{"{"}</span>{"\n"}
                  {"  "}<span className="text-[#79c0ff]">"roomId"</span>: <span className="text-[#a5d6ff]">"f81d4fae-7dec-11d0-a765"</span>,{"\n"}
                  {"  "}<span className="text-[#79c0ff]">"isGuest"</span>: <span className="text-[#ff7b72]">true</span>,{"\n"}
                  {"  "}<span className="text-[#79c0ff]">"wsUrl"</span>: <span className="text-[#a5d6ff]">"wss://syncstream.dev/ws/code/f81d4fae"</span>{"\n"}
                  <span className="text-[#3fb950]">{"}"}</span>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Keymap / Shortcuts Reference ────────────────────────────── */}
      <section
        id="shortcuts"
        className="border-t border-[#21262d] py-16 bg-[#0d1117]"
        aria-labelledby="keymap-heading"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono text-[#58a6ff] uppercase tracking-wider">
              Keyboard Navigation
            </span>
            <h2
              id="keymap-heading"
              className="text-xl sm:text-2xl font-semibold text-[#f0f6fc] mt-1 mb-2"
            >
              Familiar VS Code keybindings.
            </h2>
            <p className="text-xs sm:text-sm text-[#8b949e]">
              No custom shortcut mappings to memorize. All standard editor
              commands work out of the box.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { key: "Ctrl + `", action: "Toggle Shared Terminal" },
              { key: "Ctrl + Shift + F", action: "Global Workspace Search" },
              { key: "F5 / Ctrl + Enter", action: "Run Code Execution" },
              { key: "Ctrl + Shift + P", action: "Monaco Command Palette" },
              { key: "Alt + Z", action: "Toggle Word Wrap" },
              { key: "Ctrl + S", action: "Trigger File Diagnostics" },
              { key: "Ctrl + B", action: "Toggle Activity Sidebar" },
              { key: "Escape", action: "Close Active Modal / Drawer" },
            ].map(({ key, action }) => (
              <div
                key={key}
                className="p-3 rounded bg-[#161b22] border border-[#30363d] flex items-center justify-between"
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

      {/* ── Workspace Launcher Bottom Banner ────────────────────────── */}
      <section className="border-t border-[#21262d] bg-[#090d13] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-8 rounded-lg border border-[#30363d] bg-[#161b22]">
          <div className="max-w-xl">
            <h3 className="text-xl font-semibold text-[#f0f6fc] mb-1">
              Start collaborating immediately.
            </h3>
            <p className="text-xs sm:text-sm text-[#8b949e]">
              No installation, zero config, and full CRDT synchronization. Share
              a link with your team in under 5 seconds.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onStartRoom}
              className="px-5 py-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              Start New Room
            </button>
            <button
              type="button"
              onClick={onJoinRoom}
              className="px-5 py-2.5 rounded border border-[#30363d] bg-[#0d1117] hover:bg-[#21262d] text-[#c9d1d9] text-xs font-medium transition-colors cursor-pointer"
            >
              Join Existing Room
            </button>
          </div>
        </div>
      </section>

      {/* ── Technical Footer ────────────────────────────────────────── */}
      <footer className="border-t border-[#21262d] bg-[#0d1117] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6e7681]">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-[#58a6ff]"
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
            <span className="font-semibold text-[#c9d1d9]">SyncStream IDE</span>
            <span>·</span>
            <span>CRDT-powered collaboration</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Guest TTL: 15 minutes</span>
            <span>·</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8b949e] hover:text-[#c9d1d9] transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
