import { Building2 } from 'lucide-react';

/** Decorative product preview (pure CSS, as in the Figma Make design). */
export function DashboardPreview() {
  return (
    <div className="relative mt-16" aria-hidden="true">
      <div className="mx-auto max-w-5xl rounded-[10px] border border-(--lp-border) bg-white p-4 shadow-2xl md:p-8">
        <div className="aspect-video overflow-hidden rounded-[8px] border border-gray-200 bg-gradient-to-br from-blue-50 via-white to-purple-50">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-semibold">Visão Clara</span>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-16 rounded bg-gray-200" />
                <div className="h-6 w-6 rounded-full bg-blue-600" />
              </div>
            </div>

            <div className="flex flex-1">
              {/* Sidebar */}
              <div className="w-48 space-y-2 border-r border-gray-200 bg-white p-3">
                <div className="h-6 rounded bg-blue-100" />
                <div className="h-6 rounded bg-gray-100" />
                <div className="h-6 rounded bg-gray-100" />
                <div className="h-6 rounded bg-gray-100" />
              </div>

              {/* Main content */}
              <div className="flex-1 bg-gray-50 p-4">
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div className="rounded-[10px] border border-gray-200 bg-white p-3">
                    <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
                    <div className="h-6 w-12 rounded bg-blue-600" />
                  </div>
                  <div className="rounded-[10px] border border-gray-200 bg-white p-3">
                    <div className="mb-2 h-3 w-20 rounded bg-gray-200" />
                    <div className="h-6 w-12 rounded bg-green-600" />
                  </div>
                </div>
                <div className="space-y-2 rounded-[10px] border border-gray-200 bg-white p-3">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-5/6 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
