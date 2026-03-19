import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme:       Theme
  toggleTheme: () => void
  isDark:      boolean
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark', toggleTheme: () => {}, isDark: true,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('cr-theme') as Theme | null
      return saved === 'light' ? 'light' : 'dark'
    } catch { return 'dark' }
  })

  useEffect(() => {
    // Apply with no-transition class to prevent flash on initial load
    const html = document.documentElement
    html.classList.add('no-transition')
    html.setAttribute('data-theme', theme)
    try { localStorage.setItem('cr-theme', theme) } catch {}
    // Re-enable transitions after paint
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => html.classList.remove('no-transition'))
    })
    return () => cancelAnimationFrame(t)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
