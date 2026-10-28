import { Logo } from "@/components/logo";
import { MountainBand } from "@/components/mountains";

// Sign-in and invitation screens: a mountain hero beside the form, echoing realcarecolorado.com.
export function AuthShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: React.ReactNode }) {
  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      <MountainBand className="flex flex-col justify-between px-6 py-8 sm:px-10 lg:min-h-dvh lg:px-14 lg:py-12">
        <div className="flex items-center gap-3">
          <Logo tile className="h-20 sm:h-24" />
          <span className="font-display text-lg font-semibold">Real Care Colorado</span>
        </div>
        <div className="py-10 lg:py-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-sky uppercase">Quality services with an individualized approach</p>
          <p className="mt-4 max-w-xl font-display text-3xl leading-tight font-medium sm:text-4xl lg:text-5xl">
            Dedicated to supporting the individuals we serve to live their best life.
          </p>
          <p className="mt-4 max-w-md text-white/80">Training, forms, documents and messages for Real Care providers, all in one place.</p>
        </div>
        <p className="hidden text-sm text-white/60 lg:block">Real Care, Inc. · Colorado</p>
      </MountainBand>
      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-navy">{title}</h1>
            {subtitle && <div className="mt-1.5 text-muted">{subtitle}</div>}
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
