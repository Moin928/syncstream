import { useState, useRef, useEffect } from "react"
import { useAuth } from "./AuthContext"

export function UserMenu({ onOpenAuthModal }) {
  const { user, isAuthenticated, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!isAuthenticated || !user) {
    return (
      <button
        type="button"
        onClick={() => onOpenAuthModal("signin")}
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#238636] hover:bg-[#2ea043] text-white transition shadow-sm cursor-pointer"
        title="Sign in or create an account"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        <span>Sign In</span>
      </button>
    )
  }

  const initials = (user.displayName || user.username || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded-md bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] transition cursor-pointer text-xs"
        title={`Signed in as @${user.username}`}
      >
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#1f6feb] to-[#58a6ff] text-white flex items-center justify-center text-[10px] font-bold">
          {initials}
        </div>
        <span className="text-[#f0f6fc] font-medium max-w-[100px] truncate">
          {user.displayName || user.username}
        </span>
        <svg
          className={`w-3 h-3 text-[#8b949e] transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-[#21262d]">
            <div className="font-semibold text-[#f0f6fc] truncate">
              {user.displayName || user.username}
            </div>
            <div className="text-[11px] text-[#8b949e] font-mono truncate">
              @{user.username}
            </div>
            <div className="text-[10px] text-[#58a6ff] truncate mt-0.5">
              {user.email}
            </div>
          </div>

          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                logout()
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[#f85149] hover:bg-[#f851491a] rounded-md transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
