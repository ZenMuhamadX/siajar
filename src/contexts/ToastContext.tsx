import React, { createContext, useCallback, useContext, useState } from 'react';
import { ToastContainer, type ToastMessage } from '../components/Toast';

export type ShowToast = (type: 'success' | 'error' | 'info', message: string) => void;

const ToastContext = createContext<ShowToast | undefined>(undefined);

/**
 * Toast global: dirender sekali di root sehingga notifikasi tetap tampil
 * walaupun user berpindah halaman/route.
 *
 * Halaman lama masih menerima `showToast` sebagai prop; wrapper route yang
 * mengambil nilai dari context ini lalu meneruskannya (pola hibrida, aman untuk
 * dihapus bertahap per halaman dengan memanggil `useToast()` langsung).
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback<ShowToast>((type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={handleDismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ShowToast => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
