import React from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { SUPPORT_EMAIL } from "../api/brand";

type Scope = "app" | "route";

type Props = {
  children: React.ReactNode;
  /** "app" fills the screen. "route" keeps the shell navigation visible. */
  scope?: Scope;
  /** Navigates home without a full reload. Falls back to reloading "/". */
  onHome?: () => void;
  /** Runs before the boundary clears its error, e.g. to reload page data. */
  onReset?: () => void;
};

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
  resetKey: number;
};

const isDev = Boolean(import.meta.env.DEV);

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    // Keep the crash in the console so it is not silently swallowed.
    console.error("FixBuddy render error:", error, info.componentStack);
  }

  private retry = () => {
    this.props.onReset?.();
    this.setState((prev) => ({ error: null, info: null, resetKey: prev.resetKey + 1 }));
  };

  private goHome = () => {
    const { onHome } = this.props;
    if (onHome) {
      this.setState((prev) => ({ error: null, info: null, resetKey: prev.resetKey + 1 }));
      onHome();
      return;
    }
    window.location.assign("/");
  };

  render() {
    const { children, scope = "route" } = this.props;
    const { error, info, resetKey } = this.state;

    if (!error) {
      return <React.Fragment key={resetKey}>{children}</React.Fragment>;
    }

    const details = [error.message, error.stack, info?.componentStack].filter(Boolean).join("\n\n");

    const body = (
      <Paper
        variant="outlined"
        sx={{ p: { xs: 2.5, sm: 4 }, maxWidth: 520, width: "100%", textAlign: "center" }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            mx: "auto",
            mb: 2,
            borderRadius: 2,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 22,
          }}
        >
          F
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This screen stopped loading. Your account and your active job are safe. Try again, or go back
          to the home screen.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
          <Button fullWidth variant="contained" startIcon={<RefreshIcon />} onClick={this.retry}>
            Try Again
          </Button>
          <Button fullWidth variant="outlined" startIcon={<HomeOutlinedIcon />} onClick={this.goHome}>
            Back to Home
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Still stuck? Email {SUPPORT_EMAIL}
        </Typography>

        {isDev && details ? (
          <Box sx={{ mt: 3, textAlign: "left" }}>
            <Alert severity="warning" sx={{ mb: 1 }}>
              Development details are hidden in production builds.
            </Alert>
            <details>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Technical details
              </summary>
              <Box
                component="pre"
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: "grey.100",
                  fontSize: 11,
                  lineHeight: 1.5,
                  maxHeight: 260,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {details}
              </Box>
            </details>
          </Box>
        ) : null}
      </Paper>
    );

    return (
      <Box
        sx={
          scope === "app"
            ? {
                minHeight: "100vh",
                bgcolor: "background.default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 2,
              }
            : { display: "flex", justifyContent: "center", p: { xs: 2, sm: 4 } }
        }
      >
        {body}
      </Box>
    );
  }
}
