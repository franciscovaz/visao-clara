'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Menu, X } from 'lucide-react';
import { buttonClasses } from './primitives';
import { LANDING_ROUTES, NAV_LINKS } from './landingContent';

const NAV_LINK_CLASS = 'text-sm text-(--lp-muted-fg) transition-colors hover:text-(--lp-fg)';

export function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-(--lp-border) bg-(--lp-bg)/95 backdrop-blur supports-[backdrop-filter]:bg-(--lp-bg)/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-(--lp-primary)" aria-hidden="true" />
            <span className="text-lg font-semibold text-(--lp-fg)">Visão Clara</span>
          </div>

          {/* Desktop navigation */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={NAV_LINK_CLASS}>
                {link.label}
              </a>
            ))}
            <Link href={LANDING_ROUTES.login} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              Entrar
            </Link>
            <Link href={LANDING_ROUTES.start} className={buttonClasses({ size: 'sm' })}>
              Começar grátis
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div id="landing-mobile-menu" className="space-y-4 border-t border-(--lp-border) py-4 md:hidden">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={`block ${NAV_LINK_CLASS}`} onClick={closeMenu}>
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={LANDING_ROUTES.login}
                className={buttonClasses({ variant: 'ghost', className: 'w-full' })}
                onClick={closeMenu}
              >
                Entrar
              </Link>
              <Link
                href={LANDING_ROUTES.start}
                className={buttonClasses({ className: 'w-full' })}
                onClick={closeMenu}
              >
                Começar grátis
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
