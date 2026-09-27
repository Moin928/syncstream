import { useState, useRef, useEffect } from "react"
import { useAuth } from "./AuthContext"

/*
 * UserMenu — no floating-card glassmorphism, no gradient avatar rings,
 * no animated badge pulses. Just a tight, functional dropdown that matches
 * the editor's existing header style.
 */
export function UserMenu({ onOpenAuthModal }) {
  const { user, isAuthenticated, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  /* ── Not signed in ─────────────────────────────────────────── */
  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => onOpenAuthModal("signin")}
        className="px-2.5 py-1 text-xs font-medium rounded border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] transition-colors cursor-pointer"
      >
        Sign in
      </button>
    )
  }

  /* ── Avatar initials — deterministic, flat color, no gradient ─ */
  const initials = (user.displayName || user.username || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] text-xs text-[#c9d1d9] transition-colors cursor-pointer"
      >
        {/* Flat avatar swatch — no gradient, no glow ring */}
        <span
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-[#0d1117] flex-shrink-0"
          style={{ backgroundColor: avatarColor(user.username) }}
          aria-hidden
        >
          {initials}
        </span>
        <span className="max-w-[96px] truncate font-medium text-[#f0f6fc]">
          {user.displayName || user.username}
        </span>
        {/* Chevron — rotates, no spring animation */}
        <svg
          className={`w-3 h-3 text-[#6e7681] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        /* Dropdown — same bg/border as the rest of the UI, no backdrop-blur */
        <div className="absolute right-0 top-full mt-1 w-52 bg-[#161b22] border border-[#30363d] rounded-md shadow-lg z-50 py-1">
          <div className="px-3 py-2 border-b border-[#21262d]">
            <p className="text-xs font-semibold text-[#f0f6fc] truncate">
              {user.displayName || user.username}
            </p>
            <p className="text-[11px] text-[#6e7681] font-mono truncate">@{user.username}</p>
          </div>

          <div className="py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); logout() }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#f85149] hover:bg-[#21262d] transition-colors cursor-pointer text-left"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* Derives a muted, consistent colour from the username string.
 * Uses a small palette of the same tones as the rest of the UI — no neons. */
function avatarColor(name = "") {
  const palette = [
    "#388bfd", // blue
    "#3fb950", // green
    "#d29922", // yellow
    "#58a6ff", // light blue
    "#bc8cff", // muted purple
    "#ff7b72", // muted red
    "#79c0ff", // sky
    "#56d364", // lime green
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}
