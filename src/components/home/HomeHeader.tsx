import React from "react";

export interface HomeHeaderProps {
  user: { email: string } | null;
  onLogout: () => void;
  onSearch: () => void;
}

export function HomeHeader({ user, onLogout, onSearch }: HomeHeaderProps) {
  return (
    <div
      style={{
        padding: "32px 40px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "24px",
        background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
        backdropFilter: "blur(20px)",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
            transform: "translateY(0)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
            e.currentTarget.style.boxShadow = "0 12px 32px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset";
          }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "32px", height: "32px" }}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          <h1
            style={{
              fontSize: "var(--font-size-2xl)",
              lineHeight: "var(--line-height-snug)",
              letterSpacing: "var(--letter-spacing-tight)",
              fontWeight: 800,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
              letterSpacing: "-0.5px",
            }}
          >
            AI Organizer
          </h1>
          <p style={{ marginTop: "8px", fontSize: "16px", color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}>
            Document management and segmentation platform
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div
          style={{
            textAlign: "right",
            background: "rgba(255, 255, 255, 0.03)",
            padding: "12px 20px",
            borderRadius: "12px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(10px)",
          }}
        >
          <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", margin: 0, marginBottom: "4px" }}>Logged in as</p>
          <p style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", fontWeight: 600, color: "#eaeaea", margin: 0 }}>{user?.email}</p>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: "12px 24px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            color: "#eaeaea",
            fontWeight: 500,
            fontSize: "var(--font-size-base)",
            lineHeight: "var(--line-height-normal)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
        <button
          onClick={onSearch}
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "12px",
            color: "#a5b4fc",
            fontWeight: 500,
            fontSize: "var(--font-size-base)",
            lineHeight: "var(--line-height-normal)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)";
            e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)";
            e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.2)";
          }}
          title="Search (Ctrl+K)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search
        </button>
      </div>
    </div>
  );
}

