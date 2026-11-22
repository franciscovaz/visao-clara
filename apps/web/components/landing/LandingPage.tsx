import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { DashboardPreview } from './DashboardPreview';
import { LandingNav } from './LandingNav';
import { PricingSection } from './PricingSection';
import { SmoothScrollLink } from './SmoothScrollLink';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SectionHeading,
  buttonClasses,
  landingThemeStyle,
} from './primitives';
import {
  BENEFITS,
  FEATURES,
  HOW_IT_WORKS,
  LANDING_ANCHORS,
  LANDING_ROUTES,
  NAV_LINKS,
  PROBLEMS,
  SOLUTIONS,
  TARGET_AUDIENCE,
  TRUST_STATS,
} from './landingContent';

const CONTAINER = 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8';
const SECTION = 'py-20 md:py-32';
const HERO_BUTTON = 'w-full px-8 py-6 text-base sm:w-auto';
const ICON_BOX = 'mb-4 flex h-12 w-12 items-center justify-center rounded-[10px]';
const FOOTER_LINK = 'transition-colors hover:text-(--lp-fg)';

/**
 * Public landing page (`/`), reproduced from the Figma Make design.
 * Server Component; only the navigation menu, the pricing toggle and the
 * smooth-scroll link are client components.
 */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-(--lp-bg) text-(--lp-fg)" style={landingThemeStyle}>
      <LandingNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <div className={`${CONTAINER} py-20 md:py-32`}>
            <div className="mx-auto max-w-4xl space-y-8 text-center">
              <Badge variant="secondary" className="mb-4">
                Gestão de projetos de construção simplificada
              </Badge>
              <h1 className="text-4xl font-bold leading-tight text-gray-900 md:text-6xl lg:text-7xl">
                Clareza e controlo para o seu projeto
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-gray-600 md:text-xl">
                Simplifique a gestão de construções, renovações e investimentos imobiliários. Centralize o
                planeamento, os documentos e as despesas num só lugar.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
                <Link href={LANDING_ROUTES.start} className={buttonClasses({ size: 'lg', className: HERO_BUTTON })}>
                  Começar grátis
                  <ArrowRight className="ml-2" aria-hidden="true" />
                </Link>
                <SmoothScrollLink
                  targetId={LANDING_ANCHORS.howItWorks}
                  className={buttonClasses({ variant: 'outline', size: 'lg', className: HERO_BUTTON })}
                >
                  Ver como funciona
                </SmoothScrollLink>
              </div>
              <p className="text-sm text-(--lp-muted-fg)">
                Plano gratuito disponível • Sem cartão de crédito • Comece em poucos minutos
              </p>
            </div>

            <DashboardPreview />
          </div>
        </section>

        {/* Problems */}
        <section className={`${SECTION} bg-(--lp-bg)`}>
          <div className={CONTAINER}>
            <SectionHeading
              title="Os desafios de gerir um projeto de construção"
              subtitle="Conhece estes problemas? Não está sozinho."
            />
            <div className="grid gap-8 md:grid-cols-3">
              {PROBLEMS.map((item) => (
                <Card key={item.title} borderClassName="border-(--lp-destructive)/20" className="relative overflow-hidden">
                  <CardHeader>
                    <div className={`${ICON_BOX} bg-(--lp-destructive)/10`}>
                      <item.icon className="h-6 w-6 text-(--lp-destructive)" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-(--lp-muted-fg)">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className={`${SECTION} bg-(--lp-muted)/30`}>
          <div className={CONTAINER}>
            <SectionHeading
              title="A solução: simples, centralizada, eficaz"
              subtitle="O Visão Clara transforma a gestão do seu projeto numa experiência tranquila e organizada."
            />
            <div className="grid gap-8 md:grid-cols-3">
              {SOLUTIONS.map((item) => (
                <Card key={item.title} className="relative overflow-hidden">
                  <CardHeader>
                    <div className={`${ICON_BOX} bg-(--lp-primary)/10`}>
                      <item.icon className="h-6 w-6 text-(--lp-primary)" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-(--lp-muted-fg)">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className={`${SECTION} bg-(--lp-bg)`}>
          <div className={CONTAINER}>
            <SectionHeading
              title="Benefícios que fazem a diferença"
              subtitle="Mais do que funcionalidades, resultados reais para o seu projeto."
            />
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {BENEFITS.map((item) => (
                <div key={item.title} className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-(--lp-primary)/10">
                    <item.icon className="h-6 w-6 text-(--lp-primary)" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-medium">{item.title}</h3>
                  <p className="text-(--lp-muted-fg)">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id={LANDING_ANCHORS.howItWorks} className={`${SECTION} bg-(--lp-muted)/30`}>
          <div className={CONTAINER}>
            <SectionHeading title="Como funciona" subtitle="Comece a usar em 3 passos simples" />
            <ol className="grid gap-8 md:grid-cols-3 lg:gap-12">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.step} className="relative">
                  <div className="flex flex-col items-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--lp-primary) text-2xl font-bold text-(--lp-primary-fg)">
                      {step.step}
                    </div>
                    <step.icon className="h-12 w-12 text-(--lp-primary)" aria-hidden="true" />
                    <h3 className="text-xl font-medium">{step.title}</h3>
                    <p className="text-(--lp-muted-fg)">{step.description}</p>
                  </div>
                  {index < HOW_IT_WORKS.length - 1 && (
                    <div
                      className="absolute left-[60%] top-8 hidden h-0.5 w-[80%] bg-(--lp-border) md:block"
                      aria-hidden="true"
                    />
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-12 text-center">
              <Link href={LANDING_ROUTES.start} className={buttonClasses({ size: 'lg' })}>
                Começar agora
                <ArrowRight className="ml-2" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id={LANDING_ANCHORS.features} className={`${SECTION} bg-(--lp-bg)`}>
          <div className={CONTAINER}>
            <SectionHeading
              title="Tudo o que precisa num só lugar"
              subtitle="Funcionalidades pensadas para simplificar a gestão do seu projeto"
            />
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((item) => (
                <Card key={item.title}>
                  <CardHeader>
                    <div className={`${ICON_BOX} bg-(--lp-primary)/10`}>
                      <item.icon className="h-6 w-6 text-(--lp-primary)" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-(--lp-muted-fg)">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Who it's for */}
        <section className={`${SECTION} bg-(--lp-muted)/30`}>
          <div className={CONTAINER}>
            <SectionHeading
              title="Para quem é o Visão Clara?"
              subtitle="Ideal para particulares e profissionais que gerem projetos de construção"
            />
            <div className="grid gap-8 md:grid-cols-3">
              {TARGET_AUDIENCE.map((item) => (
                <Card key={item.title} className="text-center">
                  <CardHeader>
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-(--lp-primary)/10">
                      <item.icon className="h-8 w-8 text-(--lp-primary)" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-(--lp-muted-fg)">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />

        {/* Trust */}
        <section className={`${SECTION} bg-(--lp-muted)/30`}>
          <div className={CONTAINER}>
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold md:text-5xl">Construído para simplificar projetos reais</h2>
              <p className="mb-12 text-lg text-(--lp-muted-fg)">
                O Visão Clara foi criado para resolver os desafios reais de quem gere obras e renovações, com foco
                na simplicidade e na eficácia.
              </p>
              <dl className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
                {TRUST_STATS.map((stat) => (
                  <div key={stat.label} className="flex flex-col-reverse">
                    <dt className="text-sm text-(--lp-muted-fg)">{stat.label}</dt>
                    <dd className="mb-2 text-3xl font-bold text-(--lp-primary) md:text-4xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={`${SECTION} bg-gradient-to-br from-blue-600 to-purple-600 text-white`}>
          <div className="mx-auto max-w-4xl space-y-8 px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold md:text-5xl">Pronto para ter clareza no seu projeto?</h2>
            <p className="text-lg opacity-90 md:text-xl">
              Comece agora gratuitamente e veja como é fácil gerir o seu projeto de construção ou renovação.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
              <Link
                href={LANDING_ROUTES.start}
                className={buttonClasses({ variant: 'secondary', size: 'lg', className: HERO_BUTTON })}
              >
                Começar grátis
                <ArrowRight className="ml-2" aria-hidden="true" />
              </Link>
              <Link
                href={LANDING_ROUTES.login}
                className={buttonClasses({ variant: 'outline-inverse', size: 'lg', className: HERO_BUTTON })}
              >
                Já tenho conta
              </Link>
            </div>
            <p className="text-sm opacity-75">Sem compromisso • Plano gratuito disponível</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-(--lp-border) bg-(--lp-bg) py-12">
        <div className={CONTAINER}>
          <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <h4 className="mb-4 font-medium">Produto</h4>
              <ul className="space-y-2 text-sm text-(--lp-muted-fg)">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={FOOTER_LINK}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-medium">Legal</h4>
              <ul className="space-y-2 text-sm text-(--lp-muted-fg)">
                <li>
                  <Link href={LANDING_ROUTES.privacy} className={FOOTER_LINK}>
                    Privacidade
                  </Link>
                </li>
                <li>
                  <Link href={LANDING_ROUTES.terms} className={FOOTER_LINK}>
                    Termos
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-(--lp-border) pt-8 md:flex-row">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-(--lp-primary)" aria-hidden="true" />
              <span className="font-medium">Visão Clara</span>
            </div>
            <p className="text-sm text-(--lp-muted-fg)">© 2026 Visão Clara. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
