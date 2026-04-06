import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-sm">
          <div className="text-rose-400 font-semibold mb-2">⚠️ Page crashed</div>
          <div className="text-rose-300/80 font-mono text-xs mb-4 whitespace-pre-wrap">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
