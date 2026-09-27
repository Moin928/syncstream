import { useState } from "react"
import { useAuth } from "./AuthContext"

export function AuthModal({ isOpen, onClose, initialMode = "signin" }) {
  const { login, register, error, clearError } = useAuth()
  const [mode, setMode] = useState(initialMode) // "signin" | "signup"
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState("")

  // Form states
  const [usernameOrEmail, setUsernameOrEmail] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")

  if (!isOpen) return null

  const handleModeSwitch = (newMode) => {
    setMode(newMode)
    setLocalError("")
    clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError("")
    setLoading(true)

    try {
      if (mode === "signin") {
        if (!usernameOrEmail.trim() || !password) {
          setLocalError("Please enter your username/email and password.")
          setLoading(false)
          return
        }
        await login(usernameOrEmail.trim(), password)
      } else {
        if (!username.trim() || !email.trim() || !password) {
          setLocalError("All fields are required.")
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setLocalError("Password must be at least 6 characters.")
          setLoading(false)
          return
        }
        await register(username.trim(), email.trim(), password, displayName.trim())
      }
      onClose()
    } catch (err) {
      setLocalError(err.message || "Authentication failed. Please check your credentials.")
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#21262d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#58a6ff]/10 border border-[#58a6ff]/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#58a6ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f6fc]">
                {mode === "signin" ? "Sign in to SyncStream" : "Create SyncStream Account"}
              </h2>
              <p className="text-xs text-[#8b949e]">
                {mode === "signin"
                  ? "Access your saved workspaces & live identity"
                  : "Join collaborative rooms with a verified identity"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#f0f6fc] p-1.5 rounded-md hover:bg-[#21262d] transition"
            title="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#21262d] bg-[#0d1117]/50 p-1">
          <button
            type="button"
            onClick={() => handleModeSwitch("signin")}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition ${
              mode === "signin"
                ? "bg-[#21262d] text-[#f0f6fc] shadow-sm"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("signup")}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition ${
              mode === "signup"
                ? "bg-[#21262d] text-[#f0f6fc] shadow-sm"
                : "text-[#8b949e] hover:text-[#c9d1d9]"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {displayError && (
            <div className="p-3 rounded-lg bg-[#f851491a] border border-[#f8514940] text-[#f85149] text-xs flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{displayError}</span>
            </div>
          )}

          {mode === "signin" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#c9d1d9]">Username or Email</label>
                <input
                  type="text"
                  autoFocus
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="e.g. alex or alex@example.com"
                  className="p-2.5 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#c9d1d9]">Password</label>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#c9d1d9] p-1"
                  >
                    {showPassword ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#c9d1d9]">Username</label>
                  <input
                    type="text"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex_dev"
                    className="p-2.5 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition font-mono"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#c9d1d9]">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Dev"
                    className="p-2.5 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#c9d1d9]">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="p-2.5 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#c9d1d9]">Password (min 6 chars)</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 rounded-lg bg-[#0d1117] text-[#f0f6fc] text-xs outline-none border border-[#30363d] focus:border-[#58a6ff] transition font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#c9d1d9] p-1"
                  >
                    {showPassword ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeLinecap="round" />
                </svg>
                <span>{mode === "signin" ? "Signing In..." : "Creating Account..."}</span>
              </>
            ) : (
              <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="px-6 py-3 bg-[#0d1117] border-t border-[#21262d] flex items-center justify-between text-[11px] text-[#8b949e]">
          <span>Need to jump right in?</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#58a6ff] hover:underline font-medium"
          >
            Continue as Guest &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
