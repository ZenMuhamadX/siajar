import React from 'react';
import { Link, useLocation } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/common';

/** Halaman 404 — dipakai baik di root maupun di dalam shell admin (`/admin/*`). */
export const NotFound: React.FC = () => {
  const { pathname } = useLocation();
  const inAdmin = pathname.startsWith('/admin');
  const home = inAdmin ? '/admin/overview' : '/';

  return (
    <div className={inAdmin ? '' : 'min-h-[60vh] flex items-center justify-center py-8'}>
      <EmptyState
        icon={<Compass className="w-5 h-5" />}
        title="Halaman tidak ditemukan"
        description={`Alamat "${pathname}" tidak tersedia. Mungkin halaman sudah dipindah atau tidak pernah ada.`}
        action={
          <Link
            to={home}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-xs transition shadow-2xs"
          >
            {inAdmin ? 'Kembali ke Ringkasan' : 'Kembali ke Halaman Utama'}
          </Link>
        }
      />
    </div>
  );
};

export default NotFound;
