import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 全局错误边界：渲染期异常不再白屏，提供「重新加载」恢复入口（迭代计划书 M5 稳定性项） */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    try {
      console.error("[ErrorBoundary]", error);
    } catch {
      /* 控制台不可用时忽略 */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <h1>页面出了点问题</h1>
          <p>渲染过程中发生异常，请重新加载；如反复出现可反馈给维护者。</p>
          <pre>{String(this.state.error.message || this.state.error)}</pre>
          <button className="btn primary" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
