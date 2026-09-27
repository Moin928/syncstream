import { useState, useEffect, useRef } from "react"
import { useAuth } from "./AuthContext"

/*
 * AuthModal — deliberately avoids common "vibe-coded" patterns:
 *   • No gradient blobs / glassmorphism / floating orbs
 *   • No gradient text or gradient buttons
 *   • No emojis in labels or buttons
 *   • No particle/grid background decorations
 *   • No oversized corner-radius mismatches
 *   • No animated border glows on focus
 *   • One accent color (#58a6ff) used sparingly
 *   • Consistent 4/8px spacing grid
 *   • Labels above inputs, direct copy
 *   • Error: inline border + text, no toast noise
 */
export function AuthModal({ isOpen, onClose, initialMode = "signin" }) {
  const { login, register, error: authError, clearError } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState("")

  const [usernameOrEmail, setUsernameOrEmail] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")

  const firstInputRef = useRef(null)

  /* Sync external initialMode changes */
  useEffect(() => {
    setMode(initialMode)
    setLocalError("")
  }, [initialMode, isOpen])

  /* Focus first input when modal opens */
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [isOpen, mode])

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const switchMode = (next) => {
    setMode(next)
    setLocalError("")
    clearError()
    setShowPassword(false)
  }

  const errorMsg = localError || authError

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError("")
    setLoading(true)

    try {
      if (mode === "signin") {
        if (!usernameOrEmail.trim() || !password) {
          setLocalError("Username/email and password are required.")
          return
        }
        await login(usernameOrEmail.trim(), password)
        onClose()
      } else {
        if (!username.trim() || !email.trim() || !password) {
          setLocalError("All fields are required.")
          return
        }
        if (password.length < 6) {
          setLocalError("Password must be at least 6 characters.")
          return
        }
        await register(username.trim(), email.trim(), password, displayName.trim())
        onClose()
      }
    } catch {
      /* errors surface via authError */
    } finally {
      setLoading(false)
    }
  }

  return (
    /* Backdrop — solid semi-transparent, no blur noise */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/*
       * Card
       * — max-w-sm keeps it narrow and focused
       * — rounded-md matches the editor's own modal style (not rounded-3xl)
       * — no box-shadow halo; border does the job
       */}
      <div
        className="w-full max-w-sm bg-[#161b22] border border-[#30363d] rounded-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#21262d]">
          <div className="flex items-center gap-2.5">
            {/* Wordmark — no gradient, no glow */}
            <svg
              className="w-5 h-5 text-[#58a6ff]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            <span className="text-sm font-semibold text-[#f0f6fc] tracking-tight">SyncStream</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-6 h-6 flex items-center justify-center rounded text-[#6e7681] hover:text-[#c9d1d9] hover:bg-[#21262d] transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Mode tabs ──────────────────────────────────────────── */}
        {/*
         * Plain underline tabs — no gradient indicator, no bounce animation.
         * Active tab gets a solid #58a6ff bottom border. That's it.
         */}
        <div className="flex border-b border-[#21262d] px-5">
          {[
            { id: "signin", label: "Sign in" },
            { id: "signup", label: "Create account" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchMode(id)}
              className={[
                "py-2.5 mr-5 text-xs font-medium border-b-2 transition-colors",
                mode === id
                  ? "border-[#58a6ff] text-[#f0f6fc]"
                  : "border-transparent text-[#6e7681] hover:text-[#c9d1d9]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Form ───────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-5 pt-4 pb-5 flex flex-col gap-4">

            {/* Error banner — red left border, no modal-within-modal */}
            {errorMsg && (
              <div className="border-l-2 border-[#f85149] pl-3 py-1">
                <p className="text-xs text-[#f85149] leading-snug">{errorMsg}</p>
              </div>
            )}

            {mode === "signin" ? (
              <>
                <Field label="Username or email" htmlFor="auth-identifier">
                  <Input
                    ref={firstInputRef}
                    id="auth-identifier"
                    type="text"
                    autoComplete="username"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="alex or alex@example.com"
                    spellCheck={false}
                  />
                </Field>

                <Field label="Password" htmlFor="auth-password">
                  <PasswordInput
                    id="auth-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="current-password"
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Username" htmlFor="auth-username">
                    <Input
                      ref={firstInputRef}
                      id="auth-username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="alex_dev"
                      spellCheck={false}
                      mono
                    />
                  </Field>

                  <Field label="Display name" htmlFor="auth-displayname" optional>
                    <Input
                      id="auth-displayname"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Dev"
                    />
                  </Field>
                </div>

                <Field label="Email" htmlFor="auth-email">
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    spellCheck={false}
                    mono
                  />
                </Field>

                <Field label="Password" htmlFor="auth-reg-password">
                  <PasswordInput
                    id="auth-reg-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="new-password"
                  />
                  {/* Strength hint — text only, no colored bar animation */}
                  <p className="mt-1 text-[11px] text-[#6e7681]">
                    Minimum 6 characters.
                  </p>
                </Field>
              </>
            )}

            {/* Submit — solid fill, no gradient */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-xs font-medium rounded transition-colors cursor-pointer"
            >
              {loading
                ? mode === "signin" ? "Signing in…" : "Creating account…"
                : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-[#21262d] flex items-center justify-between">
          <span className="text-[11px] text-[#6e7681]">No account needed</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[#58a6ff] hover:underline cursor-pointer"
          >
            Continue as guest
          </button>
        </div>

      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
 * Small, self-contained sub-components kept in this file so the
 * pattern is easy to read in one place.
 * ──────────────────────────────────────────────────────────────── */

function Field({ label, htmlFor, optional, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1">
        <label htmlFor={htmlFor} className="text-xs font-medium text-[#c9d1d9]">
          {label}
        </label>
        {optional && (
          <span className="text-[10px] text-[#6e7681]">(optional)</span>
        )}
      </div>
      {children}
    </div>
  )
}

import { forwardRef } from "react"

const Input = forwardRef(function Input({ mono, className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={[
        "w-full px-3 py-2 rounded bg-[#0d1117] text-[#f0f6fc] text-xs",
        "border border-[#30363d] focus:border-[#58a6ff] focus:outline-none",
        "placeholder:text-[#484f58] transition-colors",
        mono ? "font-mono" : "",
        className,
      ].join(" ")}
      {...props}
    />
  )
})

function PasswordInput({ id, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder="••••••••"
        className="w-full px-3 py-2 pr-9 rounded bg-[#0d1117] text-[#f0f6fc] text-xs font-mono border border-[#30363d] focus:border-[#58a6ff] focus:outline-none placeholder:text-[#484f58] transition-colors"
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#c9d1d9] transition-colors"
      >
        {show ? (
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
  )
}
