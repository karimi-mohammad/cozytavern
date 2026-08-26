import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(`ErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-tavern-bg/95 p-4">
          <div className="bg-tavern-card rounded-xl w-full max-w-sm p-6 shadow-2xl border border-tavern-border">
            <h2 className="text-base font-semibold text-tavern-text-bright mb-2">
              Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}
            </h2>
            <p className="text-sm text-tavern-dim leading-6 mb-4">
              This section encountered an error. You can try again or refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-tavern-accent hover:bg-tavern-accent-hover text-white text-sm rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
export default ErrorBoundary;
