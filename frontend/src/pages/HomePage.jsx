/**
 * SyncStream – Home / Landing Page
 *
 * Design constraints (enforced throughout):
 *  - No gradient blobs / aura orbs in backgrounds
 *  - No glassmorphism (backdrop-blur)
 *  - No gradient text (bg-clip-text)
 *  - No gradient buttons
 *  - No particles / CSS grid decorations
 *  - No emojis in UI — SVG icons only
 *  - No "join 10k+ devs" social-proof fluff
 *  - No bounce / shimmer / wiggle animations
 *  - 8 px grid spacing, consistent border-radius (6 px)
 *  - Two neutral surfaces + one blue accent (#58a6ff)
 *  - Monospace for code / identifiers
 */

export function HomePage({ onStartRoom, onJoinRoom }) {
  return (
    <div className="min-h-screen bg-[#090d13] text-[#f0f6fc]">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="border-b border-[#21262d] bg-[#0d1117]"
        aria-label="Site navigation"
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Brand */}
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
            <span className="text-sm font-semibold tracking-tight">
              SyncStream
            </span>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#f0f6fc] rounded transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </a>
            <button
              type="button"
              onClick={onStartRoom}
              className="ml-2 px-3 py-1.5 text-xs font-medium rounded bg-[#238636] hover:bg-[#2ea043] text-white transition-colors cursor-pointer"
            >
              Start a room
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-8 rounded bg-[#161b22] border border-[#30363d] text-[11px] text-[#8b949e] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] flex-shrink-0" />
          No account required · Free to use
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-[#f0f6fc] leading-tight max-w-2xl mb-5">
          Code together,{" "}
          <span className="text-[#58a6ff]">in real time.</span>
        </h1>

        <p className="text-base text-[#8b949e] max-w-xl leading-relaxed mb-10">
          SyncStream is a browser-based collaborative IDE. Open a room, share
          the link, and edit code simultaneously with your team — no setup, no
          install, no account needed.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onStartRoom}
            className="px-5 py-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Start a room
          </button>
          <button
            type="button"
            onClick={onJoinRoom}
            className="px-5 py-2.5 rounded border border-[#30363d] bg-[#161b22] hover:bg-[#21262d] text-[#c9d1d9] text-sm font-medium transition-colors cursor-pointer"
          >
            Join existing room
          </button>
        </div>

        {/* Terminal preview strip */}
        <div className="mt-14 rounded-md border border-[#30363d] overflow-hidden">
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#161b22] border-b border-[#30363d]">
            <span className="w-3 h-3 rounded-full bg-[#21262d]" />
            <span className="w-3 h-3 rounded-full bg-[#21262d]" />
            <span className="w-3 h-3 rounded-full bg-[#21262d]" />
            <span className="ml-3 text-[11px] text-[#6e7681] font-mono">
              main.py — SyncStream
            </span>
          </div>
          {/* Code */}
          <div className="px-5 py-5 bg-[#0d1117] font-mono text-xs leading-6 overflow-x-auto">
            <pre className="text-[#f0f6fc]">
              <span className="text-[#ff7b72]">def</span>{" "}
              <span className="text-[#d2a8ff]">greet</span>
              <span className="text-[#8b949e]">(</span>
              <span className="text-[#ffa657]">name</span>
              <span className="text-[#8b949e]">):</span>{"\n"}
              {"    "}
              <span className="text-[#ff7b72]">return</span>{" "}
              <span className="text-[#a5d6ff]">f</span>
              <span className="text-[#a5d6ff]">"Hello, </span>
              <span className="text-[#79c0ff]">{"{"}</span>
              <span className="text-[#f0f6fc]">name</span>
              <span className="text-[#79c0ff]">{"}"}</span>
              <span className="text-[#a5d6ff]">!"</span>
              {"\n\n"}
              <span className="text-[#8b949e]"># Both Alice and Bob see this change instantly</span>{"\n"}
              <span className="text-[#ff7b72]">print</span>
              <span className="text-[#8b949e]">(</span>
              greet
              <span className="text-[#8b949e]">(</span>
              <span className="text-[#a5d6ff]">"team"</span>
              <span className="text-[#8b949e]">))</span>
            </pre>
          </div>
          {/* Collaborators strip */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-[#161b22] border-t border-[#21262d]">
            <span className="text-[11px] text-[#6e7681]">Editing now:</span>
            {[
              { initials: "AL", color: "#388bfd" },
              { initials: "BK", color: "#3fb950" },
              { initials: "MR", color: "#db6d28" },
            ].map(({ initials, color }) => (
              <span
                key={initials}
                aria-label={`Collaborator ${initials}`}
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-[#0d1117]"
                style={{ backgroundColor: color }}
              >
                {initials}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section
        className="border-t border-[#21262d] bg-[#0d1117]"
        aria-labelledby="features-heading"
      >
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2
            id="features-heading"
            className="text-xl font-semibold text-[#f0f6fc] mb-2"
          >
            Everything you need in the browser
          </h2>
          <p className="text-sm text-[#8b949e] mb-10">
            No extensions, no local install — just a URL.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#21262d]">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
                title: "Real-time sync",
                body: "Conflict-free CRDT engine (Yjs) keeps every cursor and keystroke in sync across all participants.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
                title: "Integrated terminal",
                body: "Run code directly in the browser. Persistent shell session shared with your whole team.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                title: "15 languages",
                body: "Python, JavaScript, TypeScript, Java, C++, Go, Rust, C#, Ruby, PHP, Kotlin, Swift, SQL and more.",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ),
                title: "Instant sharing",
                body: "Share a single URL. Collaborators can join immediately — no account, no download.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="bg-[#0d1117] p-6 flex flex-col gap-3"
              >
                <span className="text-[#58a6ff]">{icon}</span>
                <h3 className="text-sm font-semibold text-[#f0f6fc]">{title}</h3>
                <p className="text-xs text-[#8b949e] leading-5">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section
        className="border-t border-[#21262d]"
        aria-labelledby="how-heading"
      >
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2
            id="how-heading"
            className="text-xl font-semibold text-[#f0f6fc] mb-2"
          >
            Up and running in seconds
          </h2>
          <p className="text-sm text-[#8b949e] mb-12">
            Three steps. No configuration.
          </p>

          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-8" role="list">
            {[
              {
                step: "01",
                title: "Create a room",
                body: 'Click "Start a room". The server generates a unique room ID and a shareable URL.',
              },
              {
                step: "02",
                title: "Share the link",
                body: "Copy the room URL from the address bar or the share button. Send it however you like.",
              },
              {
                step: "03",
                title: "Code together",
                body: "Everyone who opens the link can edit the same files. Changes propagate in under 50 ms.",
              },
            ].map(({ step, title, body }) => (
              <li key={step} className="flex flex-col gap-3">
                <span className="font-mono text-xs text-[#58a6ff]">{step}</span>
                <div className="h-px w-8 bg-[#30363d]" />
                <h3 className="text-sm font-semibold text-[#f0f6fc]">{title}</h3>
                <p className="text-xs text-[#8b949e] leading-5">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── CTA strip ───────────────────────────────────────────── */}
      <section className="border-t border-[#21262d] bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-base font-semibold text-[#f0f6fc] mb-1">
              Ready to collaborate?
            </p>
            <p className="text-sm text-[#8b949e]">
              Create a room now. Rooms without an account are removed after 15 minutes of inactivity.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onStartRoom}
              className="px-5 py-2.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Start a room
            </button>
            <button
              type="button"
              onClick={onJoinRoom}
              className="px-5 py-2.5 rounded border border-[#30363d] bg-transparent hover:bg-[#161b22] text-[#c9d1d9] text-sm font-medium transition-colors cursor-pointer"
            >
              Join a room
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-[#21262d]">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg
              aria-hidden="true"
              className="w-4 h-4 text-[#8b949e]"
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
            <span className="text-xs text-[#6e7681]">SyncStream</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-[11px] text-[#6e7681]">
              No account required
            </span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[#6e7681] hover:text-[#c9d1d9] transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
