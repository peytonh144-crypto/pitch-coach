import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="w-full border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-6 px-5 py-16 sm:px-6 sm:py-24">
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
            For storm restoration roofing reps
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl md:text-6xl">
            AI practice and coaching for{" "}
            <span className="text-brand">storm restoration reps</span>
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            Run 100 fake doors before your next real one. Built by reps who&apos;ve
            actually been there.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/practice"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Try Practice Mode
            </Link>
            <Link
              href="/field"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-zinc-700 px-6 text-sm font-semibold text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              Use Field Mode
            </Link>
          </div>

          <div className="mt-2 max-w-2xl rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-400 sm:text-sm">
            <span className="font-semibold text-zinc-200">Sales manager?</span>{" "}
            Send this URL to your reps — each rep gets their own private
            practice history. Team dashboards coming soon.
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="w-full border-b border-zinc-900 bg-zinc-950">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <p className="text-sm text-zinc-400">
              Three tools, one goal: get you closing more inspections.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FeatureCard
              icon="🎯"
              title="Field Mode"
              body="Hear an objection at the door? Get an instant coaching response calibrated to the homeowner type. 8 personas, persona-tailored responses."
            />
            <FeatureCard
              icon="🥊"
              title="Practice Mode"
              body="Run a full door-knock conversation against an AI homeowner that stays in character. 5 scenarios, brutal but fair."
            />
            <FeatureCard
              icon="📊"
              title="Grading"
              body="Every practice session is reviewed by an AI sales trainer. Get specific feedback on what worked, where you lost ground, and exactly what to try next time."
            />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="w-full border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Who it&apos;s for
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CalloutBox
              eyebrow="For new reps"
              body="Ramp from “nervous on the porch” to “closes inspections” in weeks, not months. Practice every persona type before you ever knock."
            />
            <CalloutBox
              eyebrow="For sales managers"
              body="See exactly where each rep is losing deals. Review practice history, identify patterns, coach with data."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full border-b border-zinc-900">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-5 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for storm restoration. Free to try.
          </h2>
          <Link
            href="/practice"
            className="inline-flex h-12 items-center justify-center rounded-lg bg-brand px-8 text-base font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center px-5 py-8 sm:px-6">
          <p className="text-xs text-zinc-500">
            Pitch Coach · Built by reps, for reps · Made in Louisville, KY
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-6 transition-colors hover:border-zinc-700">
      <div className="text-3xl">{icon}</div>
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function CalloutBox({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">
        {eyebrow}
      </p>
      <p className="text-sm leading-relaxed text-zinc-300">{body}</p>
    </div>
  );
}
