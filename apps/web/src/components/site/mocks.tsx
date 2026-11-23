import { LogoMark } from "@/components/brand/Logo";

/// Static product illustrations built from real UI, so the marketing pages
/// show exactly what merchants and customers will see.

export function Money({ value, className = "" }: { value: number; className?: string }) {
  const [whole, cents] = value.toFixed(2).split(".");
  return (
    <span className={`tabular-nums ${className}`}>
      ${Number(whole).toLocaleString("en-US")}
      <sup className="ml-[1px] text-[0.55em] font-semibold opacity-70">.{cents}</sup>
    </span>
  );
}

export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative w-[230px] rounded-[2.2rem] bg-ink-900 p-2 shadow-lift ${className}`}>
      <div className="absolute left-1/2 top-3 h-4 w-20 -translate-x-1/2 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[1.8rem] bg-white">{children}</div>
    </div>
  );
}

export function PhoneConfirmMock() {
  return (
    <PhoneFrame>
      <div className="px-5 pb-6 pt-10 text-center">
        <div className="text-[11px] text-ink-500">Did you pay</div>
        <div className="mt-0.5 text-sm font-semibold text-ink-900">mamatiti.qie</div>
        <div className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">Trust score 742</div>
        <div className="mt-5 font-display text-3xl font-extrabold text-ink-900">₦15,000</div>
        <div className="text-[11px] text-ink-400">about $10.97</div>
        <div className="mt-5 rounded-full bg-brand py-2.5 text-xs font-semibold text-white shadow-glow">Yes, I paid</div>
        <div className="mt-2 text-[11px] font-medium text-ink-500">No, I didn&apos;t</div>
        <div className="mt-4 text-[9px] leading-4 text-ink-400">No app. No wallet. No fee.</div>
      </div>
    </PhoneFrame>
  );
}

export function ReceiptMock({ className = "" }: { className?: string }) {
  return (
    <div className={`w-[260px] rounded-2xl border border-ink-200/70 bg-white p-4 shadow-lift ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="text-xs font-semibold text-ink-900">Receipt #1,284</span>
        </div>
        <span className="rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-semibold text-mint-600">Confirmed</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold text-ink-900">
        <Money value={10.97} />
      </div>
      <div className="mt-3 space-y-1.5 text-[11px]">
        {[
          ["Shop", "mamatiti.qie"],
          ["Evidence", "Cash, customer-confirmed"],
          ["Block", "12,114,357"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-ink-400">{k}</span>
            <span className="font-medium text-ink-700">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PayMock() {
  return (
    <div className="w-[270px] rounded-2xl border border-ink-200/70 bg-white p-4 shadow-lift">
      <div className="text-[11px] text-ink-500">Paying</div>
      <div className="text-sm font-semibold text-ink-900">Kemi Fabrics</div>
      <div className="mt-3 rounded-xl border border-ink-200 px-3 py-2 font-display text-2xl font-bold text-ink-900">$24.00</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-ink-200 p-2">
          <div className="font-semibold">QUSDC</div>
          <div className="text-ink-400">Stablecoin</div>
        </div>
        <div className="rounded-lg border-2 border-violet-500 bg-violet-50 p-2">
          <div className="font-semibold text-violet-800">QIE</div>
          <div className="text-violet-600">via QIEDEX</div>
        </div>
      </div>
      <div className="mt-3 flex justify-between text-[11px] text-ink-500">
        <span>You pay about</span>
        <span className="font-mono text-ink-800">147.21 QIE</span>
      </div>
      <div className="mt-3 rounded-full bg-ink-900 py-2.5 text-center text-xs font-semibold text-white">Pay with QIE</div>
    </div>
  );
}

export function CapitalMock() {
  return (
    <div className="w-[290px] rounded-2xl border border-ink-200/70 bg-white p-4 shadow-lift">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-900">Working capital</span>
        <span className="rounded-full bg-electric-50 px-2 py-0.5 text-[10px] font-semibold text-electric-700">Repaying from sales</span>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">
        <Money value={61.8} />
      </div>
      <div className="text-[11px] text-ink-500">left of $206.00</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full w-[70%] rounded-full bg-brand" />
      </div>
      <div className="mt-3 space-y-1.5 text-[11px]">
        {[
          ["Auto from sale", "$4.20", "2m ago"],
          ["Auto from sale", "$2.50", "14m ago"],
          ["Auto from sale", "$7.10", "1h ago"],
        ].map(([a, b, c]) => (
          <div key={c} className="flex justify-between text-ink-500">
            <span>{a}</span>
            <span className="font-medium text-ink-800">{b}</span>
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatementMock() {
  return (
    <div className="w-[300px] rounded-2xl border border-ink-200/70 bg-white p-4 font-mono text-[10px] leading-5 text-ink-500 shadow-lift">
      <div className="mb-2 flex items-center justify-between font-sans">
        <span className="text-xs font-semibold text-ink-900">camt.053 statement</span>
        <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">ISO 20022</span>
      </div>
      <div>&lt;Ntry&gt;</div>
      <div className="pl-3">
        &lt;Amt Ccy=&quot;USD&quot;&gt;<span className="text-violet-700">24.00</span>&lt;/Amt&gt;
      </div>
      <div className="pl-3">
        &lt;Sts&gt;<span className="text-mint-600">BOOK</span>&lt;/Sts&gt;
      </div>
      <div className="pl-3">
        &lt;AcctSvcrRef&gt;<span className="text-electric-700">0x87a4…e860</span>&lt;/AcctSvcrRef&gt;
      </div>
      <div>&lt;/Ntry&gt;</div>
      <div className="mt-1 font-sans text-[10px] text-ink-400">Every line traces to a QIE transaction.</div>
    </div>
  );
}

export function ScoreMock() {
  const rows = [
    ["On-chain sales", 72],
    ["Distinct customers", 88],
    ["Returning customers", 64],
    ["Weekly consistency", 92],
  ] as const;
  return (
    <div className="w-[280px] rounded-2xl border border-ink-200/70 bg-white p-4 shadow-lift">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-brand text-lg font-bold text-white">742</div>
        <div>
          <div className="text-xs font-semibold text-ink-900">mamatiti.qie</div>
          <div className="text-[11px] text-ink-500">218 customers · 41% return</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, pct]) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] text-ink-500">
              <span>{label}</span>
              <span>{pct}%</span>
            </div>
            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerifyMock() {
  return (
    <div className="w-[290px] rounded-2xl border border-ink-200/70 bg-white p-4 text-[11px] shadow-lift">
      <div className="text-xs font-semibold text-ink-900">Verify this score</div>
      {[
        ["Inputs hash recomputed in your browser", "0x5c1e…a9f2"],
        ["Matches TrustScoreOracle checkpoint", "week 2,968"],
      ].map(([a, b]) => (
        <div key={a} className="mt-2 flex items-start gap-2 rounded-lg bg-canvas p-2">
          <span className="text-mint-600">✓</span>
          <div>
            <div className="text-ink-700">{a}</div>
            <div className="font-mono text-ink-400">{b}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalesChartMock() {
  const pts = [12, 18, 15, 22, 19, 27, 24, 31, 29, 35, 33, 41, 38, 46];
  const max = 50;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 300},${100 - (v / max) * 90}`).join(" L");
  return (
    <div className="w-full max-w-[520px] rounded-2xl border border-ink-200/70 bg-white p-5 shadow-lift">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-ink-500">Sales this month</div>
          <div className="mt-1 font-display text-3xl font-bold text-ink-900">
            <Money value={1284.5} />
          </div>
        </div>
        <div className="flex gap-3 text-[11px]">
          <span className="text-mint-600">▲ 18% vs last month</span>
        </div>
      </div>
      <svg viewBox="0 0 300 100" className="mt-4 h-28 w-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="salesfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity="0.28" />
            <stop offset="1" stopColor="#3d6bff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${d} L300,100 L0,100 Z`} fill="url(#salesfill)" />
        <path d={`M${d}`} fill="none" stroke="#6d4bff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-xs">
        <div>
          <div className="text-ink-500">Customers</div>
          <div className="font-semibold text-ink-900">218</div>
        </div>
        <div>
          <div className="text-ink-500">Settled</div>
          <div className="font-semibold text-ink-900">$842.10</div>
        </div>
        <div>
          <div className="text-ink-500">Cash confirmed</div>
          <div className="font-semibold text-ink-900">$442.40</div>
        </div>
      </div>
    </div>
  );
}

export function CodeMock() {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-[#0f1033] text-[12px] leading-6 shadow-lift ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-2 font-mono text-[11px] text-white/50">verify-score.ts</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-white/80">
        <span className="text-violet-300">const</span> proof = <span className="text-violet-300">await</span> fetch(
        <span className="text-emerald-300">&quot;/api/merchants/mamatiti.qie/score-proof&quot;</span>){"\n"}
        {"  "}.then((r) =&gt; r.json());{"\n\n"}
        <span className="text-white/40">{"// recompute the hash yourself"}</span>
        {"\n"}
        <span className="text-violet-300">const</span> hash = keccak256(toBytes(proof.canonical));{"\n\n"}
        <span className="text-white/40">{"// compare with the on-chain checkpoint"}</span>
        {"\n"}
        <span className="text-violet-300">const</span> [score, , , onChain] = <span className="text-violet-300">await</span> oracle.read.latestScore([merchant]);{"\n"}
        console.log(hash === onChain); <span className="text-white/40">{"// true"}</span>
      </pre>
    </div>
  );
}
