import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  Clock3,
  UserRound,
  RefreshCw,
} from 'lucide-react'
import EmployeePortal from './EmployeePortal'

const API = (
  (import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env
    .VITE_API_URL || 'http://localhost:4000/api'
).replace(/\/$/, '')

type Admin = {
  id: string
  cateringServiceName: string
  adminName: string
  email: string
  mobile: string
}

type Employee = {
  _id: string
  name: string
  mobile: string
  city: string
}

type Order = {
  _id: string
  city: string
  peopleNeeded: number
  eventDateTime: string
  assignedEmployees: Employee[]
}

type ToastItem = {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
}

type Page = 'Dashboard' | 'Orders' | 'Employers Details'

function handleEnterNext(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter') return

  const target = e.target as HTMLElement

  if (target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') return

  e.preventDefault()

  const form = e.currentTarget

  const controls = Array.from(
    form.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), button[type="submit"]:not([disabled])',
    ),
  ).filter(
    (el) =>
      el.getAttribute('type') !== 'checkbox' &&
      el.getAttribute('type') !== 'button',
  )

  const index = controls.indexOf(target)
  const next = controls[index + 1]

  if (next) next.focus()
  else form.requestSubmit()
}

function titleCase(value: string) {
  return value.toLocaleUpperCase()
}

function niceDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

function localDateTimeInput(date = new Date()) {
  const adjusted = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  )

  return adjusted.toISOString().slice(0, 16)
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('er_token') || '',
  )

  const [role, setRole] = useState<'admin' | 'employee'>(
    () =>
      (localStorage.getItem('er_role') as 'admin' | 'employee') || 'admin',
  )

  const [admin, setAdmin] = useState<Admin | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('er_admin') || 'null')
    } catch {
      return null
    }
  })

  const [page, setPage] = useState<Page>('Dashboard')
  const [authPage, setAuthPage] = useState<'Login' | 'Register'>('Login')
  const [toastList, setToastList] = useState<ToastItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)

  const toast = useCallback(
    (message: string, kind: ToastItem['kind'] = 'success') => {
      const id = Date.now() + Math.random()

      setToastList((items) => [...items, { id, message, kind }])

      window.setTimeout(() => {
        setToastList((items) => items.filter((item) => item.id !== id))
      }, 3800)
    },
    [],
  )

  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong.')
      }

      return data
    },
    [token],
  )

  const logout = () => {
    localStorage.removeItem('er_token')
    localStorage.removeItem('er_admin')
    localStorage.removeItem('er_role')

    setToken('')
    setAdmin(null)
    setRole('admin')
    setPage('Dashboard')
    setAuthPage('Login')

    toast('Logged out successfully.', 'info')
  }

  const loadData = useCallback(async () => {
    if (!token) return

    setLoading(true)

    try {
      const [employeeData, orderData] = await Promise.all([
        api('/employees'),
        api('/orders'),
      ])

      setEmployees(employeeData)
      setOrders(orderData)
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Could not load data.',
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [api, token, toast])

  useEffect(() => {
    if (token && admin) void loadData()
  }, [token, admin, loadData])

  const handleLogin = async (email: string, password: string) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: email.toLowerCase(),
        password,
      }),
    })

    localStorage.setItem('er_token', data.token)
    localStorage.setItem('er_role', 'admin')
    localStorage.setItem('er_admin', JSON.stringify(data.admin))

    setRole('admin')
    setToken(data.token)
    setAdmin(data.admin)

    toast('Welcome back!')
    setPage('Dashboard')
  }

  const handleEmployeeLogin = async (
    mobile: string,
    password: string,
  ) => {
    const data = await api('/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    })

    localStorage.setItem('er_token', data.token)
    localStorage.setItem('er_role', 'employee')
    localStorage.removeItem('er_admin')

    setToken(data.token)
    setAdmin(null)
    setRole('employee')

    toast('Employee login successful!')
  }

  const handleRegister = async (form: Record<string, string>) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        email: form.email.toLowerCase(),
      }),
    })

    localStorage.setItem('er_token', data.token)
    localStorage.setItem('er_role', 'admin')
    localStorage.setItem('er_admin', JSON.stringify(data.admin))

    setRole('admin')
    setToken(data.token)
    setAdmin(data.admin)

    toast('Account created successfully!')
    setPage('Dashboard')
  }

  return (
    <div className="min-h-screen bg-[#080e19] text-slate-100">
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toastList.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl ${
              item.kind === 'error'
                ? 'border-rose-400/30 bg-rose-950/95 text-rose-100'
                : item.kind === 'info'
                  ? 'border-sky-400/30 bg-slate-900/95 text-sky-100'
                  : 'border-emerald-400/30 bg-emerald-950/95 text-emerald-100'
            }`}
          >
            <span className="mt-0.5">●</span>
            <p className="flex-1 text-sm">{item.message}</p>
            <button
              onClick={() =>
                setToastList((items) =>
                  items.filter((t) => t.id !== item.id),
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {!token ? (
        <AuthScreen
          authPage={authPage}
          setAuthPage={setAuthPage}
          api={api}
          onLogin={handleLogin}
          onEmployeeLogin={handleEmployeeLogin}
          onRegister={handleRegister}
          toast={toast}
        />
      ) : role === 'employee' ? (
        <EmployeePortal
          token={token}
          onLogout={logout}
          onPasswordChanged={() =>
            toast('Password updated successfully.')
          }
        />
      ) : !admin ? (
        <AuthScreen
          authPage={authPage}
          setAuthPage={setAuthPage}
          api={api}
          onLogin={handleLogin}
          onEmployeeLogin={handleEmployeeLogin}
          onRegister={handleRegister}
          toast={toast}
        />
      ) : (
        <div className="min-h-screen">        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[#0b1220] p-5 transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-10 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-slate-950">
              <ChefHat size={23} />
            </div>
            <div>
              <p className="font-bold tracking-wide">EVENT ROSTER</p>
              <p className="text-xs text-slate-500">Catering operations</p>
            </div>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X />
            </button>
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">
            Workspace
          </p>

          <nav className="space-y-2">
            {(
              [
                { name: 'Dashboard' as Page, icon: LayoutDashboard },
                { name: 'Orders' as Page, icon: ClipboardList },
                { name: 'Employers Details' as Page, icon: Users },
              ]
            ).map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  setPage(item.name)
                  setSidebarOpen(false)
                  window.scrollTo({ top: 0, behavior: 'auto' })
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  page === item.name
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="mb-3 flex items-center gap-2 text-emerald-300">
              <ShieldCheck size={17} />
              <span className="text-xs font-semibold">Admin account</span>
            </div>
            <p className="truncate text-sm font-semibold">{admin.adminName}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{admin.email}</p>
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-sm text-slate-300 hover:bg-white/5"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="min-h-screen lg:pl-64">
          <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/10 bg-[#080e19]/90 px-4 backdrop-blur-xl sm:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-white/10 p-2 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={19} />
              </button>
              <button
                onClick={() => {
                  setPage('Dashboard')
                  window.scrollTo({ top: 0, behavior: 'auto' })
                }}
                className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white sm:flex"
              >
                <ChevronLeft size={15} /> Back to dashboard
              </button>
              <span className="text-sm font-semibold sm:hidden">{page}</span>
              <span className="hidden text-sm font-semibold sm:block">{page}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{admin.cateringServiceName}</p>
                <p className="text-xs text-slate-500">{admin.email}</p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <UserRound size={19} />
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="rounded-xl border border-white/10 p-2 text-slate-400 hover:text-white"
              >
                <LogOut size={17} />
              </button>
            </div>
          </header>

          <main className="mx-auto max-w-7xl p-4 sm:p-8">
            {page === 'Dashboard' && (
              <Dashboard
                admin={admin}
                employees={employees}
                orders={orders}
                go={setPage}
              />
            )}

            {page === 'Employers Details' && (
              <EmployeesPage
                api={api}
                employees={employees}
                setEmployees={setEmployees}
                refresh={loadData}
                toast={toast}
              />
            )}

            {page === 'Orders' && (
              <OrdersPage
                api={api}
                employees={employees}
                orders={orders}
                setOrders={setOrders}
                refresh={loadData}
                toast={toast}
              />
            )}

            {loading && (
              <div className="mt-4 text-xs text-slate-500">
                Refreshing data…
              </div>
            )}
          </main>
        </div>
      </div>
      )}
    </div>
  )
}

function AuthScreen({
  authPage,
  setAuthPage,
  api,
  onLogin,
  onEmployeeLogin,
  onRegister,
  toast,
}: {
  authPage: 'Login' | 'Register'
  setAuthPage: (p: 'Login' | 'Register') => void
  api: (path: string, options?: RequestInit) => Promise<any>
  onLogin: (email: string, password: string) => Promise<void>
  onEmployeeLogin: (mobile: string, password: string) => Promise<void>
  onRegister: (form: Record<string, string>) => Promise<void>
  toast: (m: string, k?: ToastItem['kind']) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const [register, setRegister] = useState({
    cateringServiceName: '',
    adminName: '',
    email: '',
    mobile: '',
    password: '',
    otp: '',
  })

  const [login, setLogin] = useState({ email: '', password: '' })

  const [employeeLogin, setEmployeeLogin] = useState({
    mobile: '',
    password: '',
  })

  const [loginMode, setLoginMode] = useState<'admin' | 'employee'>('admin')
  const [resendWait, setResendWait] = useState(0)

  useEffect(() => {
    if (resendWait <= 0) return

    const id = window.setTimeout(() => setResendWait((v) => v - 1), 1000)

    return () => window.clearTimeout(id)
  }, [resendWait])

  const sendOtp = async () => {
    if (!register.email.trim()) {
      return toast('Enter your email address first.', 'error')
    }

    setBusy(true)

    try {
      const result = await api('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email: register.email.toLowerCase() }),
      })

      toast(result.message)
      setOtpSent(true)
      setResendWait(30)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send OTP.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)

    try {
      await onLogin(login.email, login.password)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Login failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitEmployeeLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)

    try {
      await onEmployeeLogin(employeeLogin.mobile.trim(), employeeLogin.password)
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Employee login failed.',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)

    try {
      await onRegister({
        ...register,
        cateringServiceName: register.cateringServiceName.trim(),
        adminName: register.adminName.trim(),
        email: register.email.trim(),
        mobile: register.mobile.trim(),
      })
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Registration failed.',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#080e19] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />
      <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220]/95 shadow-2xl lg:grid-cols-[.85fr_1.15fr]">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-emerald-400 to-teal-700 p-10 text-slate-950 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-emerald-300">
              <ChefHat size={26} />
            </div>
            <span className="text-lg font-black tracking-wide">EVENT ROSTER</span>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[.25em]">
              Plan better. Serve smarter.
            </p>
            <h1 className="text-4xl font-black leading-tight">
              Your events.
              <br />
              Your crew.
              <br />
              One clear roster.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-950/75">
              Keep catering events and staff assignments organized in one place.
            </p>
          </div>

          <p className="text-xs text-slate-950/70">
            Catering team management workspace
          </p>
        </section>

        <section className="p-5 sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400 text-slate-950">
              <ChefHat />
            </div>
            <span className="font-black tracking-wide">EVENT ROSTER</span>
          </div>          <div className="mb-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-300">
              {authPage === 'Login' ? 'Welcome back' : 'Get started'}
            </p>
            <h2 className="text-3xl font-bold">
              {authPage === 'Login'
                ? 'Sign in to your account'
                : 'Create your workspace'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {authPage === 'Login'
                ? 'Manage your events and crew from one place.'
                : 'Set up your catering service in a few steps.'}
            </p>
          </div>

          {authPage === 'Login' ? (
            loginMode === 'employee' ? (
              <div>
                <div className="mb-5 flex rounded-xl border border-white/10 bg-[#080e19] p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMode('admin')}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-slate-400"
                  >
                    Admin login
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('employee')}
                    className="flex-1 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950"
                  >
                    Employee login
                  </button>
                </div>

                <form
                  onKeyDown={handleEnterNext}
                  onSubmit={submitEmployeeLogin}
                  className="space-y-5"
                >
                  <Field label="Employee mobile number">
                    <input
                      autoFocus
                      required
                      type="tel"
                      autoComplete="tel"
                      value={employeeLogin.mobile}
                      onChange={(e) =>
                        setEmployeeLogin({
                          ...employeeLogin,
                          mobile: e.target.value,
                        })
                      }
                      placeholder="Enter your registered mobile"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Password">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={employeeLogin.password}
                      onChange={(e) =>
                        setEmployeeLogin({
                          ...employeeLogin,
                          password: e.target.value,
                        })
                      }
                      placeholder="Enter your password"
                      className={inputClass}
                    />
                  </Field>

                  <button
                    disabled={busy}
                    className="w-full rounded-xl bg-emerald-400 px-4 py-3.5 text-sm font-bold text-slate-950 disabled:opacity-50"
                  >
                    {busy ? 'Please wait…' : 'Employee login'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginMode('admin')}
                    className="w-full text-sm text-slate-400 hover:text-white"
                  >
                    Back to admin login
                  </button>
                </form>
              </div>
            ) : (
              <div>
                <div className="mb-5 flex rounded-xl border border-white/10 bg-[#080e19] p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMode('admin')}
                    className="flex-1 rounded-lg bg-emerald-400 px-3 py-2 text-sm font-bold text-slate-950"
                  >
                    Admin login
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMode('employee')}
                    className="flex-1 rounded-lg px-3 py-2 text-sm text-slate-400"
                  >
                    Employee login
                  </button>
                </div>

                <form
                  onKeyDown={handleEnterNext}
                  onSubmit={submitLogin}
                  className="space-y-5"
                >
                  <Field label="Admin email address">
                    <input
                      autoFocus
                      required
                      type="email"
                      autoComplete="email"
                      value={login.email}
                      onChange={(e) =>
                        setLogin({ ...login, email: e.target.value })
                      }
                      placeholder="admin@example.com"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Password">
                    <div className="relative">
                      <input
                        required
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={login.password}
                        onChange={(e) =>
                          setLogin({ ...login, password: e.target.value })
                        }
                        placeholder="Enter your password"
                        className={`${inputClass} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </Field>

                  <button
                    disabled={busy}
                    className="w-full rounded-xl bg-emerald-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                  >
                    {busy ? 'Please wait…' : 'Login'}
                  </button>

                  <p className="text-center text-sm text-slate-400">
                    New to Event Roster?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthPage('Register')}
                      className="font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      Create account
                    </button>
                  </p>
                </form>
              </div>
            )
          ) : (
            <form
              onKeyDown={handleEnterNext}
              onSubmit={submitRegister}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Catering service name">
                  <input
                    required
                    value={register.cateringServiceName}
                    onChange={(e) =>
                      setRegister({
                        ...register,
                        cateringServiceName: titleCase(e.target.value),
                      })
                    }
                    placeholder="ROYAL CATERING"
                    className={inputClass}
                  />
                </Field>

                <Field label="Admin name">
                  <input
                    required
                    value={register.adminName}
                    onChange={(e) =>
                      setRegister({
                        ...register,
                        adminName: titleCase(e.target.value),
                      })
                    }
                    placeholder="YOUR NAME"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Admin email ID">
                <div className="flex gap-2">
                  <input
                    required
                    type="email"
                    value={register.email}
                    onChange={(e) => {
                      setRegister({ ...register, email: e.target.value })
                      setOtpSent(false)
                    }}
                    placeholder="admin@example.com"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={busy || resendWait > 0}
                    onClick={() => void sendOtp()}
                    className="shrink-0 rounded-xl border border-emerald-400/30 px-3 text-xs font-bold text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40"
                  >
                    {otpSent
                      ? resendWait > 0
                        ? `Resend ${resendWait}s`
                        : 'Resend OTP'
                      : 'Send OTP'}
                  </button>
                </div>
              </Field>

              <Field label="Email OTP">
                <input
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={register.otp}
                  onChange={(e) =>
                    setRegister({
                      ...register,
                      otp: e.target.value.replace(/\D/g, ''),
                    })
                  }
                  placeholder="6-digit code"
                  className={inputClass}
                />
              </Field>

              <Field label="Admin mobile number">
                <input
                  required
                  type="tel"
                  value={register.mobile}
                  onChange={(e) =>
                    setRegister({
                      ...register,
                      mobile: titleCase(e.target.value),
                    })
                  }
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </Field>

              <Field label="Password (minimum 8 characters)">
                <div className="relative">
                  <input
                    required
                    minLength={8}
                    type={showPassword ? 'text' : 'password'}
                    value={register.password}
                    onChange={(e) =>
                      setRegister({ ...register, password: e.target.value })
                    }
                    placeholder="Create a strong password"
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </Field>

              <button
                disabled={busy || !otpSent}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
              >
                {busy ? 'Creating account…' : 'Verify OTP & Register'}
              </button>

              <p className="text-center text-sm text-slate-400">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => setAuthPage('Login')}
                  className="font-semibold text-emerald-300"
                >
                  Login
                </button>
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {children}
    </label>
  )
}

function Dashboard({
  admin,
  employees,
  orders,
  go,
}: {
  admin: Admin
  employees: Employee[]
  orders: Order[]
  go: (p: Page) => void
}) {
  const upcoming = orders.filter(
    (o) => new Date(o.eventDateTime).getTime() >= Date.now(),
  ).length

  const assigned = orders.reduce(
    (sum, o) => sum + o.assignedEmployees.length,
    0,
  )

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 via-[#101c2a] to-[#111827] p-6 sm:p-10">
        <div className="absolute -right-8 -top-16 h-64 w-64 rounded-full border-[35px] border-emerald-300/5" />
        <div className="relative max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {admin.cateringServiceName}
          </div>
          <p className="text-sm text-slate-400">WELCOME BACK</p>
          <h1 className="mt-2 text-3xl font-black sm:text-5xl">
            Welcome, {admin.adminName}!
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
            Your catering team, events, and assignments — organized in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => go('Orders')}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-300"
            >
              <Plus size={17} /> Manage orders
            </button>
            <button
              onClick={() => go('Employers Details')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10"
            >
              <Users size={17} /> Manage employees
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold">Overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            A quick view of your catering operations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Total employees',
              value: employees.length,
              icon: Users,
              sub: 'Registered team members',
            },
            {
              label: 'Total orders',
              value: orders.length,
              icon: ClipboardList,
              sub: 'All catering events',
            },
            {
              label: 'Upcoming events',
              value: upcoming,
              icon: CalendarDays,
              sub: 'Scheduled from now',
            },
            {
              label: 'Staff assignments',
              value: assigned,
              icon: UserRound,
              sub: 'Assigned across orders',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/10 bg-white/[.03] p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">{card.label}</p>
                <div className="rounded-xl bg-emerald-300/10 p-2.5 text-emerald-300">
                  <card.icon size={19} />
                </div>
              </div>
              <p className="mt-5 text-3xl font-black">{card.value}</p>
              <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold">Quick access</h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump straight to the work you need.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <QuickCard
            icon={ClipboardList}
            title="Orders & assignments"
            desc="Create event orders and choose employees for each catering location."
            action="Open orders"
            onClick={() => go('Orders')}
          />
          <QuickCard
            icon={Users}
            title="Employee directory"
            desc="Add team members, update their details, or remove old records."
            action="Open employee details"
            onClick={() => go('Employers Details')}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[.02] p-5">
        <div className="flex items-center gap-3">
          <div className="text-emerald-300">
            <Mail size={19} />
          </div>
          <div>
            <p className="text-sm font-semibold">Signed in as {admin.email}</p>
            <p className="mt-1 text-xs text-slate-500">
              Account details are linked to this workspace.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function QuickCard({
  icon: Icon,
  title,
  desc,
  action,
  onClick,
}: {
  icon: any
  title: string
  desc: string
  action: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5 text-left transition hover:border-emerald-300/30 hover:bg-emerald-300/[.04]"
    >
      <div className="rounded-xl bg-emerald-300/10 p-3 text-emerald-300">
        <Icon size={21} />
      </div>
      <div className="flex-1">
        <h3 className="font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
        <p className="mt-4 text-xs font-bold text-emerald-300">{action} →</p>
      </div>
    </button>
  )
}const inputStyle =
  'w-full rounded-xl border border-white/10 bg-[#080e19] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10'

function PageHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mb-2">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[.22em] text-emerald-300">
        {eyebrow}
      </p>
      <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
    </div>
  )
}

function EmployeesPage({
  api,
  employees,
  setEmployees,
  refresh,
  toast,
}: {
  api: (path: string, options?: RequestInit) => Promise<any>
  employees: Employee[]
  setEmployees: (v: Employee[]) => void
  refresh: () => Promise<void>
  toast: (m: string, k?: ToastItem['kind']) => void
}) {
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '', city: '' })

  const reset = () => {
    setForm({ name: '', mobile: '', city: '' })
    setEditId('')
    setOpen(false)
  }

  const startEdit = (employee: Employee) => {
    setEditId(employee._id)
    setForm({
      name: employee.name,
      mobile: employee.mobile,
      city: employee.city,
    })
    setOpen(true)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)

    try {
      const result = await api(
        editId ? `/employees/${editId}` : '/employees',
        {
          method: editId ? 'PUT' : 'POST',
          body: JSON.stringify(form),
        },
      )

      const savedEmployee = editId ? result : result.employee

      setEmployees(
        editId
          ? employees.map((employee) =>
              employee._id === editId ? savedEmployee : employee,
            )
          : [savedEmployee, ...employees],
      )

      if (!editId && result.temporaryPassword) {
        window.alert(
          `Employee account created!\n\nName: ${savedEmployee.name}\nMobile/login ID: ${savedEmployee.mobile}\nTemporary password: ${result.temporaryPassword}\n\nCopy this password now and share it securely. It will not be shown again.`,
        )
      }

      toast(
        editId
          ? 'Employee details updated.'
          : 'Employee account created. Save the temporary password shown.',
        'info',
      )

      reset()
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Could not save employee.',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (employee: Employee) => {
    if (
      !window.confirm(
        `Delete ${employee.name}? This also removes them from assignments.`,
      )
    ) {
      return
    }

    try {
      await api(`/employees/${employee._id}`, { method: 'DELETE' })

      setEmployees(
        employees.filter((item) => item._id !== employee._id),
      )

      await refresh()
      toast('Employee deleted.')
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Could not delete employee.',
        'error',
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="TEAM DIRECTORY"
        title="Employers Details"
        subtitle="Keep your catering crew's contact details organized."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        <div>
          <p className="font-semibold">Employee directory</p>
          <p className="mt-1 text-xs text-slate-500">
            {employees.length} team members registered
          </p>
        </div>

        <button
          onClick={() => {
            if (open) {
              reset()
            } else {
              setForm({ name: '', mobile: '', city: '' })
              setEditId('')
              setOpen(true)
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
        >
          <Plus size={17} />
          {open ? 'Close form' : 'Add employee'}
        </button>
      </div>

      {open && (
        <form
          onKeyDown={handleEnterNext}
          onSubmit={submit}
          className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[.04] p-5 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-bold">
                {editId ? 'Edit employee' : 'Add a new employee'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                All fields are required.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Employee name">
              <input
                autoFocus
                required
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: titleCase(e.target.value) })
                }
                placeholder="EMPLOYEE NAME"
                className={inputStyle}
              />
            </Field>

            <Field label="Mobile number">
              <input
                required
                type="tel"
                value={form.mobile}
                onChange={(e) =>
                  setForm({ ...form, mobile: e.target.value })
                }
                placeholder="+91 98765 43210"
                className={inputStyle}
              />
            </Field>

            <Field label="City">
              <input
                required
                value={form.city}
                onChange={(e) =>
                  setForm({ ...form, city: titleCase(e.target.value) })
                }
                placeholder="CITY NAME"
                className={inputStyle}
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {busy
                ? 'Saving…'
                : editId
                  ? 'Save changes'
                  : 'Add employee'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.02]">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-bold">All employees</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-white/[.03] text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">S.No</th>
                <th className="px-5 py-4">Employee name</th>
                <th className="px-5 py-4">Mobile number</th>
                <th className="px-5 py-4">City</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[.06]">
              {employees.map((employee, index) => (
                <tr
                  key={employee._id}
                  className="hover:bg-white/[.025]"
                >
                  <td className="px-5 py-4 text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {employee.name}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {employee.mobile}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-slate-300">
                      <MapPin size={14} className="text-emerald-300" />
                      {employee.city}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(employee)}
                        title="Edit"
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-emerald-300/30 hover:text-emerald-300"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => void remove(employee)}
                        title="Delete"
                        className="rounded-lg border border-white/10 p-2 text-slate-300 hover:border-rose-400/30 hover:text-rose-300"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <Users size={28} className="mx-auto mb-3 text-slate-600" />
                    <p className="font-semibold text-slate-300">
                      No employees yet
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Add your first team member to get started.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OrdersPage({
  api,
  employees,
  orders,
  setOrders,
  refresh,
  toast,
}: {
  api: (path: string, options?: RequestInit) => Promise<any>
  employees: Employee[]
  orders: Order[]
  setOrders: (v: Order[]) => void
  refresh: () => Promise<void>
  toast: (m: string, k?: ToastItem['kind']) => void
}) {
  const [form, setForm] = useState({
    city: '',
    peopleNeeded: '1',
    eventDateTime: localDateTimeInput(
      new Date(Date.now() + 86400000),
    ),
  })

  const [busy, setBusy] = useState(false)
  const [assignOrder, setAssignOrder] = useState<Order | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [assignBusy, setAssignBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)

    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          peopleNeeded: Number(form.peopleNeeded),
          eventDateTime: new Date(form.eventDateTime).toISOString(),
        }),
      })

      setOrders(
        [...orders, order].sort(
          (a, b) =>
            +new Date(a.eventDateTime) - +new Date(b.eventDateTime),
        ),
      )

      setForm({
        city: '',
        peopleNeeded: '1',
        eventDateTime: localDateTimeInput(
          new Date(Date.now() + 86400000),
        ),
      })

      toast('Order created successfully.')
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Could not create order.',
        'error',
      )
    } finally {
      setBusy(false)
    }
  }

  const openAssign = (order: Order) => {
    setAssignOrder(order)
    setSelected(order.assignedEmployees.map((employee) => employee._id))
  }

  const assign = async () => {
    if (!assignOrder) return

    if (selected.length > assignOrder.peopleNeeded) {
      toast(
        `This order needs ${assignOrder.peopleNeeded} employees. Please select no more than that.`,
        'error',
      )
      return
    }

    setAssignBusy(true)

    try {
      const result = await api(`/orders/${assignOrder._id}/assign`, {
        method: 'PUT',
        body: JSON.stringify({ employeeIds: selected }),
      })

      setOrders(
        orders.map((order) =>
          order._id === assignOrder._id ? result.order : order,
        ),
      )

      toast(
        result.sms?.sent
          ? `Assignments saved. SMS sent to ${result.sms.sentCount} employee(s).`
          : result.sms?.reason || 'Assignments saved.',
        'info',
      )

      setAssignOrder(null)
      await refresh()
    } catch (e) {
      toast(
        e instanceof Error ? e.message : 'Could not assign employees.',
        'error',
      )
    } finally {
      setAssignBusy(false)
    }
  }

  const shown = useMemo(
    () =>
      orders.filter((order) =>
        order.city.toLowerCase().includes(filter.toLowerCase()),
      ),
    [orders, filter],
  )

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="EVENT MANAGEMENT"
        title="Orders"
        subtitle="Create catering events and assign the right people to every location."
      />

      <form
        onKeyDown={handleEnterNext}
        onSubmit={create}
        className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6"
      >
        <div className="mb-5">
          <h2 className="font-bold">Create an order</h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter the city, staff requirement, and event date/time.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Catering city name">
            <input
              autoFocus
              required
              value={form.city}
              onChange={(e) =>
                setForm({ ...form, city: titleCase(e.target.value) })
              }
              placeholder="CITY NAME"
              className={inputStyle}
            />
          </Field>

          <Field label="Employees required">
            <input
              required
              min="1"
              type="number"
              value={form.peopleNeeded}
              onChange={(e) =>
                setForm({ ...form, peopleNeeded: e.target.value })
              }
              className={inputStyle}
            />
          </Field>

          <Field label="Event date & time">
            <input
              required
              type="datetime-local"
              value={form.eventDateTime}
              onChange={(e) =>
                setForm({ ...form, eventDateTime: e.target.value })
              }
              className={inputStyle}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"
          >
            <Plus size={17} />
            {busy ? 'Creating…' : 'Create order'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Catering orders</h2>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} events in your roster
          </p>
        </div>

        <div className="relative">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search city…"
            className={`${inputStyle} w-56 pl-9`}
          />
          <MapPin
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {shown.map((order) => (
          <article
            key={order._id}
            className="rounded-2xl border border-white/10 bg-white/[.03] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  <MapPin size={12} />
                  {order.city}
                </span>
                <h3 className="mt-3 text-lg font-bold">Catering event</h3>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                  <Clock3 size={15} />
                  {niceDate(order.eventDateTime)}
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#080e19] px-3 py-2 text-center">
                <p className="text-xl font-black">
                  {order.assignedEmployees.length}
                  <span className="text-slate-600">/{order.peopleNeeded}</span>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Assigned
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400">
                  Assigned team
                </p>
                <p className="text-xs text-slate-500">
                  {order.assignedEmployees.length} selected
                </p>
              </div>

              {order.assignedEmployees.length > 0 ? (
                <div className="space-y-2">
                  {order.assignedEmployees.map((employee) => (
                    <div
                      key={employee._id}
                      className="flex items-center gap-3 rounded-xl bg-white/[.03] p-3"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300/10 text-emerald-300">
                        <UserRound size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{employee.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Phone size={12} />
                          {employee.mobile}
                        </p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {employee.city}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 py-5 text-center text-sm text-slate-500">
                  No employees assigned yet.
                </p>
              )}

              <button
                onClick={() => openAssign(order)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/[.06] px-4 py-3 text-sm font-bold text-emerald-300 hover:bg-emerald-300/10"
              >
                <Users size={16} />
                {order.assignedEmployees.length
                  ? 'Edit assignment'
                  : 'Assign boys'}
              </button>
            </div>
          </article>
        ))}

        {shown.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <CalendarDays size={30} className="mx-auto mb-3 text-slate-600" />
            <p className="font-semibold">No orders found</p>
            <p className="mt-1 text-sm text-slate-500">
              {orders.length
                ? 'Try a different city search.'
                : 'Create your first catering order above.'}
            </p>
          </div>
        )}
      </div>

      {assignOrder && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAssignOrder(null)
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">
                  Staff assignment
                </p>
                <h2 className="mt-2 text-2xl font-bold">{assignOrder.city}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {niceDate(assignOrder.eventDateTime)} · Need{' '}
                  {assignOrder.peopleNeeded} employees
                </p>
              </div>

              <button
                onClick={() => setAssignOrder(null)}
                className="rounded-xl border border-white/10 p-2 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">Select employees</p>
              <span className="text-xs text-slate-500">
                {selected.length}/{assignOrder.peopleNeeded} selected
              </span>
            </div>

            <div className="space-y-2">
              {employees.map((employee) => (
                <label
                  key={employee._id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                    selected.includes(employee._id)
                      ? 'border-emerald-300/30 bg-emerald-300/[.07]'
                      : 'border-white/10 bg-white/[.02] hover:bg-white/[.04]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(employee._id)}
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, employee._id]
                          : old.filter((id) => id !== employee._id),
                      )
                    }
                    className="h-4 w-4 accent-emerald-400"
                  />

                  <div className="flex-1">
                    <p className="text-sm font-semibold">{employee.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {employee.mobile} · {employee.city}
                    </p>
                  </div>

                  {selected.includes(employee._id) && (
                    <span className="text-xs font-semibold text-emerald-300">
                      Selected
                    </span>
                  )}
                </label>
              ))}

              {employees.length === 0 && (
                <p className="rounded-xl bg-white/[.03] p-5 text-center text-sm text-slate-400">
                  Add employees in Employers Details first.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setAssignOrder(null)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={
                  assignBusy || selected.length > assignOrder.peopleNeeded
                }
                onClick={() => void assign()}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40"
              >
                {assignBusy ? 'Saving assignment…' : 'Save assignment & notify'}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              SMS is sent only when Twilio is configured. Without it,
              assignments still save normally.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}