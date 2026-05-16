import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#F6F8FB",
        surface: "#FFFFFF",
        primary: "#1E40AF",
        "primary-soft": "#DBEAFE",
        "text-main": "#111827",
        "text-secondary": "#6B7280",
        border: "#E5E7EB",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444"
      },
      boxShadow: {
        panel: "0 18px 48px rgba(15, 23, 42, 0.08)",
        soft: "0 8px 24px rgba(15, 23, 42, 0.06)"
      },
      gridTemplateColumns: {
        dashboard: "280px minmax(0, 1fr)"
      }
    }
  },
  plugins: []
};

export default config;
