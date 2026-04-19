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
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [multiplier, setMultiplier] = useState(2);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);
  const loadHolidays = async () => {
  const { data, error } = await supabase
    .from("holiday_rates")
    .select("*")
    .order("holiday_date", { ascending: true });

  if (error) {
    alert(error.message);
    return;
  }

  setHolidays(data || []);
};

const handleSaveHoliday = async () => {
  if (!holidayDate || !holidayName || !multiplier) {
    alert("Please fill all holiday fields.");
    return;
  }

  if (editingHolidayId) {
    const { error } = await supabase
      .from("holiday_rates")
      .update({
        holiday_date: holidayDate,
        holiday_name: holidayName,
        multiplier,
      })
      .eq("id", editingHolidayId);

    if (error) {
      alert(error.message);
      return;
    }
  } else {
    const { error } = await supabase.from("holiday_rates").insert([
      {
        holiday_date: holidayDate,
        holiday_name: holidayName,
        multiplier,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }
  }

  setHolidayDate("");
  setHolidayName("");
  setMultiplier(2);
  setEditingHolidayId(null);
  await loadHolidays();
};

const handleEditHoliday = (holiday: any) => {
  setHolidayDate(holiday.holiday_date);
  setHolidayName(holiday.holiday_name);
  setMultiplier(Number(holiday.multiplier));
  setEditingHolidayId(holiday.id);
};

const handleDeleteHoliday = async (id: number) => {
  const confirmed = window.confirm("Delete this holiday rule?");
  if (!confirmed) return;

  const { error } = await supabase
    .from("holiday_rates")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadHolidays();
};

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
      await loadLogs();
      await loadHolidays();
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
    const logDate = log.check_in_time
      ? new Date(log.check_in_time).toISOString().split("T")[0]
      : null;
    const matchedHoliday = holidays.find(
     (holiday) => holiday.holiday_date === logDate

    );
    const appliedMultiplier = matchedHoliday
      ? Number(matchedHoliday.multiplier)
      : 1;
     const finalHourlyRate = hourlyRate * appliedMultiplier;
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

      item.totalSalary += Math.floor(hours * finalHourlyRate);

    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}, [filteredLogs, holidays]);

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={shellCard}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={pageWrap}>
        <div style={shellCard}>
          <div style={pearlBadge}>◌</div>
          <h1 style={titleStyle}>Admin Access</h1>
          <p style={subtitleStyle}>You need to log in first.</p>
          <button style={mainBlueBtn} onClick={() => (window.location.href = "/")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!myProfile || myProfile.role !== "admin") {
    return (
      <div style={pageWrap}>
        <div style={shellCard}>
          <div style={pearlBadge}>◌</div>
          <h1 style={titleStyle}>Access Denied</h1>
          <p style={subtitleStyle}>This page is only for admins.</p>
          <button
            style={softPearlBtn}
            onClick={() => (window.location.href = "/")}
          >
            Back to Staff Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={adminContainer}>
        <div style={topBar}>
          <div>
            <div style={smallLabel}>Admin</div>
            <div style={staffName}>{myProfile.name || user.email}</div>
          </div>

          <div style={topButtonGroup}>
            <button
              style={logoutBtn}
              onClick={() => (window.location.href = "/")}
            >
              Staff Page
            </button>
            <button style={logoutBtn} onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div style={heroCard}>
          <div style={heroGlow} />
          <div style={pearlBadgeLarge}>◌</div>
          <h1 style={heroTitle}>Pearl Admin</h1>
          <p style={heroSubtitle}>
            Elegant control over attendance, salary and staff flow.
          </p>
        </div>

        <div style={filterWrap}>
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
        </div>

        <div style={statGrid}>
          <div style={statCard}>
            <div style={statLabel}>Filtered Staff</div>
            <div style={statValue}>{summaryByStaff.length}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Filtered Logs</div>
            <div style={statValue}>{filteredLogs.length}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>Filtered Payroll</div>
            <div style={statValue}>
              {Math.floor(
                summaryByStaff.reduce((sum, item) => sum + item.totalSalary, 0)
              ).toLocaleString()}{" "}
              VND
            </div>
          </div>
        </div>

        <div style={sectionCard}>
          <div style={sectionTitle}>Salary Summary by Staff</div>

          {summaryByStaff.length === 0 ? (
            <div style={emptyCard}>No payroll data for this filter.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {summaryByStaff.map((item) => (
                <div key={item.name} style={summaryRowCard}>
                  <div style={summaryName}>{item.name}</div>
                  <div style={summaryMeta}>
                    <div style={summaryMetaItem}>
                      <span style={summaryMetaLabel}>Rate</span>
                      <span style={summaryMetaValue}>
                        {item.hourlyRate.toLocaleString()} VND
                      </span>
                    </div>
                    <div style={summaryMetaItem}>
                      <span style={summaryMetaLabel}>Hours</span>
                      <span style={summaryMetaValue}>
                        {item.totalHours.toFixed(2)} hrs
                      </span>
                    </div>
                    <div style={summaryMetaItem}>
                      <span style={summaryMetaLabel}>Salary</span>
                      <span style={summaryMetaValue}>
                        {Math.floor(item.totalSalary).toLocaleString()} VND
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={sectionCard}>
          <div style={sectionTitle}>Holiday Rate Rules</div>

     <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
    <input
      type="date"
      value={holidayDate}
      onChange={(e) => setHolidayDate(e.target.value)}
      style={inputStyle}
    />

    <input
      type="text"
      placeholder="Holiday name"
      value={holidayName}
      onChange={(e) => setHolidayName(e.target.value)}
      style={inputStyle}
    />

    <input
      type="number"
      step="0.5"
      min="1"
      value={multiplier}
      onChange={(e) => setMultiplier(Number(e.target.value))}
      style={inputStyle}
    />

    <button onClick={handleSaveHoliday} style={mainBlueBtn}>
      {editingHolidayId ? "Update Holiday" : "Add Holiday"}
    </button>
  </div>

  <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
    {holidays.length === 0 ? (
      <div style={mutedBox}>No holiday rules yet.</div>
    ) : (
      holidays.map((holiday) => (
        <div key={holiday.id} style={rowCard}>
          <div>
            <div style={strongText}>{holiday.holiday_name}</div>
            <div style={mutedText}>{holiday.holiday_date}</div>
            <div style={strongText}>x{holiday.multiplier}</div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleEditHoliday(holiday)} style={smallBlueBtn}>
              Edit
            </button>
            <button onClick={() => handleDeleteHoliday(holiday.id)} style={smallDeleteBtn}>
              Delete
            </button>
          </div>
        </div>
      ))
    )}
  </div>
</div>
          <div style={sectionTitle}>Attendance Logs</div>

          <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
            {filteredLogs.length === 0 ? (
              <div style={emptyCard}>No attendance logs for this filter.</div>
            ) : (
              filteredLogs.map((log) => {
                const checkIn = log.check_in_time
                  ? new Date(log.check_in_time)
                  : null;
                const checkOut = log.check_out_time
                  ? new Date(log.check_out_time)
                  : null;

                const hourlyRate = log.profile?.hourly_rate || 25000;

                 const logDate = log.check_in_time
                  ? new Date(log.check_in_time).toISOString().split("T")[0]
                  : null;

                const matchedHoliday = holidays.find(
                 (holiday) => holiday.holiday_date === logDate
                 );

                const appliedMultiplier = matchedHoliday
                 ? Number(matchedHoliday.multiplier)
                 : 1;

                const finalHourlyRate = hourlyRate * appliedMultiplier;

                 let hours: number | null = null;
                 let salary: number | null = null;

                if (checkIn && checkOut) {
                   const diff =
                      (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
                    hours = diff;
                    salary = diff * finalHourlyRate;
                 }

                const isEditing = editingId === log.id;

                return (
                  <div key={log.id} style={logCard}>
                    <div style={logHeader}>
                      <div>
                        <div style={logStaffName}>
                          {log.profile?.name || "Unknown staff"}
                        </div>
                        <div style={logStaffSub}>
                          {hourlyRate.toLocaleString()} VND/hour
                        </div>
                      </div>
                    </div>

                    {!isEditing ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={logRow}>
                          <span style={logLabel}>Check In</span>
                          <span style={logValue}>
                            {checkIn ? checkIn.toLocaleString() : "-"}
                          </span>
                        </div>

                        <div style={logRow}>
                          <span style={logLabel}>Check Out</span>
                          <span style={logValue}>
                            {checkOut ? checkOut.toLocaleString() : "Still working"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>Check In</label>
                          <input
                            type="datetime-local"
                            value={editCheckIn}
                            onChange={(e) => setEditCheckIn(e.target.value)}
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Check Out</label>
                          <input
                            type="datetime-local"
                            value={editCheckOut}
                            onChange={(e) => setEditCheckOut(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                      <div style={logRow}>
                        <span style={logLabel}>Hours</span>
                        <span style={logValue}>
                          {hours !== null ? `${hours.toFixed(2)} hrs` : "In progress"}
                        </span>
                      </div>
                      <div style={logRow}>
                        <span style={logLabel}>Multiplier</span>
                        <span style={logValue}>x{appliedMultiplier}</span>
                      </div>

                      <div style={logRow}>
                        <span style={logLabel}>Final Rate</span>
                        <span style={logValue}>
                            {finalHourlyRate.toLocaleString()} VND/h
                        </span>
                      </div>
                      <div style={logRow}>
                        <span style={logLabel}>Salary</span>
                        <span style={logValue}>
                          {salary ? Math.floor(salary).toLocaleString() : "-"}
                        </span>
                      </div>
                    </div>

                    <div style={actionRow}>
                      {!isEditing ? (
                        <>
                          <button
                            style={smallBlueBtn}
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

                    <div style={imageGrid}>
                      <div style={imageCard}>
                        <div style={imageLabel}>Check-in photo</div>
                        {log.check_in_image_url ? (
                          <img
                            src={log.check_in_image_url}
                            alt="check-in"
                            style={previewImage}
                          />
                        ) : (
                          <div style={emptyPhoto}>No check-in photo</div>
                        )}
                      </div>

                      <div style={imageCard}>
                        <div style={imageLabel}>Check-out photo</div>
                        {log.check_out_image_url ? (
                          <img
                            src={log.check_out_image_url}
                            alt="check-out"
                            style={previewImage}
                          />
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
  padding: 18,
  background:
    "linear-gradient(180deg, #dff4ff 0%, #cdefff 24%, #b7e4fa 55%, #eef8ff 100%)",
  fontFamily: "'Georgia', 'Times New Roman', serif",
  display: "flex",
  justifyContent: "center",
};

const adminContainer: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  padding: 6,
};

const shellCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  marginTop: 40,
  background: "rgba(255,255,255,0.68)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(255,255,255,0.6)",
  boxShadow: "0 20px 60px rgba(67, 143, 184, 0.18)",
  borderRadius: 28,
  padding: 28,
};

const topBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
  gap: 12,
  flexWrap: "wrap",
};

const topButtonGroup: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5d7c8d",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const staffName: React.CSSProperties = {
  fontSize: 22,
  color: "#15384b",
  fontWeight: 700,
};

const logoutBtn: React.CSSProperties = {
  border: "none",
  background: "rgba(255,255,255,0.65)",
  color: "#22506a",
  borderRadius: 999,
  padding: "10px 14px",
  fontSize: 14,
  boxShadow: "0 8px 20px rgba(84, 140, 170, 0.14)",
  cursor: "pointer",
};

const heroCard: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(222,245,255,0.9), rgba(181,227,248,0.95))",
  borderRadius: 28,
  padding: "28px 22px",
  boxShadow: "0 18px 40px rgba(61, 128, 164, 0.18)",
  border: "1px solid rgba(255,255,255,0.65)",
  textAlign: "center",
};

const heroGlow: React.CSSProperties = {
  position: "absolute",
  width: 180,
  height: 180,
  right: -50,
  top: -60,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.55)",
  filter: "blur(10px)",
};

const pearlBadge: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "linear-gradient(135deg, #fefefe, #e8f7ff, #d8edf8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#79a7bc",
  fontSize: 24,
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.16)",
  marginBottom: 18,
};

const pearlBadgeLarge: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: "50%",
  margin: "0 auto 14px auto",
  background: "linear-gradient(135deg, #ffffff, #e8f7ff, #cfe8f6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#7ca8bc",
  fontSize: 34,
  boxShadow: "0 14px 32px rgba(85, 145, 177, 0.18)",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px 0",
  fontSize: 34,
  color: "#15384b",
  textAlign: "center",
  fontWeight: 700,
};

const subtitleStyle: React.CSSProperties = {
  margin: "0 0 24px 0",
  color: "#5f7d8e",
  textAlign: "center",
  fontSize: 15,
  lineHeight: 1.5,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  color: "#14384b",
  fontWeight: 700,
};

const heroSubtitle: React.CSSProperties = {
  margin: "10px 0 0 0",
  color: "#557589",
  fontSize: 16,
  lineHeight: 1.5,
};

const filterWrap: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
  marginBottom: 18,
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 4,
};

const statCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.10)",
};

const statLabel: React.CSSProperties = {
  fontSize: 13,
  color: "#67859a",
  marginBottom: 6,
};

const statValue: React.CSSProperties = {
  fontSize: 22,
  color: "#173b4d",
  fontWeight: 700,
  lineHeight: 1.3,
};

const sectionCard: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(255,255,255,0.72)",
  borderRadius: 24,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.10)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 22,
  color: "#173b4d",
  fontWeight: 700,
  marginBottom: 10,
};

const emptyCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  borderRadius: 18,
  padding: 18,
  color: "#5e7d90",
  border: "1px solid rgba(255,255,255,0.65)",
};

const summaryRowCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 12px 28px rgba(87, 145, 175, 0.10)",
};

const summaryName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#173b4d",
  marginBottom: 10,
};

const summaryMeta: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const summaryMetaItem: React.CSSProperties = {
  background: "rgba(244,251,255,0.9)",
  borderRadius: 16,
  padding: 12,
};

const summaryMetaLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#66849a",
  marginBottom: 4,
};

const summaryMetaValue: React.CSSProperties = {
  fontSize: 15,
  color: "#173b4d",
  fontWeight: 700,
};

const logCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  borderRadius: 22,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 12px 28px rgba(87, 145, 175, 0.10)",
};

const logHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const logStaffName: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#173b4d",
};

const logStaffSub: React.CSSProperties = {
  fontSize: 13,
  color: "#68859a",
  marginTop: 3,
};

const logRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid rgba(204, 228, 240, 0.7)",
};

const logLabel: React.CSSProperties = {
  color: "#557389",
  fontWeight: 700,
  fontSize: 14,
};

const logValue: React.CSSProperties = {
  color: "#183b4d",
  fontSize: 14,
  textAlign: "right",
  maxWidth: "58%",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 14,
};

const imageGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
  marginTop: 16,
};

const imageCard: React.CSSProperties = {
  background: "rgba(244,251,255,0.88)",
  borderRadius: 18,
  padding: 12,
};

const imageLabel: React.CSSProperties = {
  color: "#557389",
  fontWeight: 700,
  marginBottom: 8,
  fontSize: 14,
};

const previewImage: React.CSSProperties = {
  width: "100%",
  borderRadius: 18,
  display: "block",
  boxShadow: "0 12px 30px rgba(96, 145, 171, 0.12)",
};

const emptyPhoto: React.CSSProperties = {
  width: "100%",
  minHeight: 180,
  borderRadius: 12,
  border: "1px dashed #c8dfea",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#666",
  background: "#fafafa",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#456579",
  fontSize: 14,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(149, 194, 214, 0.8)",
  background: "rgba(255,255,255,0.88)",
  outline: "none",
  fontSize: 15,
  color: "#15384b",
  boxSizing: "border-box",
};

const mainBlueBtn: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 18,
  padding: "16px 18px",
  background: "linear-gradient(135deg, #4aa6d8, #2f8cc4, #2277a9)",
  color: "white",
  fontSize: 17,
  fontWeight: 700,
  boxShadow: "0 14px 30px rgba(37, 116, 160, 0.24)",
  cursor: "pointer",
};

const softPearlBtn: React.CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 18,
  padding: "16px 18px",
  background: "linear-gradient(135deg, #f6fbff, #e5f4fb, #d5edf8)",
  color: "#1b4f69",
  fontSize: 17,
  fontWeight: 700,
  boxShadow: "0 14px 30px rgba(102, 152, 177, 0.14)",
  cursor: "pointer",
};

const filterBtn: React.CSSProperties = {
  border: "1px solid rgba(149, 194, 214, 0.85)",
  background: "rgba(255,255,255,0.82)",
  color: "#24516a",
  borderRadius: 999,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(93, 146, 172, 0.08)",
};

const activeFilterBtn: React.CSSProperties = {
  border: "1px solid rgba(53, 132, 178, 0.95)",
  background: "linear-gradient(135deg, #4aa6d8, #2f8cc4, #2277a9)",
  color: "white",
  borderRadius: 999,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(37, 116, 160, 0.18)",
};

const smallBlueBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #4aa6d8, #2f8cc4, #2277a9)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const smallDeleteBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #f07b7b, #d95353)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const smallSaveBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #59b9e6, #2f8cc4)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const smallCancelBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #f6fbff, #e5f4fb, #d5edf8)",
  color: "#1b4f69",
  fontWeight: 700,
  cursor: "pointer",
};
const mutedBox: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "rgba(242,247,250,0.9)",
  color: "#678194",
};

const rowCard: React.CSSProperties = {
  background: "rgba(248,252,255,0.95)",
  borderRadius: 18,
  padding: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const strongText: React.CSSProperties = {
  fontWeight: 700,
  color: "#173b4d",
};

const mutedText: React.CSSProperties = {
  color: "#6a8597",
  fontSize: 14,
};
