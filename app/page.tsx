"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type FilterType = "all" | "today" | "week" | "month";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [activeShift, setActiveShift] = useState<AttendanceRow | null>(null);
  const [loading, setLoading] = useState(false);
  const getCurrentTime = () => {
    const current = new Date();
    return current.getHours() + current.getMinutes() / 60;
  };

  const [status, setStatus] = useState("");
  const [cameraMode, setCameraMode] = useState<"checkin" | "checkout" | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<File | null>(null);
  const [logs, setLogs] = useState<AttendanceRow[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream |null>(null);

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const loggedInUser = data.user;

    if (!loggedInUser) {
      alert("Login failed.");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", loggedInUser.id)
      .single();

    if (profileError || !profileData) {
      alert("Cannot load profile.");
      return;
    }

    if (profileData.role === "admin") {
      window.location.href = "/admin";
    } else {
      window.location.href = "/";
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://nagomi-staff-system.vercel.app/reset-password",
    });

    if (error) {
      alert(error.message);
    } else {
      setStatus("Check your email to reset password.IMPORTANT: Please wait a few minutes before trying again!");
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

 const now = new Date();
 const hours = now.getHours();
 const minutes = now.getMinutes();

 const currentTime = hours + minutes / 60;

 const handleCheckIn = async () => {
  if (!user) {
    alert("Please log in first");
    return;
  }
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  if (profile?.role !== "admin" && hour < 9) {
  alert("Check-in only allowed after 09:00");
  return;
  }
  if (activeShift) {
    alert("You are already checked in.");
    return;
  }

  if (!capturedBlob || cameraMode !== "checkin") {
    alert("Please take a check-in photo first.");
    setStatus("");
    return;
  }

  setLoading(true);
  setStatus("Uploading...");

  const fileName = `${user.id}-checkin-${Date.now()}.jpg`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage
    .from("attendance-photos")
    .upload(filePath, capturedBlob, {
      contentType: "image/jpeg",
    });

  if (uploadError) {
    setLoading(false);
    setStatus("");
    alert(uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from("attendance-photos")
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;

  setStatus("Saving attendance...");

  const { error } = await supabase.from("attendance_logs").insert([
    {
      user_id: user.id,
      check_in_time: new Date().toISOString(),
      check_in_image_url: imageUrl,
    },
  ]);

  setLoading(false);
  setStatus("");

  if (error) {
    alert(error.message);
  } else {
    resetCapturedPhoto();
    setCameraMode(null);
    await loadActiveShift(user.id);
  }
};

  const handleCheckOut = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    if (profile?.role !== "admin" && hour > 21.6) {
    alert("Check-out must be before 21:30");
    return;
}
  if (!capturedBlob || cameraMode !== "checkout") {
    alert("Please take a check-out photo first.");
    setStatus("");
    return;
  }

  setLoading(true);
  setStatus("Finding active shift...");

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("user_id", user.id)
    .is("check_out_time", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    setLoading(false);
    setStatus("");
    alert(error.message);
    return;
  }

  if (!data || data.length === 0) {
    setLoading(false);
    setStatus("");
    alert("No active check-in found.");
    return;
  }

  const latest = data[0];

  const fileName = `${user.id}-checkout-${Date.now()}.jpg`;
  const filePath = fileName;

  setStatus("Uploading...");

  const { error: uploadError } = await supabase.storage
    .from("attendance-photos")
    .upload(filePath, capturedBlob, {
      contentType: "image/jpeg",
    });

  if (uploadError) {
    setLoading(false);
    setStatus("");
    alert(uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from("attendance-photos")
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;

  setStatus("Saving attendance...");

  const { error: updateError } = await supabase
    .from("attendance_logs")
    .update({
      check_out_time: new Date().toISOString(),
      check_out_image_url: imageUrl,
    })
    .eq("id", latest.id);

  setLoading(false);
  setStatus("");

  if (updateError) {
    alert(updateError.message);
  } else {
    resetCapturedPhoto();
    setCameraMode(null);
    setActiveShift(null);
    await loadActiveShift(user.id);
  }
};

  const hourlyRate = profile?.hourly_rate ?? 25000;

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

  const totalStats = useMemo(() => {
    let totalHours = 0;
    let totalSalary = 0;

    filteredLogs.forEach((log) => {
      if (log.check_in_time && log.check_out_time) {
        const checkIn = new Date(log.check_in_time);
        const checkOut = new Date(log.check_out_time);

        const hours =
          (checkOut.getTime() - checkIn.getTime()) / 1000 / 60 / 60;

        totalHours += hours;
        totalSalary += hours * hourlyRate;
      }
    });

    return {
      totalHours,
      totalSalary,
    };
  }, [filteredLogs, hourlyRate]);

const startCamera = async (mode: "checkin" | "checkout") => {
  try {
    setStatus("Opening camera...");
    setCapturedBlob(null);
    setPreviewUrl(null);
    setCameraMode(mode);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 480 },
        height: { ideal: 360 },
      },
      audio: false,
    });

    streamRef.current = stream;

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }, 100);

    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("");
    alert("Cannot open camera. Please allow camera access.");
    setCameraMode(null);
  }
};

const stopCamera = () => {
  if (streamRef.current) {
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }
  if (videoRef.current) {
    videoRef.current.srcObject = null;
  }
};

const capturePhoto = async () => {
  if (!videoRef.current) return;

  const video = videoRef.current;
  const canvas = document.createElement("canvas");

  canvas.width = 480;
  canvas.height = 360;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      if (!blob) return;

      setCapturedBlob(blob);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);

      stopCamera();
      setStatus("Photo captured.");
    },
    "image/jpeg",
    0.35
  );
};

const resetCapturedPhoto = () => {
  setCapturedBlob(null);

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }

  setPreviewUrl(null);
  setStatus("");
};
  if (!user) {
    return (
      <div style={pageWrap}>
        <div style={loginCard}>
          <div style={pearlBadge}>◌</div>
          <h1 style={titleStyle}>Nagomi Pearl Shift</h1>
          <p style={subtitleStyle}>Have a good working day at Nagomiya!.</p>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="Enter your email"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Enter your password"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={mainBlueBtn}
          >
            {loading ? "Entering..." : "Log In"}
          </button>

          <button onClick={handleForgotPassword} style={forgotBtn}>
            Forgot password?
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={mobileCard}>
        <div style={topBar}>
          <div>
            <div style={smallLabel}>Staff</div>
            <div style={staffName}>{profile?.name || user.email}</div>
          </div>
          <button onClick={handleLogout} style={logoutBtn}>
            Log Out
          </button>
        </div>

        <div style={heroCard}>
          <div style={heroGlow} />
          <div style={pearlBadgeLarge}>◌</div>
          <h1 style={heroTitle}>Pearl Shift</h1>
          <p style={heroSubtitle}>
            {activeShift
              ? `Checked in at ${new Date(
                  activeShift.check_in_time || ""
                ).toLocaleTimeString()}`
              : "You are not checked in"}
          </p>
        </div>

        <div style={statGrid}>
          <div style={statCard}>
            <div style={statLabel}>Hourly Rate</div>
            <div style={statValue}>{hourlyRate.toLocaleString()} VND</div>
          </div>
          <div style={statCard}>
            <div style={statLabel}>Current Filter</div>
            <div style={statValueSmall}>
              {filter === "all"
                ? "All Time"
                : filter === "today"
                ? "Today"
                : filter === "week"
                ? "This Week"
                : "This Month"}
            </div>
          </div>
          <div style={{ ...statCard, gridColumn: "1 / -1" }}>
            <div style={statLabel}>Salary Transparency</div>
            <div style={statValue}>{totalStats.totalSalary.toLocaleString()} VND</div>
            <div style={statSubText}>
              {totalStats.totalHours.toFixed(2)} hrs × {hourlyRate.toLocaleString()} VND/hour
            </div>
          </div>
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

        {!activeShift && (
          <div style={uploadCard}>
            <div style={uploadTitle}>Check-in photo</div>
            {!cameraMode && (
              <button style={mainBlueBtn} onClick={() => startCamera("checkin")}>
                Open Camera
              </button>
            )}
          </div>
        )}

        {activeShift && (
          <div style={uploadCard}>
            <div style={uploadTitle}>Check-out photo</div>
            {!cameraMode && (
              <button style={mainBlueBtn} onClick={() => startCamera("checkout")}>
                Open Camera 
              </button>
            )}
          </div>
        )}
  {status && (
   <div
    style={{
      marginTop: 14,
      padding: 12,
      borderRadius: 14,
      background: "rgba(255,255,255,0.72)",
      color: "#1f4860",
      fontSize: 14,
      fontWeight: 600,
      textAlign: "center",
    }}
  >
    {status}
  </div>
)}
{status && (
  <div
    style={{
      marginTop: 14,
      padding: 12,
      borderRadius: 14,
      background: "rgba(255,255,255,0.72)",
      color: "#1f4860",
      fontSize: 14,
      fontWeight: 600,
      textAlign: "center",
    }}
  >
    {status}
  </div>
)}
{cameraMode && (
  <div style={photoPreviewCard}>
    <div style={sectionTitle}>
      {cameraMode === "checkin" ? "Check-in Camera" : "Check-out Camera"}
    </div>

    {!previewUrl ? (
      <>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            borderRadius: 18,
            background: "#000",
          }}
        />
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button style={mainBlueBtn} onClick={capturePhoto}>
            Take Photo
          </button>
          <button
            style={softPearlBtn}
            onClick={() => {
              stopCamera();
              setCameraMode(null);
              setStatus("");
            }}
          >
            Cancel
          </button>
        </div>
      </>
    ) : (
      <>
        <img src={previewUrl} alt="preview" style={previewImage} />
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button
            style={mainBlueBtn}
            onClick={() => {
              resetCapturedPhoto();
              if (cameraMode) {
               startCamera(cameraMode);
            }
            }}
          >
            Retake Photo
          </button>
        </div>
      </>
    )}
  </div>
)}
        <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
          <button
            onClick={handleCheckIn}
            disabled={loading || !!activeShift}
            style={{
              ...mainBlueBtn,
              opacity: activeShift ? 0.5 : 1,
            }}
          >
            {loading ? "Processing..." : "Check In"}
          </button>

          <button
            onClick={handleCheckOut}
            disabled={loading || !activeShift}
            style={{
              ...softPearlBtn,
              opacity: !activeShift ? 0.5 : 1,
            }}
          >
            {loading ? "Processing..." : "Check Out"}
          </button>
        </div>

        {activeShift?.check_in_image_url && (
          <div style={photoPreviewCard}>
            <div style={sectionTitle}>Latest Check-in Photo</div>
            <img
              src={activeShift.check_in_image_url}
              alt="check-in"
              style={previewImage}
            />
          </div>
        )}

        <div style={summaryCard}>
          <div style={sectionTitle}>Why You’re Paid This Much</div>
          <div style={summaryExplain}>
            Your salary is calculated from each completed shift:
          </div>
          <div style={formulaBox}>Salary = Hours worked × Hourly rate</div>
          <div style={summaryExplain}>
            For the current filter, your total is:
          </div>
          <div style={summaryTotal}>
            {totalStats.totalHours.toFixed(2)} hrs × {hourlyRate.toLocaleString()} VND
            = {` ${totalStats.totalSalary.toLocaleString()} VND`}
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={sectionTitle}>My Attendance Logs</div>

          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            {filteredLogs.length === 0 ? (
              <div style={emptyCard}>No attendance records for this filter.</div>
            ) : (
              filteredLogs.map((log) => {
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
                  <div key={log.id} style={logCard}>
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

                    <div style={logRow}>
                      <span style={logLabel}>Hours</span>
                      <span style={logValue}>
                        {hours !== null ? `${hours.toFixed(2)} hrs` : "In progress"}
                      </span>
                    </div>

                    <div style={logRow}>
                      <span style={logLabel}>Salary</span>
                      <span style={logValue}>
                        {salary ? Math.floor(salary).toLocaleString() : "-"}
                      </span>
                    </div>

                    {log.check_in_image_url && (
                      <div style={{ marginTop: 14 }}>
                        <div style={imageLabel}>Check-in photo</div>
                        <img
                          src={log.check_in_image_url}
                          alt="check-in"
                          style={previewImage}
                        />
                      </div>
                    )}

                    {log.check_out_image_url && (
                      <div style={{ marginTop: 14 }}>
                        <div style={imageLabel}>Check-out photo</div>
                        <img
                          src={log.check_out_image_url}
                          alt="check-out"
                          style={previewImage}
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

const mobileCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  padding: 18,
};

const loginCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
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
};

const smallLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5d7c8d",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const staffName: React.CSSProperties = {
  fontSize: 20,
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
  fontSize: 32,
  color: "#14384b",
  fontWeight: 700,
};

const heroSubtitle: React.CSSProperties = {
  margin: "10px 0 0 0",
  color: "#557589",
  fontSize: 16,
  lineHeight: 1.5,
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 16,
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
  fontSize: 20,
  color: "#173b4d",
  fontWeight: 700,
  lineHeight: 1.3,
};

const statValueSmall: React.CSSProperties = {
  fontSize: 18,
  color: "#173b4d",
  fontWeight: 700,
  lineHeight: 1.3,
};

const statSubText: React.CSSProperties = {
  fontSize: 13,
  color: "#648197",
  marginTop: 6,
};

const filterWrap: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const uploadCard: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(255,255,255,0.72)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.10)",
};

const uploadTitle: React.CSSProperties = {
  marginBottom: 10,
  color: "#1f4860",
  fontWeight: 700,
  fontSize: 15,
};

const fileInputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  color: "#35566b",
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

const forgotBtn: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  border: "none",
  background: "transparent",
  color: "#2f8cc4",
  fontSize: 14,
  textDecoration: "underline",
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
  padding: "10px 14px",
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
  padding: "10px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(37, 116, 160, 0.18)",
};

const photoPreviewCard: React.CSSProperties = {
  marginTop: 20,
  background: "rgba(255,255,255,0.72)",
  borderRadius: 22,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.10)",
};

const summaryCard: React.CSSProperties = {
  marginTop: 20,
  background: "rgba(255,255,255,0.72)",
  borderRadius: 22,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.65)",
  boxShadow: "0 10px 24px rgba(93, 146, 172, 0.10)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 20,
  color: "#173b4d",
  fontWeight: 700,
  marginBottom: 10,
};

const summaryExplain: React.CSSProperties = {
  fontSize: 14,
  color: "#5b778d",
  marginBottom: 8,
  lineHeight: 1.5,
};

const formulaBox: React.CSSProperties = {
  background: "rgba(244,251,255,0.95)",
  borderRadius: 16,
  padding: 14,
  color: "#18445a",
  fontWeight: 700,
  marginBottom: 10,
};

const summaryTotal: React.CSSProperties = {
  color: "#173b4d",
  fontWeight: 700,
  fontSize: 16,
  lineHeight: 1.6,
};

const previewImage: React.CSSProperties = {
  width: "100%",
  borderRadius: 18,
  marginTop: 6,
  display: "block",
  boxShadow: "0 12px 30px rgba(96, 145, 171, 0.12)",
};

const emptyCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.72)",
  borderRadius: 18,
  padding: 18,
  color: "#5e7d90",
  border: "1px solid rgba(255,255,255,0.65)",
};

const logCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.78)",
  borderRadius: 22,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.7)",
  boxShadow: "0 12px 28px rgba(87, 145, 175, 0.10)",
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

const imageLabel: React.CSSProperties = {
  color: "#557389",
  fontWeight: 700,
  marginBottom: 6,
  fontSize: 14,
}