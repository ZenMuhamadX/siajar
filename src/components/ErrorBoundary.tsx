import React from 'react';
import type { ReactNode } from 'react';
import { ErrorState } from './common';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Judul fallback (default disesuaikan konteks). */
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Penangkap crash per-route (pengganti `errorElement` yang hanya tersedia di
 * data router). Tanpa ini, satu halaman yang error akan membekukan seluruh
 * panel karena berada di dalam layout yang sama.
 *
 * Reset dilakukan lewat `key` dari pemanggil (mis. `key={location.pathname}`),
 * sehingga pindah halaman otomatis mencoba render ulang.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Halaman gagal dirender:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title={this.props.title || 'Halaman gagal dimuat'}
          message={`${this.state.error.message || 'Terjadi kesalahan tak terduga.'} Silakan coba lagi, atau kembali ke halaman lain bila masalah berlanjut.`}
          onRetry={() => this.setState({ error: null })}
          retryText="Coba Lagi"
        />
      );
    }
    return this.props.children;
  }
}
