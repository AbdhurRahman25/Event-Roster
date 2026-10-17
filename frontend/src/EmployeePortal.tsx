
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChefHat,
  Clock,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const API =
  ((import.meta as ImportMeta & { env: { VITE_API_URL?: string } }).env
    .VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

type Admin = {
  adminName: string;
  cateringServiceName: string;
  mobile: string;
};

type Employee = {
  _id: string;
  name: string;
  mobile: string;
  city: string;
  mustChangePassword: boolean;
};

type Assignment = {
  _id: string;
  city: string;
  peopleNeeded: number;
  eventDateTime: string;
  admin?: Admin;
};

type NotificationItem = {
  _id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type Props = {
  token: string;
  onLogout: () => void;
  onPasswordChanged: () => void;
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#080e19] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

export default function EmployeePortal({
  token,
  onLogout,
  onPasswordChanged,
}: Props) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const api = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      return data;
    },
    [token]
  );

  const loadPortal = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const [profile, assigned, notices] = await Promise.all([
        api("/employee/me"),
        api("/employee/assignments"),
        api("/employee/notifications"),
      ]);

      setEmployee(profile.employee);
      setAdmin(profile.admin);
      setAssignments(assigned);
      setNotifications(notices);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load your account."
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const markRead = async (id: string) => {
    try {
      const updated = await api(`/employee/notifications/${id}/read`, {
        method: "PATCH",
      });

      setNotifications((items) =>
        items.map((item) => (item._id === id ? updated : item))
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update notification."
      );
    }
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const result = await api("/employee/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setMessage(result.message || "Password changed successfully.");
      onPasswordChanged();
      await loadPortal();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not change password."
      );
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="min-h-screen bg-[#080e19] text-slate-100">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220]/95 px-4 py-4 backdrop-blur-xl sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-400 text-slate-950">
            <ChefHat size={23} />
          </div>
          <div className="min-w-0">
            <p className="font-bold">EVENT ROSTER</p>
            <p className="truncate text-xs text-slate-500">Employee workspace</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          <LogOut size={16} />
          Logout
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        {message && (
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-white/10 p-8 text-center text-slate-400">
            <RefreshCw className="mx-auto mb-3 animate-spin" />
            Loading your workspace…
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 to-[#101827] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                Employee dashboard
              </p>
              <h1 className="mt-3 text-3xl font-black">
                Welcome, {employee?.name || "Employee"}!
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                View your catering service and upcoming assignments here.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-2 flex items-center gap-2 text-emerald-300">
                    <ShieldCheck size={18} />
                    <span className="text-xs font-semibold">
                      Your catering service
                    </span>
                  </div>
                  <p className="font-bold">
                    {admin?.cateringServiceName || "Not available"}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Admin: {admin?.adminName || "Not available"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {admin?.mobile || ""}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                  <div className="mb-2 flex items-center gap-2 text-emerald-300">
                    <UserRound size={18} />
                    <span className="text-xs font-semibold">
                      Your details
                    </span>
                  </div>
                  <p className="font-semibold">{employee?.mobile}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {employee?.city}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {assignments.length} assignment(s)
                  </p>
                </div>
              </div>
            </section>

            {employee?.mustChangePassword && (
              <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
                <h2 className="font-bold text-amber-200">
                  Change your temporary password
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  For your account security, change the temporary password
                  provided by your admin.
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">My assignments</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Events assigned to your employee account.
                  </p>
                </div>
                <CalendarDays className="text-emerald-300" />
              </div>

              {assignments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No assignments yet. Your admin will notify you when an event
                  is assigned.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((assignment) => (
                    <article
                      key={assignment._id}
                      className="rounded-xl border border-white/10 bg-[#0b1220] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{assignment.city}</h3>
                          <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                            <Clock size={15} />
                            {displayDate(assignment.eventDateTime)}
                          </p>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <MapPin size={14} />
                            {assignment.admin?.cateringServiceName ||
                              admin?.cateringServiceName ||
                              "Catering service"}
                          </p>
                        </div>
                        <span className="rounded-lg bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                          Assigned
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Staff required for this event: {assignment.peopleNeeded}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Notifications</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Assignment updates from your admin.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-emerald-300/10 px-3 py-2 text-emerald-300">
                  <Bell size={17} />
                  <span className="text-sm font-bold">{unreadCount}</span>
                </div>
              </div>

              {notifications.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                  No notifications yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div
                      key={item._id}
                      className={`rounded-xl border p-4 ${
                        item.isRead
                          ? "border-white/10 bg-[#0b1220]"
                          : "border-emerald-300/20 bg-emerald-300/[.05]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Bell
                          size={17}
                          className="mt-1 shrink-0 text-emerald-300"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-6">{item.message}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {displayDate(item.createdAt)}
                          </p>
                          {!item.isRead && (
                            <button
                              onClick={() => void markRead(item._id)}
                              className="mt-3 rounded-lg border border-emerald-300/20 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-300/10"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                        {!item.isRead && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5 sm:p-6">
              <h2 className="text-xl font-bold">Change password</h2>
              <p className="mt-1 text-sm text-slate-500">
                Use at least 8 characters for your new password.
              </p>

              <form onSubmit={changePassword} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">
                    Current password
                  </label>
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) =>
                      setCurrentPassword(event.target.value)
                    }
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">
                    New password
                  </label>
                  <input
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className={inputClass}
                  />
                </div>

                <button
                  disabled={busy}
                  className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                >
                  {busy ? "Updating…" : "Update password"}
                </button>
              </form>
            </section>

            <button
              onClick={() => void loadPortal()}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/5"
            >
              <RefreshCw size={16} />
              Refresh assignments
            </button>
          </>
        )}
      </main>
    </div>
  );
}
