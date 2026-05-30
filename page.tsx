"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";
import {
  pageWrap,
  adminContainer,
  shellCard,
  topBar,
  topButtonGroup,
  smallLabel,
  staffName,
  logoutBtn,
  heroCard,
  heroGlow,
  pearlBadge,
  pearlBadgeLarge,
  titleStyle,
  subtitleStyle,
  heroTitle,
  heroSubtitle,
  filterWrap,
  statGrid,
  statCard,
  statLabel,
  statValue,
  sectionCard,
  sectionTitle,
  emptyCard,
  summaryRowCard,
  summaryName,
  summaryMeta,
  summaryMetaItem,
  summaryMetaLabel,
  summaryMetaValue,
  logCard,
  logHeader,
  logStaffName,
  logStaffSub,
  logRow,
  logLabel,
  logValue,
  actionRow,
  imageGrid,
  imageCard,
  imageLabel,
  previewImage,
  emptyPhoto,
  labelStyle,
  inputStyle,
  mainBlueBtn,
  softPearlBtn,
  filterBtn,
  activeFilterBtn,
  smallBlueBtn,
  smallDeleteBtn,
  smallSaveBtn,
  smallCancelBtn,
  mutedBox,
  rowCard,
  strongText,
  mutedText,
  exportBtn,
} from "./styles/adminStyles";

type AttendanceRow = {
  id: number;
  user_id: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  created_at: string;
  check_in_image_url?: string | null;
  check_out_image_url?: string | null;
  is_late?: boolean | null;
  branch?: string | null;
};

type Profile = {
  id: string;
  name: string | null;
  hourly_rate: number;
  role: string;
  branch?: string | null;
};

type LogWithProfile = AttendanceRow & {
  profile?: Profile | null;
};

type FilterType = "all" | "today" | "week" | "month";

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [logs, setLogs] = useState<LogWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [myProfile, setMyProfile] = useState<any>(null);

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
      if (!session?.user) {
        setLoading(false);
      return;
    }
      setUser(session.user);

      const profile= await loadProfile(session.user.id);

      await loadProfiles();
      await loadHolidays();
      if (profile?.branch) {
        await loadLogs(profile.branch);
    }
    setLoading(false);
  };

  init();
 }, []);

  useEffect(() => {
    if (profiles.length > 0 && myProfile?.branch) {
      loadLogs();
    }
  }, [profiles, myProfile]);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      setMyProfile(data);
      return data;
    }
    return null;
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

  const loadLogs = async (branch: string) => {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("branch", branch)
      .order("created_at", { ascending: false })
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

    if (filter === "today") {
      const sameDay =
        checkInDate.getFullYear() === now.getFullYear() &&
        checkInDate.getMonth() === now.getMonth() &&
        checkInDate.getDate() === now.getDate();

      if (!sameDay) return false;
    }

    if (filter === "week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - diff);
      startOfWeek.setHours(0, 0, 0, 0);

      if (checkInDate < startOfWeek) return false;
    }

    if (filter === "month") {
      const sameMonth =
        checkInDate.getFullYear() === now.getFullYear() &&
        checkInDate.getMonth() === now.getMonth();

      if (!sameMonth) return false;
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      if (checkInDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      if (checkInDate > end) return false;
    }

    return true;
  });
}, [logs, filter, startDate, endDate]);


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
    const hourlyRate = Number(log.profile?.hourly_rate || 25000);
    const logDate = log.check_in_time
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
 const handleExportExcel = () => {
  const rows = filteredLogs.map((log) => {
    const checkIn = log.check_in_time ? new Date(log.check_in_time) : null;
    const checkOut = log.check_out_time ? new Date(log.check_out_time) : null;
    const hourlyRate = Number(log.profile?.hourly_rate || 25000);

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

    let hours = 0;
    let salary = 0;

    if (checkIn && checkOut) {
      hours = (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
      salary = Math.floor(hours * finalHourlyRate);
    }

    return {
      Staff: log.profile?.name || "Unknown staff",
      "Check In": checkIn ? checkIn.toLocaleString() : "",
      "Check Out": checkOut ? checkOut.toLocaleString() : "",
      Hours: Number(hours.toFixed(2)),
      Salary: salary,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");

  XLSX.writeFile(workbook, `nagomi-payroll.xlsx`);
};
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
        <div style={{ display: "flex", gap:10, flexWrap: "wrap", marginBottom: 18}}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
             />
             <input
              type="date"
              value={endDate}
              onChange={(e)=> setEndDate(e.target.value)}
              style={inputStyle}
             />
             <button 
               style={filterBtn}
               onClick={() => {
                setStartDate("");
                setEndDate("");
               }}
            > 
              Clear Dates
              </button>
        </div>

        <button style={exportBtn} onClick={handleExportExcel}>
         Export Payroll
        </button>

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
              ).toLocaleString()} VND
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
<div style={sectionCard}></div>
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

                const hourlyRate = Number(log.profile?.hourly_rate || 25000);

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
                        {log.is_late && (
                         <span style={{
                         background: "#ffe5e5",
                         color: "#d11a2a",
                         padding: "4px 10px",
                         borderRadius: 8,
                         fontSize: 12,
                         fontWeight: 700,
                         display: "inline-block",
                         marginTop: 4,
                     }}>
                         Late
                      </span>
                      )}

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
                          {salary !== null
                           ? Math.floor(salary).toLocaleString()
                           : "-"}
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
