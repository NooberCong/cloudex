import React from 'react'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', padding: '2rem', fontFamily: 'monospace', background: '#0f1117', color: '#e6edf3'
        }}>
          <h2 style={{ color: '#f85149', marginBottom: '1rem' }}>Renderer Error</h2>
          <pre style={{
            background: '#161b22', border: '1px solid #30363d', borderRadius: '8px',
            padding: '1rem', maxWidth: '80vw', overflow: 'auto', fontSize: '12px'
          }}>
            {error.message}{'\n\n'}{error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
