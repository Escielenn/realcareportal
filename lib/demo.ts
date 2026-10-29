import "server-only";

// Fictional demo accounts for the one-click login on the demo site. Never used when DEMO_MODE is off.
export const demoLogin = {
  accounts: [
    { label: "Provider (English)", who: "Maria Delgado, Host Home", email: "demo.provider@example.com" },
    { label: "Proveedor (español)", who: "Luis Herrera, SCC/DSP", email: "demo.proveedor@example.com" },
    { label: "Real Care staff", who: "Dana Whitfield, reviewer", email: "demo.staff@example.com" },
  ],
  password: "RealCare-Demo-2026",
};
