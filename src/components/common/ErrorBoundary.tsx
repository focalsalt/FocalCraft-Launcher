import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error("Uncaught error inside React tree:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = () => {
    const errorText = `${this.state.error?.toString()}\n\n${this.state.errorInfo?.componentStack || ""}`;
    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }).catch(err => {
      console.error("Failed to copy error message:", err);
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "40px",
          backgroundColor: "#111111",
          color: "#ffffff",
          fontFamily: "Segoe UI, Inter, sans-serif",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          userSelect: "text",
          WebkitUserSelect: "text"
        }}>
          <div style={{
            maxWidth: "600px",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(244, 67, 54, 0.3)",
            borderRadius: "8px",
            padding: "32px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
            userSelect: "text",
            WebkitUserSelect: "text"
          }}>
            <span style={{ fontSize: "48px" }}>⚠️</span>
            <h1 style={{ fontSize: "24px", margin: "16px 0 8px 0", color: "#ff5252" }}>
              系統發生非預期錯誤
            </h1>
            <p style={{ color: "#aaaaaa", fontSize: "14px", marginBottom: "24px" }}>
              啟動器遇到未預期的 React 渲染錯誤。你可以嘗試重新整理頁面。
            </p>
            
            <div style={{
              textAlign: "left",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              padding: "16px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "12px",
              overflowX: "auto",
              color: "#ff8a80",
              borderLeft: "4px solid #ff5252",
              marginBottom: "24px",
              maxHeight: "200px",
              overflowY: "auto",
              userSelect: "text",
              WebkitUserSelect: "text"
            }}>
              {this.state.error?.toString()}
              {this.state.errorInfo && (
                <pre style={{ margin: "8px 0 0 0", color: "#888", userSelect: "text", WebkitUserSelect: "text" }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={this.handleCopy}
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  padding: "10px 24px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)")}
              >
                {this.state.copied ? "已複製！" : "複製錯誤訊息"}
              </button>

              <button
                onClick={this.handleReload}
                style={{
                  backgroundColor: "#3C8527",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4C9F33")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3C8527")}
              >
                重新整理頁面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
