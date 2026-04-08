"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeShift, setActiveShift] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [logs, setLogs] = useState<AttendanceRow[]>([]);

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
        await loadActiveShift(currentUser.id);
        await loadLogs(currentUser.id);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await loadProfile(currentUser.id);
        await loadActiveShift(currentUser.id);
        await loadLogs(currentUser.id);
      } else {
        setProfile(null);
        setActiveShift(null);
        setLogs([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.log("Profile error:", error);
      return;
    }

    setProfile(data);
  };

  const loadActiveShift = async (userId: string) => {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId)
      .is("check_out_time", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Active shift error:", error);
      return;
    }

    setActiveShift(data && data.length > 0 ? data[0] : null);
  };

  const loadLogs = async (userId: string) => {
    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Logs error:", error);
      return;
    }

    if (data) {
      setLogs(data);
    }
  };

  const handleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Logged in successfully!");
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
    } else {
      alert("Logged out.");
    }
  };

  const handleCheckIn = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (activeShift) {
      alert("You are already checked in.");
      return;
    }

    if (!checkInPhoto) {
      alert("Please choose a check-in photo first.");
      return;
    }

    setLoading(true);

    const fileExt = checkInPhoto.name.split(".").pop();
    const fileName = `${user.id}-checkin-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(filePath, checkInPhoto);

    if (uploadError) {
      setLoading(false);
      alert(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const { error } = await supabase
      .from("attendance_logs")
      .insert([
        {
          user_id: user.id,
          check_in_time: new Date().toISOString(),
          check_in_image_url: imageUrl,
        },
      ]);

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Checked in successfully!");
      setCheckInPhoto(null);
      await loadActiveShift(user.id);
      await loadLogs(user.id);
    }
  };

  const handleCheckOut = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!checkOutPhoto) {
      alert("Please choose a check-out photo first.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("user_id", user.id)
      .is("check_out_time", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setLoading(false);
      alert("No active check-in found.");
      return;
    }

    const latest = data[0];

    const fileExt = checkOutPhoto.name.split(".").pop();
    const fileName = `${user.id}-checkout-${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from("attendance-photos")
      .upload(filePath, checkOutPhoto);

    if (uploadError) {
      setLoading(false);
      alert(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("attendance_logs")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_image_url: imageUrl,
      })
      .eq("id", latest.id);

    setLoading(false);

    if (updateError) {
      alert(updateError.message);
    } else {
      alert("Checked out successfully!");
      setCheckOutPhoto(null);
      setActiveShift(null);
      await loadActiveShift(user.id);
      await loadLogs(user.id);
    }
  };

  const hourlyRate = profile?.hourly_rate ?? 25000;

  const totalSalary = logs.reduce((sum, log) => {
    const checkIn = log.check_in_time ? new Date(log.check_in_time) : null;
    const checkOut = log.check_out_time ? new Date(log.check_out_time) : null;

    if (checkIn && checkOut) {
      const hours =
        (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
      return sum + hours * hourlyRate;
    }

    return sum;
  }, 0);

  const totalHours = logs.reduce((sum, log) => {
    const checkIn = log.check_in_time ? new Date(log.check_in_time) : null;
    const checkOut = log.check_out_time ? new Date(log.check_out_time) : null;

    if (checkIn && checkOut) {
      const hours =
        (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
      return sum + hours;
    }

    return sum;
  }, 0);

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
          fontFamily: "Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            background: "white",
            padding: 30,
            borderRadius: 16,
            width: 380,
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <h2 style={{ marginBottom: 20, textAlign: "center" }}>
            Staff Login
          </h2>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 10,
              borderRadius: 10,
              border: "none",
              backgroundColor: "#4CAF50",
              color: "white",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {loading ? "Processing..." : "Log In"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        fontFamily: "Arial, sans-serif",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 16,
          width: 420,
          maxHeight: "90vh",
          overflowY: "auto",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <button
            onClick={handleLogout}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              backgroundColor: "#666",
              color: "white",
              cursor: "pointer",
            }}
          >
            Log Out
          </button>
        </div>

        <h2 style={{ marginBottom: 8 }}>Nagomi Check-in</h2>

        <p style={{ marginBottom: 8 }}>
          <strong>Staff:</strong> {profile?.name || user.email}
        </p>

        <p style={{ marginBottom: 20 }}>
          <strong>Hourly Rate:</strong> {hourlyRate.toLocaleString()} VND/hour
        </p>

        <p style={{ marginBottom: 20 }}>
          {activeShift
            ? `Checked in at ${new Date(
                activeShift.check_in_time || ""
              ).toLocaleTimeString()}`
            : "You are not checked in"}
        </p>

        {!activeShift && (
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              Upload check-in photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCheckInPhoto(e.target.files[0]);
                }
              }}
            />
          </div>
        )}

        {activeShift && (
          <div style={{ marginBottom: 16, textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: 8 }}>
              Upload check-out photo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setCheckOutPhoto(e.target.files[0]);
                }
              }}
            />
          </div>
        )}

        <button
          onClick={handleCheckIn}
          disabled={loading || !!activeShift}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 10,
            borderRadius: 10,
            border: "none",
            backgroundColor: activeShift ? "#ccc" : "#4CAF50",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {loading ? "Processing..." : "Check In"}
        </button>

        <button
          onClick={handleCheckOut}
          disabled={loading || !activeShift}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "none",
            backgroundColor: !activeShift ? "#ccc" : "#f44336",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {loading ? "Processing..." : "Check Out"}
        </button>

        {activeShift && activeShift.check_in_image_url && (
          <div style={{ marginTop: 20 }}>
            <p>Latest check-in photo:</p>
            <img
              src={activeShift.check_in_image_url}
              alt="check-in"
              style={{
                width: "100%",
                borderRadius: 10,
                marginTop: 8,
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: "#fafafa",
            borderRadius: 12,
            textAlign: "left",
            border: "1px solid #eee",
          }}
        >
          <p style={{ margin: "0 0 8px 0" }}>
            <strong>Total Hours:</strong> {totalHours.toFixed(2)} hrs
          </p>
          <p style={{ margin: 0 }}>
            <strong>Total Salary:</strong> {totalSalary.toLocaleString()} VND
          </p>
        </div>

        <h3 style={{ marginTop: 30, marginBottom: 16 }}>My Attendance Logs</h3>

        <div style={{ textAlign: "left" }}>
          {logs.length === 0 ? (
            <p>No attendance records yet.</p>
          ) : (
            logs.map((log) => {
              const checkIn = log.check_in_time
                ? new Date(log.check_in_time)
                : null;

              const checkOut = log.check_out_time
                ? new Date(log.check_out_time)
                : null;

              let hours: number | null = null;
              let salary: number | null = null;

              if (checkIn && checkOut) {
                const diff =
                  (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;
                hours = diff;
                salary = diff * hourlyRate;
              }

              return (
                <div
                  key={log.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Check In:</strong>{" "}
                    {checkIn ? checkIn.toLocaleString() : "-"}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Check Out:</strong>{" "}
                    {checkOut ? checkOut.toLocaleString() : "Still working"}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Hours:</strong>{" "}
                    {hours !== null ? `${hours.toFixed(2)} hrs` : "In progress"}
                  </p>

                  <p style={{ margin: "0 0 6px 0" }}>
                    <strong>Salary:</strong>{" "}
                    {salary !== null ? `${salary.toLocaleString()} VND` : "-"}
                  </p>

                  {log.check_in_image_url && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ marginBottom: 6 }}>
                        <strong>Check-in photo:</strong>
                      </p>
                      <img
                        src={log.check_in_image_url}
                        alt="check-in"
                        style={{
                          width: "100%",
                          borderRadius: 10,
                          marginTop: 4,
                        }}
                      />
                    </div>
                  )}

                  {log.check_out_image_url && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ marginBottom: 6 }}>
                        <strong>Check-out photo:</strong>
                      </p>
                      <img
                        src={log.check_out_image_url}
                        alt="check-out"
                        style={{
                          width: "100%",
                          borderRadius: 10,
                          marginTop: 4,
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}