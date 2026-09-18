import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0056D2", dark: "#0046B0", light: "#4C8DF0", contrastText: "#FFFFFF" },
    secondary: { main: "#0B1B3A", dark: "#071226", light: "#12264F", contrastText: "#FFFFFF" },
    error: { main: "#EF4444" },
    success: { main: "#10B981" },
    warning: { main: "#F59E0B" },
    background: { default: "#F4F7FB", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: "#E2E8F0",
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: `'Inter', 'Noto Sans Devanagari', 'Noto Sans Tamil', sans-serif`,
    h1: { fontFamily: `'Outfit', 'Inter', sans-serif`, fontWeight: 800 },
    h2: { fontFamily: `'Outfit', 'Inter', sans-serif`, fontWeight: 700 },
    h3: { fontFamily: `'Outfit', 'Inter', sans-serif`, fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { minHeight: 44, borderRadius: 12, paddingLeft: 16, paddingRight: 16 },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 20, padding: 4 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
