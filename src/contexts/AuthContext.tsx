import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  activeTeacherName: string | null;
  isAdmin: boolean;
  isDev: boolean;
  loading: boolean;
  loginAsTeacher: (namaGuru: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  loginAsAdmin: (pin: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Shared Universal PIN for Teachers (can be overridden via env)
export const UNIVERSAL_TEACHER_PIN = import.meta.env.VITE_TEACHER_PIN;
// Superuser / Admin PIN (can be overridden via env)
export const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN

const STORAGE_KEY_TEACHER = 'active_teacher_name';
const STORAGE_KEY_IS_ADMIN = 'is_admin_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTeacherName, setActiveTeacherName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedTeacher = localStorage.getItem(STORAGE_KEY_TEACHER);
      const storedAdmin = localStorage.getItem(STORAGE_KEY_IS_ADMIN) === 'true';

      if (storedTeacher) {
        setActiveTeacherName(storedTeacher);
      }
      setIsAdmin(storedAdmin);
    } catch (e) {
      console.error('Error loading stored auth state:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsTeacher = async (namaGuru: string, pin: string): Promise<{ success: boolean; message?: string }> => {
    if (!namaGuru || !namaGuru.trim()) {
      return { success: false, message: 'Pilih nama guru terlebih dahulu.' };
    }
    if (pin.trim() !== UNIVERSAL_TEACHER_PIN && pin.trim() !== ADMIN_PIN) {
      return { success: false, message: 'PIN Sekolah tidak valid.' };
    }

    const trimmedName = namaGuru.trim();
    setActiveTeacherName(trimmedName);
    setIsAdmin(false);

    localStorage.setItem(STORAGE_KEY_TEACHER, trimmedName);
    localStorage.removeItem(STORAGE_KEY_IS_ADMIN);

    return { success: true };
  };

  const loginAsAdmin = async (pin: string): Promise<{ success: boolean; message?: string }> => {
    if (pin.trim() !== ADMIN_PIN) {
      return { success: false, message: 'PIN Admin / Superuser tidak valid.' };
    }

    setActiveTeacherName('Administrator');
    setIsAdmin(true);

    localStorage.setItem(STORAGE_KEY_TEACHER, 'Administrator');
    localStorage.setItem(STORAGE_KEY_IS_ADMIN, 'true');

    return { success: true };
  };

  const signOut = () => {
    setActiveTeacherName(null);
    setIsAdmin(false);
    localStorage.removeItem(STORAGE_KEY_TEACHER);
    localStorage.removeItem(STORAGE_KEY_IS_ADMIN);
  };

  return (
    <AuthContext.Provider
      value={{
        activeTeacherName,
        isAdmin,
        isDev: isAdmin, // Dev mode is accessible when admin
        loading,
        loginAsTeacher,
        loginAsAdmin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
