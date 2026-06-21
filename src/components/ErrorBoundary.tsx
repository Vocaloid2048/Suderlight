import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — 捕获组件树中的渲染错误，防止整个应用白屏。
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    //this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0a',
            color: '#ccc',
            fontFamily: 'sans-serif',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <h2 style={{ color: '#e06060', marginBottom: '1rem' }}>發生了未預期的錯誤</h2>
          <p style={{ marginBottom: '0.5rem', maxWidth: '480px' }}>
            微光城市的某個部分暫時無法顯示。請嘗試重新整理頁面。
          </p>
          {!import.meta.env.PROD && this.state.error && (
            <pre
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#1a1a1a',
                borderRadius: '8px',
                maxWidth: '600px',
                overflow: 'auto',
                fontSize: '0.8rem',
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: '#2a2a2a',
              color: '#ccc',
              border: '1px solid #444',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            重新整理
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
