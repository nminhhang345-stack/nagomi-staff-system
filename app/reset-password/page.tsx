"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";;

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace("#", ""));
      const access_token = params.get("access_token");

       if (access_token) {
         supabase.auth.setSession({
           access_token,
           refresh_token: access_token,
        });
    }
  }
}, []);

  const handleUpdatePassword = async () => {
    if (!password) {
      alert("Please enter a new password.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Password updated successfully. You can now log in.");
      window.location.href = "/";
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(180deg, #dff4ff 0%, #cdefff 24%, #b7e4fa 55%, #eef8ff 100%)",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "rgba(255,255,255,0.75)",
          borderRadius: 28,
          padding: 28,
          boxShadow: "0 20px 60px rgba(67, 143, 184, 0.18)",
        }}
      >
        <h1
          style={{
            margin: "0 0 10px 0",
            fontSize: 32,
            color: "#15384b",
            textAlign: "center",
          }}
        >
          Reset Password
        </h1>

        <p
          style={{
            margin: "0 0 20px 0",
            color: "#5f7d8e",
            textAlign: "center",
          }}
        >
          Enter your new password below.
        </p>

        <label
          style={{
            display: "block",
            marginBottom: 8,
            color: "#456579",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          New Password
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new password"
          style={{
            width: "100%",
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(149, 194, 214, 0.8)",
            background: "rgba(255,255,255,0.88)",
            outline: "none",
            fontSize: 15,
            color: "#15384b",
            boxSizing: "border-box",
            marginBottom: 18,
          }}
        />

        <button
          onClick={handleUpdatePassword}
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 18,
            padding: "16px 18px",
            background: "linear-gradient(135deg, #4aa6d8, #2f8cc4, #2277a9)",
            color: "white",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}