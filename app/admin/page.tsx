"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AttendanceRow = {
  id: number;
  user_id: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at: string;
  check_in_image_url?: string | null;
  check_out_image_url?: string | null;
};

type Profile = {
  id: string;
  name: string | null;
  hourly_rate: number;
  role: string;
};

type LogWithProfile = AttendanceRow & {
  profile?: Profile | null;
};

type FilterType = "all" | "today" | "week" | "month";

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<LogWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      await loadMyProfile(currentUser.id);
      await loadProfiles();
      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (profiles.length > 0) {
      loadLogs();
    }
  }, [profiles]);

  const loadMyProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      setMyProfile(data);
    }
  };

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.log("Profiles error:", error);
      return;
    }

    setProfiles(data || []);
  };

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Logs error:", error);
      return;
    }

    const merged =
      data?.map((log) => ({
        ...log,
        profile: profiles.find((p) => p.id === log.user_id) || null,
      })) || [];

    setLogs(merged);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert(error.message);
    } else {
      window.location.href = "/";
    }
  };

  const startEdit = (log: LogWithProfile) => {
    setEditingId(log.id);
    setEditCheckIn(
      log.check_in_time
        ? new Date(log.check_in_time).toISOString().slice(0, 16)
        : ""
    );
    setEditCheckOut(
      log.check_out_time
        ? new Date(log.check_out_time).toISOString().slice(0, 16)
        : ""
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCheckIn("");
    setEditCheckOut("");
  };

  const saveEdit = async (id: number) => {
    setSavingId(id);

    const payload: {
      check_in_time?: string | null;
      check_out_time?: string | null;
    } = {
      check_in_time: editCheckIn ? new Date(editCheckIn).toISOString() : null,
      check_out_time: editCheckOut ? new Date(editCheckOut).toISOString() : null,
    };

    const { error } = await supabase
      .from("attendance_logs")
      .update(payload)
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Log updated successfully.");
    cancelEdit();
    loadLogs();
  };

  const deleteLog = async (id: number) => {
    const confirmed = window.confirm("Delete this attendance log?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("attendance_logs")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Log deleted.");
    loadLogs();
  };

  const filteredLogs = useMemo(() => {
    const now = new Date();

    return logs.filter((log) => {
      if (!log.check_in_time) return false;

      const checkInDate = new Date(log.check_in_time);

      if (filter === "all") return true;

      if (filter === "today") {
        return (
          checkInDate.getFullYear() === now.getFullYear() &&
          checkInDate.getMonth() === now.getMonth() &&
          checkInDate.getDate() === now.getDate()
        );
      }

      if (filter === "week") {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = day === 0 ? 6 : day - 1;
        startOfWeek.setDate(startOfWeek.getDate() - diff);
        startOfWeek.setHours(0, 0, 0, 0);

        return checkInDate >= startOfWeek;
      }

      if (filter === "month") {
        return (
          checkInDate.getFullYear() === now.getFullYear() &&
          checkInDate.getMonth() === now.getMonth()
        );
      }

      return true;
    });
  }, [logs, filter]);

  const summaryByStaff = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        hourlyRate: number;
        totalHours: number;
        totalSalary: number;
      }
    >();

    for (const log of filteredLogs) {
      const staffId = log.user_id || "unknown";
      const name = log.profile?.name || "Unknown staff";
      const hourlyRate = log.profile?.hourly_rate || 25000;

      if (!map.has(staffId)) {
        map.set(staffId, {
          name,
          hourlyRate,
          totalHours: 0,
          totalSalary: 0,
        });
      }

      const item = map.get(staffId)!;

      if (log.check_in_time && log.check_out_time) {
        const checkIn = new Date(log.check_in_time);
        const checkOut = new Date(log.check_out_time);
        const hours =
          (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;

        item.totalHours += hours;
        item.totalSalary += hours * hourlyRate;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [filteredLogs]);

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <h2>Admin Access</h2>
          <p>You need to log in first.</p>
          <button style={primaryBtn} onClick={() => (window.location.href = "/")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!myProfile || myProfile.role !== "admin") {
    return (
      <div style={pageWrap}>
        <div style={cardStyle}>
          <h2>Access Denied</h2>
          <p>This page is only for admins.</p>
          <button style={secondaryBtn} onClick={() => (window.location.href = "/")}>
            Back to Staff Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ ...cardStyle, width: 1100, maxWidth: "95vw" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
            <p style={{ margin: "8px 0 0 0", color: "#555" }}>
              Welcome, {myProfile.name || user.email}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={filter === "all" ? activeFilterBtn : filterBtn}
              onClick={() => setFilter("all")}
            >
              All Time
            </button>
            <button
              style={filter === "today" ? activeFilterBtn : filterBtn}
              onClick={() => setFilter("today")}
            >
              Today
            </button>
            <button
              style={filter === "week" ? activeFilterBtn : filterBtn}
              onClick={() => setFilter("week")}
            >
              This Week
            </button>
            <button
              style={filter === "month" ? activeFilterBtn : filterBtn}
              onClick={() => setFilter("month")}
            >
              This Month
            </button>
            <button
              style={secondaryBtn}
              onClick={() => (window.location.href = "/")}
            >
              Staff Page
            </button>
            <button style={secondaryBtn} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          <div style={summaryCard}>
            <div style={summaryLabel}>Filtered Staff</div>
            <div style={summaryValue}>{summaryByStaff.length}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Filtered Logs</div>
            <div style={summaryValue}>{filteredLogs.length}</div>
          </div>

          <div style={summaryCard}>
            <div style={summaryLabel}>Filtered Payroll</div>
            <div style={summaryValue}>
              {summaryByStaff
                .reduce((sum, item) => sum + item.totalSalary, 0)
                .toLocaleString()}{" "}
              VND
            </div>
          </div>
        </div>

        <h2 style={{ marginBottom: 12 }}>Salary Summary by Staff</h2>

        <div style={{ overflowX: "auto", marginBottom: 32 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Staff</th>
                <th style={thStyle}>Hourly Rate</th>
                <th style={thStyle}>Total Hours</th>
                <th style={thStyle}>Total Salary</th>
              </tr>
            </thead>
            <tbody>
              {summaryByStaff.map((item) => (
                <tr key={item.name}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.hourlyRate.toLocaleString()} VND</td>
                  <td style={tdStyle}>{item.totalHours.toFixed(2)} hrs</td>
                  <td style={tdStyle}>{item.totalSalary.toLocaleString()} VND</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ marginBottom: 12 }}>Attendance Logs</h2>

        <div style={{ display: "grid", gap: 16 }}>
          {filteredLogs.length === 0 ? (
            <div style={emptyBox}>No attendance logs for this filter.</div>
          ) : (
            filteredLogs.map((log) => {
              const checkIn = log.check_in_time
                ? new Date(log.check_in_time)
                : null;
              const checkOut = log.check_out_time
                ? new Date(log.check_out_time)
                : null;

              const hourlyRate = log.profile?.hourly_rate || 25000;

              let hours: number | null = null;
              let salary: number | null = null;

              if (checkIn && checkOut) {
                const diff =
                  (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
                hours = diff;
                salary = diff * hourlyRate;
              }

              const isEditing = editingId === log.id;

              return (
                <div key={log.id} style={logCard}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr",
                      gap: 20,
                    }}
                  >
                    <div>
                      <p style={pStyle}>
                        <strong>Staff:</strong>{" "}
                        {log.profile?.name || "Unknown staff"}
                      </p>
                      <p style={pStyle}>
                        <strong>Hourly Rate:</strong>{" "}
                        {hourlyRate.toLocaleString()} VND/hour
                      </p>

                      {!isEditing ? (
                        <>
                          <p style={pStyle}>
                            <strong>Check In:</strong>{" "}
                            {checkIn ? checkIn.toLocaleString() : "-"}
                          </p>
                          <p style={pStyle}>
                            <strong>Check Out:</strong>{" "}
                            {checkOut ? checkOut.toLocaleString() : "Still working"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>Check In</label>
                            <input
                              type="datetime-local"
                              value={editCheckIn}
                              onChange={(e) => setEditCheckIn(e.target.value)}
                              style={inputStyle}
                            />
                          </div>

                          <div style={{ marginBottom: 10 }}>
                            <label style={labelStyle}>Check Out</label>
                            <input
                              type="datetime-local"
                              value={editCheckOut}
                              onChange={(e) => setEditCheckOut(e.target.value)}
                              style={inputStyle}
                            />
                          </div>
                        </>
                      )}

                      <p style={pStyle}>
                        <strong>Hours:</strong>{" "}
                        {hours !== null ? `${hours.toFixed(2)} hrs` : "In progress"}
                      </p>
                      <p style={pStyle}>
                        <strong>Salary:</strong>{" "}
                        {salary !== null ? `${salary.toLocaleString()} VND` : "-"}
                      </p>

                      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        {!isEditing ? (
                          <>
                            <button
                              style={smallEditBtn}
                              onClick={() => startEdit(log)}
                            >
                              Edit
                            </button>
                            <button
                              style={smallDeleteBtn}
                              onClick={() => deleteLog(log.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              style={smallSaveBtn}
                              onClick={() => saveEdit(log.id)}
                              disabled={savingId === log.id}
                            >
                              {savingId === log.id ? "Saving..." : "Save"}
                            </button>
                            <button style={smallCancelBtn} onClick={cancelEdit}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      {log.check_in_image_url ? (
                        <div style={{ marginBottom: 14 }}>
                          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>
                            Check-in photo
                          </p>
                          <img
                            src={log.check_in_image_url}
                            alt="check-in"
                            style={{
                              width: "100%",
                              borderRadius: 12,
                              border: "1px solid #eee",
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ ...emptyPhoto, marginBottom: 14 }}>
                          No check-in photo
                        </div>
                      )}

                      {log.check_out_image_url ? (
                        <div>
                          <p style={{ margin: "0 0 8px 0", fontWeight: 600 }}>
                            Check-out photo
                          </p>
                          <img
                            src={log.check_out_image_url}
                            alt="check-out"
                            style={{
                              width: "100%",
                              borderRadius: 12,
                              border: "1px solid #eee",
                            }}
                          />
                        </div>
                      ) : (
                        <div style={emptyPhoto}>No check-out photo</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  backgroundColor: "#f5f5f5",
  padding: 24,
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 18,
  padding: 24,
  boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  margin: "0 auto",
};

const summaryCard: React.CSSProperties = {
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 14,
  padding: 18,
};

const summaryLabel: React.CSSProperties = {
  fontSize: 14,
  color: "#666",
  marginBottom: 8,
};

const summaryValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
  border: "1px solid #eee",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid #eee",
  backgroundColor: "#fafafa",
};

const tdStyle: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid #eee",
};

const emptyBox: React.CSSProperties = {
  background: "white",
  border: "1px dashed #ddd",
  borderRadius: 12,
  padding: 20,
  color: "#666",
};

const logCard: React.CSSProperties = {
  background: "white",
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 16,
};

const pStyle: React.CSSProperties = {
  margin: "0 0 8px 0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  backgroundColor: "#4CAF50",
  color: "white",
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  backgroundColor: "#666",
  color: "white",
  cursor: "pointer",
};

const filterBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ccc",
  backgroundColor: "white",
  color: "#333",
  cursor: "pointer",
};

const activeFilterBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #4CAF50",
  backgroundColor: "#4CAF50",
  color: "white",
  cursor: "pointer",
};

const smallEditBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#1976d2",
  color: "white",
  cursor: "pointer",
};

const smallDeleteBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#d32f2f",
  color: "white",
  cursor: "pointer",
};

const smallSaveBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#2e7d32",
  color: "white",
  cursor: "pointer",
};

const smallCancelBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  backgroundColor: "#9e9e9e",
  color: "white",
  cursor: "pointer",
};

const emptyPhoto: React.CSSProperties = {
  width: "100%",
  minHeight: 180,
  borderRadius: 12,
  border: "1px dashed #ccc",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#666",
  background: "#fafafa",
};