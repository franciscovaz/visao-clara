'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProjectRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect from /{projectId} to /{projectId}/dashboard
    const pathname = window.location.pathname;
    if (pathname && !pathname.includes('/dashboard')) {
      router.replace(`${pathname}/dashboard`);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
}
