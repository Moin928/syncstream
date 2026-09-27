import { createContext, useContext, useState, useEffect, useCallback } from "react"

const AuthContext = createContext(null)

const API_BASE_URL = "http://localhost:8080"
const TOKEN_KEY = "syncstream_auth_token"
const USER_KEY = "syncstream_auth_user"

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verify stored token on startup
  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      if (!storedToken) {
        if (isMounted) setIsLoading(false)
        return
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        })

        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setUser(data.user)
            localStorage.setItem(USER_KEY, JSON.stringify(data.user))
          }
        } else {
          // Token invalid or expired
          if (isMounted) {
            setToken(null)
            setUser(null)
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(USER_KEY)
          }
        }
      } catch (err) {
        console.warn("Auth check failed (offline or server starting up):", err)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (usernameOrEmail, password) => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ usernameOrEmail, password })
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.message || "Failed to log in"
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      setToken(data.token)
      setUser(data.user)
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return data
    } catch (err) {
      if (!error) setError(err.message || "Network error. Please try again.")
      throw err
    }
  }, [error])

  const register = useCallback(async (username, email, password, displayName) => {
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, email, password, displayName })
      })

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.message || "Failed to register"
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      setToken(data.token)
      setUser(data.user)
      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return data
    } catch (err) {
      if (!error) setError(err.message || "Network error. Please try again.")
      throw err
    }
  }, [error])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setError(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  const updateProfile = useCallback(async (displayName, avatar) => {
    if (!token) return
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, avatar })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile")
      }

      setUser(data.user)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      return data.user
    } catch (err) {
      setError(err.message || "Failed to update profile")
      throw err
    }
  }, [token])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    clearError
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
