import React, { useState, useEffect, useCallback, useRef, Component } from "react";
import { Circle } from "lucide-react";
import { SparklesCore } from "@/components/ui/sparkles";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { FaGithub } from "react-icons/fa";

// ==========================================
// ERROR BOUNDARY — wraps any crashy component
// ==========================================
class ComponentErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any, info: any) {
    console.warn("[CareerSense] Component crashed, using fallback:", err?.message, info?.componentStack?.split('\n')[1]);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

// ==========================================
// LOADING BAR HOOK
// ==========================================
function useLoadingBar() {
  const barRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let el = document.getElementById('cs-loading-bar') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'cs-loading-bar';
      document.body.prepend(el);
    }
    barRef.current = el;
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const start = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    el.classList.remove('cs-bar-complete');
    el.style.opacity = '1';
    el.style.width = '0%';
    // Fake progress: 0 → 15% → 45% → 72% → 88%
    const steps = [15, 45, 72, 88];
    const delays = [80, 600, 1800, 4000];
    steps.forEach((w, i) => {
      timerRef.current = setTimeout(() => { el.style.width = `${w}%`; }, delays[i]);
    });
  }, []);

  const finish = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    el.style.width = '98%';
    timerRef.current = setTimeout(() => {
      el.classList.add('cs-bar-complete');
      timerRef.current = setTimeout(() => {
        el.classList.remove('cs-bar-complete');
        el.style.width = '0%';
      }, 700);
    }, 200);
  }, []);

  const error = useCallback(() => {
    const el = barRef.current;
    if (!el) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    el.style.background = 'linear-gradient(90deg, #f43f5e, #fb7185)';
    el.style.width = '100%';
    timerRef.current = setTimeout(() => {
      el.classList.add('cs-bar-complete');
      timerRef.current = setTimeout(() => {
        el.classList.remove('cs-bar-complete');
        el.style.background = '';
        el.style.width = '0%';
      }, 700);
    }, 600);
  }, []);

  return { start, finish, error };
}

// ==========================================
// API CONFIGURATION
// ==========================================
const API_BASE = '';

// Maps backend AnalysisResult shape → frontend display shape
function adaptResult(raw: any) {
    if (!raw) return raw;
    const r = raw.result ?? raw; // handle both {result: ...} and flat shapes

    // Roadmap: backend uses phases array [{label, actionItems}]
    // Frontend expects {thirtyDays, threeMonths, sixMonths}
    let roadmap = r.roadmap;
    if (roadmap && Array.isArray(roadmap.phases)) {
        const phaseMap: any = {};
        roadmap.phases.forEach((p: any) => {
            if (p.label === '30 Days') phaseMap.thirtyDays = p;
            else if (p.label === '3 Months') phaseMap.threeMonths = p;
            else if (p.label === '6 Months') phaseMap.sixMonths = p;
        });
        roadmap = phaseMap;
    }

    // Strengths/Weaknesses: backend uses [{area, description}], frontend expects string[]
    const strengths = Array.isArray(r.strengths)
        ? r.strengths.map((s: any) => typeof s === 'string' ? s : `${s.area}: ${s.description}`)
        : r.strengths;
    const weaknesses = Array.isArray(r.weaknesses)
        ? r.weaknesses.map((w: any) => typeof w === 'string' ? w : `${w.area}: ${w.description}`)
        : r.weaknesses;

    // Profile optimization: backend uses {linkedin, github, portfolio} arrays
    const profileOptimization = r.profileOptimization
        ? {
            linkedIn: r.profileOptimization.linkedin
                ? Object.fromEntries(r.profileOptimization.linkedin.map((s: any, i: number) => [`Tip ${i + 1}`, s]))
                : {},
            github: r.profileOptimization.github
                ? Object.fromEntries(r.profileOptimization.github.map((s: any, i: number) => [`Tip ${i + 1}`, s]))
                : {},
            portfolio: r.profileOptimization.portfolio
                ? Object.fromEntries(r.profileOptimization.portfolio.map((s: any, i: number) => [`Tip ${i + 1}`, s]))
                : {},
        }
        : r.profileOptimization;

    return {
        resumeScore: r.resumeScore
            ? { ...r.resumeScore, overallScore: r.resumeScore.overall }
            : r.resumeScore,
        recruiterEyeView: r.heatmap,          // heatmap → recruiterEyeView
        strengths,
        weaknesses,
        topOnePercentComparison: r.top1Comparison,  // top1Comparison → topOnePercentComparison
        gapAnalysis: r.gapAnalysis,
        resumeImprovements: r.bulletImprovements,   // bulletImprovements → resumeImprovements
        roadmap,
        profileOptimization,
        finalVerdict: r.finalVerdict,
    };
}

const ERROR_MESSAGES: any = {
    400: "Please fill all required fields.",
    500: "Something went wrong during analysis.",
    502: "AI services are currently unavailable. Try again shortly.",
    503: "System is busy. Please try again in a moment.",
    504: "Request timed out. Please retry.",
};

// ==========================================
// SVG ICON COMPONENTS
// ==========================================
const Icon = ({ children, className = "w-5 h-5", ...props }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={className} {...props}>
        {children}
    </svg>
);

const BrandLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <linearGradient id="brand-logo-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#A5F3FC" />
                <stop offset="0.45" stopColor="#60A5FA" />
                <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
            <linearGradient id="brand-logo-dark-gradient" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0F172A" />
                <stop offset="1" stopColor="#1E3A8A" />
            </linearGradient>
        </defs>
        <path
            d="M12 2.75L19 5.55V11.4C19 16.18 16.21 20.37 12 22C7.79 20.37 5 16.18 5 11.4V5.55L12 2.75Z"
            fill="url(#brand-logo-gradient)"
            opacity="0.22"
        />
        <path
            d="M12 2.75L19 5.55V11.4C19 16.18 16.21 20.37 12 22C7.79 20.37 5 16.18 5 11.4V5.55L12 2.75Z"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M7.8 16.8C9.45 15.4 10.85 14.18 11.85 13.18C13.18 11.85 14.18 10.63 15.88 8.72"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M13.95 8.7H15.88V10.62"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <path
            d="M8.15 15.95H9.7V17.5H8.15V15.95Z"
            fill="url(#brand-logo-dark-gradient)"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="0.95"
        />
        <path
            d="M10.28 13.92H11.98V15.62H10.28V13.92Z"
            fill="url(#brand-logo-dark-gradient)"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="0.95"
        />
        <path
            d="M12.62 11.52H14.52V13.42H12.62V11.52Z"
            fill="url(#brand-logo-dark-gradient)"
            stroke="url(#brand-logo-gradient)"
            strokeWidth="0.95"
        />
        <circle cx="16.9" cy="7.15" r="1.2" fill="#DBEAFE" opacity="0.95" />
    </svg>
);

const Icons: any = {
    Spinner: ({ className }: any) => (
        <Icon className={className || "w-5 h-5 animate-spin"}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </Icon>
    ),
    Copy: () => (
        <Icon><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>
    ),
    Check: () => (
        <Icon><polyline points="20 6 9 17 4 12" /></Icon>
    ),
    CheckCircle: () => (
        <Icon><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></Icon>
    ),
    AlertTriangle: () => (
        <Icon><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Icon>
    ),
    XCircle: () => (
        <Icon><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></Icon>
    ),
    Target: ({ className }: any) => (
        <BrandLogo className={className} />
    ),
    Briefcase: () => (
        <Icon><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></Icon>
    ),
    TrendingUp: () => (
        <Icon><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Icon>
    ),
    Award: () => (
        <Icon><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></Icon>
    ),
    FileText: () => (
        <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></Icon>
    ),
    Eye: () => (
        <Icon><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icon>
    ),
    Zap: () => (
        <Icon><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Icon>
    ),
    BarChart: () => (
        <Icon><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></Icon>
    ),
    ArrowRight: () => (
        <Icon><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Icon>
    ),
    Shield: () => (
        <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Icon>
    ),
    Star: () => (
        <Icon><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Icon>
    ),
    Map: () => (
        <Icon><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></Icon>
    ),
    Lightbulb: () => (
        <Icon><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.41 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></Icon>
    ),
    Rocket: () => (
        <Icon><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></Icon>
    ),
    Globe: () => (
        <Icon><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Icon>
    ),
    Linkedin: () => (
        <Icon><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></Icon>
    ),
    Github: () => (
        <Icon><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></Icon>
    ),
    Layout: () => (
        <Icon><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></Icon>
    ),
    Clock: () => (
        <Icon><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></Icon>
    ),
    Calendar: () => (
        <Icon><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></Icon>
    ),
    ArrowLeft: () => (
        <Icon><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Icon>
    ),
    Trash: () => (
        <Icon><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></Icon>
    ),
    Layers: () => (
        <Icon><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Icon>
    ),
    Search: () => (
        <Icon><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>
    ),
    Activity: () => (
        <Icon><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Icon>
    ),
    AlertCircle: () => (
        <Icon><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Icon>
    ),
    ChevronRight: () => (
        <Icon className="w-4 h-4"><polyline points="9 18 15 12 9 6" /></Icon>
    ),
};

// ==========================================
// UTILITY COMPONENTS
// ==========================================

function ScoreCircle({ score, size = 140, strokeWidth = 8, label, trackClass = "text-white/10" }: any) {
    const radius = (size - strokeWidth * 2) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const center = size / 2;

    const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
    const ringColor = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#F43F5E';

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle cx={center} cy={center} r={radius} fill="none"
                        className={trackClass} strokeWidth={strokeWidth} />
                    <circle cx={center} cy={center} r={radius} fill="none"
                        stroke={ringColor} strokeWidth={strokeWidth}
                        strokeDasharray={circumference} strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1.5s ease-out' } as any} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-black ${scoreColor} tracking-tighter`}>{score}</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold">Score</span>
                </div>
            </div>
            {label && <span className="text-xs font-black uppercase tracking-widest text-white/50">{label}</span>}
        </div>
    );
}

function MiniScoreBar({ label, score }: any) {
    const barColor = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
    const textColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';

    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black uppercase tracking-widest text-white/40">{label}</span>
                <span className={`text-sm font-black ${textColor}`}>{score}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                <div className={`h-full rounded-full ${barColor} transition-all duration-1500 ease-out shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                    style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

function Badge({ variant = 'default', children, className = '' }: any) {
    const variants: any = {
        high: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        medium: 'bg-amber-100 text-amber-800 border-amber-200',
        low: 'bg-rose-100 text-rose-800 border-rose-200',
        critical: 'bg-rose-100 text-rose-800 border-rose-200',
        moderate: 'bg-amber-100 text-amber-800 border-amber-200',
        minor: 'bg-slate-100 text-slate-700 border-slate-200',
        default: 'bg-slate-100 text-slate-700 border-slate-200',
        success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        warning: 'bg-amber-100 text-amber-800 border-amber-200',
        danger: 'bg-rose-100 text-rose-800 border-rose-200',
        info: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[variant] || variants.default} ${className}`}>
            {children}
        </span>
    );
}

function SectionCard({ title, icon: IconComp, children, className = '', accent = 'indigo' }: any) {
    const accentColors: any = {
        indigo: 'from-indigo-500 to-indigo-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-400 to-amber-500',
        rose: 'from-rose-500 to-rose-600',
        slate: 'from-slate-500 to-slate-600',
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
    };

    return (
        <div className={`glass-card rounded-3xl overflow-hidden animate-fade-in ${className} bg-white/[0.02] border-white/5`}>
            <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 bg-white/[0.02] backdrop-blur-3xl">
                {IconComp && (
                    <div className={`flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br ${accentColors[accent] || accentColors.indigo} text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
                        <IconComp />
                    </div>
                )}
                <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
            </div>
            <div className="p-8">
                {children}
            </div>
        </div>
    );
}

function LoadingScreen({ message = "Analyzing your profile..." }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-12 organic-reveal bg-slate-950 px-6">
            <div className="relative">
                <div className="w-32 h-32 rounded-full border border-white/5 flex items-center justify-center relative overflow-hidden bg-white/[0.02] backdrop-blur-2xl">
                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-rose-500/20 animate-pulse"></div>
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 shadow-[0_0_30px_rgba(79,70,229,0.2)] flex items-center justify-center text-indigo-400">
                        <Icons.Target className="w-8 h-8 animate-pulse" />
                    </div>
                </div>
                {/* Orbital Rings */}
                <div className="absolute -inset-6 rounded-full border-t border-indigo-500/30 animate-spin" style={{ animationDuration: '3s' }}></div>
                <div className="absolute -inset-12 rounded-full border-b border-rose-500/20 animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }}></div>
            </div>
            <div className="text-center space-y-4">
                <h3 className="text-2xl font-black text-white tracking-[0.2em] uppercase">{message}</h3>
                <div className="flex justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '200ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: '400ms' }}></span>
                </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20 animate-pulse mt-8">Decrypting Career Sequences</p>
        </div>
    );
}

function ErrorAlert({ message, onRetry, onGoBack }: any) {
    return (
        <div className="min-h-screen flex items-center justify-center px-6 bg-slate-950">
            <div className="max-w-md w-full animate-fade-in">
                <div className="glass-card rounded-[2.5rem] p-10 text-center border-rose-500/20 bg-rose-500/[0.02]">
                    <div className="w-20 h-20 bg-rose-500/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
                        <Icons.AlertTriangle className="text-rose-500 w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-widest">Protocol Failure</h3>
                    <p className="text-white/40 mb-10 font-light leading-relaxed">{message}</p>
                    <div className="flex flex-col gap-4">
                        {onRetry && (
                            <button onClick={onRetry}
                                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                                Retry Sequence
                            </button>
                        )}
                        {onGoBack && (
                            <button onClick={onGoBack}
                                className="w-full py-4 bg-white/5 text-white/60 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 border border-white/10 transition-all">
                                Abort & Restart
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// SUBMIT VIEW
// ==========================================

function SubmitView({ onSessionCreated, onViewHistory }: any) {
    const [resume, setResume] = useState('');
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [targetRole, setTargetRole] = useState('');
    const [targetCompanies, setTargetCompanies] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState('Analysing Sequence...');
    const bar = useLoadingBar();
    const statusTimers = useRef<any[]>([]);

    const DeepAnalysisLoader = () => (
        <span className="relative inline-flex h-6 w-6 items-center justify-center will-change-transform">
            <span className="absolute h-6 w-6 rounded-full border border-cyan-300/35 animate-[spin_1.1s_linear_infinite]" />
            <span className="absolute h-4 w-4 rounded-full border border-indigo-300/45 animate-[spin_1.8s_linear_infinite_reverse]" />
            <span className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.8)] animate-pulse" />
            <span className="absolute left-[2px] top-1/2 -translate-y-1/2 h-1 w-1 rounded-full bg-violet-300 animate-[spin_1.1s_linear_infinite] origin-[10px_50%]" />
        </span>
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if ((!resume.trim() && !resumeFile) || !targetRole.trim()) {
            setError("Please upload your resume and specify the target role.");
            return;
        }

        const companies = targetCompanies
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);

        setLoading(true);
        setStatusMsg('Uploading Resume...');
        bar.start();

        // Cascade status messages so the user knows work is happening
        const msgs = [
            [3000,  'Extracting Text...'],
            [8000,  'Selecting AI Engine...'],
            [15000, 'Running Deep Analysis...'],
            [30000, 'Still working — switching models if needed...'],
            [50000, 'Almost there — finalising results...'],
        ];
        statusTimers.current = msgs.map(([delay, msg]) =>
            setTimeout(() => setStatusMsg(msg as string), delay as number)
        );

        const formData = new FormData();
        if (resumeFile) {
            formData.append('resumeFile', resumeFile);
        } else {
            formData.append('resume', resume);
        }
        formData.append('targetRole', targetRole);
        formData.append('targetCompanies', JSON.stringify(companies));

        try {
            const response = await fetch(`${API_BASE}/api/sessions`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const msg = ERROR_MESSAGES[response.status] || ERROR_MESSAGES[500];
                throw new Error(msg);
            }

            const data = await response.json();
            bar.finish();
            onSessionCreated(data.sessionId);
        } catch (err: any) {
            bar.error();
            if (err.message && Object.values(ERROR_MESSAGES).includes(err.message)) {
                setError(err.message);
            } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setError("Unable to connect to the server. Please check your connection.");
            } else {
                setError(err.message || ERROR_MESSAGES[500]);
            }
        } finally {
            setLoading(false);
            setStatusMsg('Analysing Sequence...');
            statusTimers.current.forEach(clearTimeout);
            statusTimers.current = [];
        }
    };

    const formRef = useRef<HTMLDivElement>(null);

    const handleScrollToForm = () => {
        formRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        setTimeout(() => {
            const reveals = document.querySelectorAll('.reveal');
            reveals.forEach(el => observer.observe(el));
        }, 100);

        return () => observer.disconnect();
    }, []);

    return (
        <div className="w-full">
            {/* ─── Hero with premium components, safely wrapped ─── */}
            <ComponentErrorBoundary fallback={
                <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#030303]">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vh] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" style={{animationDuration:'6s'}} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center text-center px-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mb-10">
                            <Circle className="h-1.5 w-1.5 fill-indigo-500 text-indigo-500" /> AI Career Analysis
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-6">
                            <span className="block text-white/90">Career</span>
                            <span className="block bg-clip-text text-transparent" style={{backgroundImage:'linear-gradient(135deg,#818cf8 0%,#c4b5fd 50%,#f0abfc 100%)'}}>Intelligence.</span>
                        </h1>
                    </div>
                </div>
            }>
                <HeroGeometric badge="AI Career Analysis" title1="Career" title2="Intelligence.">
                    <div className="relative w-full max-w-4xl mx-auto">
                        <ComponentErrorBoundary fallback={null}>
                            <div className="absolute inset-0 -top-128 -bottom-128 -left-128 -right-128 opacity-50 pointer-events-none">
                                <SparklesCore
                                    background="transparent"
                                    minSize={0.4}
                                    maxSize={1.4}
                                    particleDensity={100}
                                    className="w-full h-full"
                                    particleColor="#818CF8"
                                    speed={0.5}
                                />
                            </div>
                        </ComponentErrorBoundary>
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-2 bg-indigo-500/30 blur-2xl animate-pulse" />
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 blur-xl animate-pulse" />
                        <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto font-light leading-relaxed mb-12 relative z-10">
                            Immerse yourself in a data-driven professional analysis. We decode your experience to build your ultimate career roadmap.
                        </p>
                    </div>
                </HeroGeometric>
            </ComponentErrorBoundary>

            {/* Form Section */}
            <div ref={formRef} className="min-h-screen flex items-center justify-center px-4 py-24 bg-slate-950 border-t border-white/10 reveal relative">
                {/* Ambient Glows for Form Section */}
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[30rem] h-[30rem] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-rose-500/5 rounded-full blur-[150px] pointer-events-none" />

                <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-16 items-center relative z-10">
                    {/* Context Text */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-bold uppercase tracking-[0.2em]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            System Ready
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
                            Input Profile<br />Data.
                        </h2>
                        <p className="text-white/50 text-xl font-light leading-relaxed">
                            Provide your raw resume and target parameters. Our engines will compute the optimal path forward.
                        </p>

                        {/* Theme Track Icons */}
                        <div className="flex flex-wrap gap-4 pt-4">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl shadow-sm group hover:border-indigo-500/50 transition-all cursor-help" title="Engineering Optimization">
                                <div className="text-engineering group-hover:scale-110 transition-transform"><Icons.Zap /></div>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl shadow-sm group hover:border-roadmap/50 transition-all cursor-help" title="Career Roadmap">
                                <div className="text-roadmap group-hover:scale-110 transition-transform"><Icons.Map /></div>
                            </div>
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl shadow-sm group hover:border-candidate/50 transition-all cursor-help" title="Candidate Score">
                                <div className="text-candidate group-hover:scale-110 transition-transform"><Icons.Award /></div>
                            </div>
                            <button 
                                onClick={onViewHistory}
                                className="flex items-center gap-3 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl group hover:bg-white/10 hover:border-indigo-500/50 transition-all cursor-pointer"
                            >
                                <div className="text-indigo-400 group-hover:scale-110 transition-transform"><Icons.Clock /></div>
                                <span className="text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">Watch Past Results</span>
                            </button>
                        </div>
                    </div>

                    {/* Form Card */}
                    <div className="lg:col-span-3">
                        <div className="glass-card rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden bg-white/[0.03] border-white/10">
                            {/* Lightweight CSS glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />
                            <ComponentErrorBoundary fallback={null}>
                                <div className="absolute inset-0 z-0 h-full w-full pointer-events-none">
                                    <SparklesCore
                                        background="transparent"
                                        minSize={0.6}
                                        maxSize={1.4}
                                        particleDensity={30}
                                        className="w-full h-full"
                                        particleColor="#818CF8"
                                        speed={0.8}
                                    />
                                </div>
                            </ComponentErrorBoundary>

                            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                                {/* Resume Input */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 mb-3">
                                        Resume Analysis Protocol <span className="text-rose-500">*</span>
                                    </label>
                                    
                                    <div 
                                        onClick={() => document.getElementById('resume-upload')?.click()}
                                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500/50', 'bg-indigo-500/5'); }}
                                        onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-indigo-500/50', 'bg-indigo-500/5'); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.currentTarget.classList.remove('border-indigo-500/50', 'bg-indigo-500/5');
                                            const file = e.dataTransfer.files[0];
                                            if (file) setResumeFile(file);
                                        }}
                                        className={`w-full h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-6 cursor-pointer transition-all duration-500 group relative overflow-hidden ${
                                            resumeFile 
                                                ? 'border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
                                                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                                        }`}
                                    >
                                        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.1),transparent_70%)]" />
                                        
                                        <input 
                                            id="resume-upload"
                                            type="file" 
                                            accept=".pdf,.png,.jpg,.jpeg" 
                                            className="hidden" 
                                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                        />

                                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${
                                            resumeFile ? 'bg-emerald-500/20 text-emerald-400 scale-110' : 'bg-white/5 text-white/40 group-hover:scale-110 group-hover:text-white/60'
                                        }`}>
                                            {resumeFile ? <Icons.CheckCircle /> : <Icons.FileText />}
                                        </div>

                                        <div className="text-center space-y-2 relative z-10">
                                            <p className={`text-sm font-black uppercase tracking-widest ${resumeFile ? 'text-emerald-400' : 'text-white'}`}>
                                                {resumeFile ? resumeFile.name : 'Initiate File Upload'}
                                            </p>
                                            <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em]">
                                                {resumeFile ? `${(resumeFile.size / 1024 / 1024).toFixed(2)} MB — Ready for Analysis` : 'Drop PDF or Image (PNG/JPG) here'}
                                            </p>
                                        </div>

                                        {resumeFile && (
                                            <button 
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setResumeFile(null); }}
                                                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-rose-500/20 text-white/20 hover:text-rose-500 rounded-lg transition-all"
                                            >
                                                <Icons.XCircle />
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-4 text-[10px] uppercase tracking-widest text-white/20 font-black flex items-center gap-2">
                                        <Icons.Shield className="w-3 h-3" /> Secure OCR Encryption Enabled
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Target Role */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 mb-3">
                                            Target Role <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={targetRole}
                                            onChange={(e) => setTargetRole(e.target.value)}
                                            placeholder="e.g. Senior Frontend Engineer"
                                            className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                                            disabled={loading}
                                        />
                                    </div>

                                    {/* Target Companies */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 mb-3">
                                            Target Companies
                                        </label>
                                        <input
                                            type="text"
                                            value={targetCompanies}
                                            onChange={(e) => setTargetCompanies(e.target.value)}
                                            placeholder="e.g. Google, Meta"
                                            className="w-full px-5 py-3.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl animate-slide-up">
                                        <div className="text-rose-500 flex-shrink-0"><Icons.AlertCircle /></div>
                                        <p className="text-sm text-rose-200">{error}</p>
                                    </div>
                                )}

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-4 px-8 rounded-xl font-bold text-white text-base transition-all duration-300 active:scale-[0.98] ${loading
                                        ? 'cursor-not-allowed bg-gradient-to-r from-indigo-600/70 via-blue-600/70 to-cyan-600/70 shadow-[0_0_35px_rgba(59,130,246,0.35)]'
                                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]'
                                        }`}
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-3">
                                            <DeepAnalysisLoader />
                                            <span className="inline-flex items-center gap-2">
                                                <span className="tracking-wide">{statusMsg}</span>
                                                <span className="inline-flex gap-1">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80 animate-bounce [animation-delay:-0.3s]" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80 animate-bounce [animation-delay:-0.15s]" />
                                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-200/80 animate-bounce" />
                                                </span>
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-3">
                                            <Icons.Rocket className="w-5 h-5" />
                                            Initiate Deep Analysis
                                        </span>
                                    )}
                                </button>
                            </form>
                            <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 mt-8 font-white">
                            Security Protocol Active — Privacy Guaranteed
                        </p>
                        </div>
                        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-white/20 mt-8 font-black">
  Made By: Team HireSense
</p>

<p className="text-center text-[10px] uppercase tracking-[0.2em] mt-1 font-black">
  Developed By:{" "}
  <a
    href="https://github.com/Uchiha-Byte"
    target="_blank"
    rel="noopener noreferrer"
    className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 transition"
  >
    <Icons.Github className="text-[12px]" />
    Uchiha-Byte
  </a>
</p>




                    </div>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// RESULT VIEW SECTIONS
// ==========================================

function ResumeScoreSection({ data }: any) {
    if (!data) return null;
    const overallScore = data.overallScore ?? data.overall ?? 0;
    const breakdown = data.breakdown || {};
    const rationale = data.rationale || [];
    const highRiskFlag = data.highRiskFlag;

    return (
        <SectionCard title="Resume Score" icon={Icons.Award} accent="indigo">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                <div className="flex-shrink-0">
                    <ScoreCircle score={overallScore} size={160} label="Overall Score" />
                </div>
                <div className="flex-1 w-full space-y-4">
                    {highRiskFlag && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 font-medium flex items-center gap-2">
                            <Icons.AlertTriangle /> High ATS rejection risk
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <MiniScoreBar label="Keyword Match" score={breakdown.keywordMatch || 0} />
                        <MiniScoreBar label="Formatting" score={breakdown.formatting || 0} />
                        <MiniScoreBar label="Readability" score={breakdown.readability || 0} />
                        <MiniScoreBar label="Structure" score={breakdown.structure || 0} />
                    </div>
                    {rationale.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-white/5">
                            <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">Analysis Rationale</h4>
                            <ul className="space-y-3">
                                {rationale.map((r: any, i: number) => (
                                    <li key={i} className="flex items-start gap-3 text-sm text-white/60 leading-relaxed font-light">
                                        <span className="text-indigo-400 mt-0.5 flex-shrink-0"><Icons.Check /></span>
                                        {r}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </SectionCard>
    );
}

function RecruiterEyeViewSection({ data }: any) {
    if (!data) return null;
    const { sections, missingSections } = data;
    const attentionColors: any = { high: 'high', medium: 'medium', low: 'low' };

    return (
        <SectionCard title="Recruiter Eye View" icon={Icons.Eye} accent="purple">
            {sections && sections.length > 0 && (
                <div className="grid grid-cols-1 gap-4 mb-8">
                    {sections.map((sec: any, i: number) => (
                        <div key={i} className="flex items-start gap-5 p-5 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/[0.05] transition-colors">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="font-bold text-white tracking-tight">{sec.name}</span>
                                    <Badge variant={attentionColors[sec.attention] || 'default'}>
                                        {sec.attention}
                                    </Badge>
                                </div>
                                <p className="text-sm text-white/50 font-light leading-relaxed">{sec.explanation}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {missingSections && missingSections.length > 0 && (
                <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-amber-400"><Icons.AlertTriangle /></span>
                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-400/80">Critical Gaps</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {missingSections.map((ms: any, i: number) => (
                            <Badge key={i} variant="warning" className="bg-amber-500/10 text-amber-200 border-amber-500/30">{ms}</Badge>
                        ))}
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

function StrengthsSection({ data }: any) {
    if (!data || !data.length) return null;
    return (
        <SectionCard title="Strengths" icon={Icons.TrendingUp} accent="emerald">
            <ul className="grid grid-cols-1 gap-3">
                {data.map((s: any, i: number) => (
                    <li key={i} className="flex items-start gap-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-sm text-white/70 font-light leading-relaxed">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0"><Icons.CheckCircle /></span>
                        {s}
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

function WeaknessesSection({ data }: any) {
    if (!data || !data.length) return null;
    return (
        <SectionCard title="Weaknesses" icon={Icons.AlertTriangle} accent="rose">
            <ul className="grid grid-cols-1 gap-3">
                {data.map((w: any, i: number) => (
                    <li key={i} className="flex items-start gap-4 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl text-sm text-white/70 font-light leading-relaxed">
                        <span className="text-rose-400 mt-0.5 flex-shrink-0"><Icons.XCircle /></span>
                        {w}
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}

function TopOnePercentSection({ data }: any) {
    if (!data) return null;
    const { missingSkills, experienceGaps, projectQualityDifferences, presentationDifferences } = data;

    const subSections = [
        { label: 'Missing Skills', items: missingSkills, icon: Icons.Target, color: 'rose' },
        { label: 'Experience Gaps', items: experienceGaps, icon: Icons.Briefcase, color: 'amber' },
        { label: 'Project Quality Differences', items: projectQualityDifferences, icon: Icons.Layers, color: 'purple' },
        { label: 'Presentation Differences', items: presentationDifferences, icon: Icons.Layout, color: 'blue' },
    ];

    return (
        <SectionCard title="Top 1% Comparison" icon={Icons.Star} accent="amber">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {subSections.map((sec: any, i: number) => (
                    <div key={i} className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 shadow-sm">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-5 flex items-center gap-3">
                            <span className="p-2 bg-white/5 rounded-lg">
                                {(() => {
                                    const IconComp = sec.icon;
                                    return <IconComp className="w-4 h-4" />;
                                })()}
                            </span>
                            {sec.label}
                        </h4>
                        {sec.items && sec.items.length > 0 ? (
                            <ul className="space-y-3">
                                {sec.items.map((item: any, j: number) => (
                                    <li key={j} className="flex items-start gap-3 text-sm text-white/60 font-light leading-relaxed">
                                        <span className="text-indigo-500/50 mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-current" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-white/20 italic font-medium">Clearance Verified — No Gaps Found</p>
                        )}
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

function GapAnalysisSection({ data }: any) {
    if (!data) return null;
    const { readinessPercentage, gaps, notCompetitiveNote } = data;
    const severityMap: any = { critical: 'critical', moderate: 'moderate', minor: 'minor' };

    return (
        <SectionCard title="Gap Analysis" icon={Icons.Activity} accent="rose">
            <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start mb-6">
                <ScoreCircle score={readinessPercentage || 0} size={130} label="Readiness" />
                <div className="flex-1 w-full">
                    <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-5">Vulnerability Map</h4>
                    {gaps && gaps.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {gaps.map((gap: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                    <span className="flex-1 text-sm text-white/70 font-medium">{gap.label}</span>
                                    <Badge variant={severityMap[gap.severity] || 'default'}>{gap.severity}</Badge>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-white/30 italic">Target Parameters Secured — No Gaps Found</p>
                    )}
                </div>
            </div>
            {notCompetitiveNote && (
                <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4 mt-8">
                    <span className="text-rose-400 mt-0.5 flex-shrink-0"><Icons.AlertTriangle /></span>
                    <p className="text-sm text-rose-200/80 leading-relaxed font-medium">{notCompetitiveNote}</p>
                </div>
            )}
        </SectionCard>
    );
}

function ResumeImprovementsSection({ data }: any) {
    if (!data || !data.length) return null;
    return (
        <SectionCard title="Resume Improvements" icon={Icons.FileText} accent="blue">
            <div className="grid grid-cols-1 gap-6">
                {data.map((item: any, i: number) => (
                    <div key={i} className="rounded-2xl border border-white/5 overflow-hidden bg-white/[0.02] shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2">
                            <div className="p-6 bg-rose-500/[0.03] border-r border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge variant="danger" className="text-[10px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border-none">Legacy Block</Badge>
                                </div>
                                <p className="text-sm text-white/50 font-light leading-relaxed">{item.original}</p>
                            </div>
                            <div className="p-6 bg-emerald-500/[0.03]">
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge variant="success" className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border-none">Optimized Sequence</Badge>
                                </div>
                                <p className="text-sm text-white/80 font-medium leading-relaxed">{item.rewritten}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </SectionCard>
    );
}

function RoadmapSection({ data }: any) {
    if (!data) return null;
    const columns = [
        { key: 'thirtyDays', label: '30 Days', icon: Icons.Clock, color: 'emerald', headerBg: 'from-emerald-500/20 to-emerald-600/20', text: 'text-emerald-400' },
        { key: 'threeMonths', label: '3 Months', icon: Icons.Calendar, color: 'amber', headerBg: 'from-amber-500/20 to-amber-600/20', text: 'text-amber-400' },
        { key: 'sixMonths', label: '6 Months', icon: Icons.Map, color: 'purple', headerBg: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-400' },
    ];

    return (
        <SectionCard title="Roadmap" icon={Icons.Map} accent="indigo">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {columns.map((col: any) => {
                    const items = data[col.key]?.actionItems || [];
                    return (
                        <div key={col.key} className="rounded-2xl border border-white/5 overflow-hidden bg-white/[0.01]">
                            <div className={`px-5 py-4 bg-gradient-to-r ${col.headerBg} border-b border-white/5 flex items-center gap-3`}>
                                {(() => {
                                    const IconComp = col.icon;
                                    return <IconComp className={`w-4 h-4 ${col.text}`} />;
                                })()}
                                <span className="text-xs font-black uppercase tracking-widest text-white/80">{col.label}</span>
                            </div>
                            <div className="p-5 space-y-3">
                                {items.length > 0 ? items.map((item: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-colors">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black text-white/30 group-hover:text-white/60 transition-colors">
                                            {(i + 1).toString().padStart(2, '0')}
                                        </span>
                                        <p className="text-sm text-white/50 leading-relaxed font-light">{item}</p>
                                    </div>
                                )) : (
                                    <p className="text-xs text-white/20 italic font-medium px-2">Mission Parameters Pending</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

function ProfileOptimizationSection({ data }: any) {
    if (!data) return null;
    const profiles = [
        { key: 'linkedIn', label: 'LinkedIn', icon: Icons.Linkedin, color: 'blue', gradient: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400' },
        { key: 'github', label: 'GitHub', icon: Icons.Github, color: 'slate', gradient: 'from-slate-500/20 to-slate-600/20', text: 'text-slate-400' },
        { key: 'portfolio', label: 'Portfolio', icon: Icons.Globe, color: 'purple', gradient: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-400' },
    ];

    return (
        <SectionCard title="Profile Optimization" icon={Icons.Layers} accent="blue">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {profiles.map((prof: any) => {
                    const profData = data[prof.key];
                    return (
                        <div key={prof.key} className="rounded-2xl border border-white/5 overflow-hidden bg-white/[0.01]">
                            <div className={`px-5 py-4 bg-gradient-to-r ${prof.gradient} border-b border-white/5 flex items-center gap-3`}>
                                {(() => {
                                    const IconComp = prof.icon;
                                    return <IconComp className={`w-4 h-4 ${prof.text}`} />;
                                })()}
                                <span className="text-xs font-black uppercase tracking-widest text-white/80">{prof.label}</span>
                            </div>
                            <div className="p-5 space-y-3">
                                {profData && typeof profData === 'object' ? (
                                    Object.entries(profData).map(([key, value], i: number) => (
                                        <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">
                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                                            </p>
                                            <p className="text-sm text-white/60 font-light leading-relaxed">{String(value)}</p>
                                        </div>
                                    ))
                                ) : profData ? (
                                    <p className="text-sm text-white/50 px-2 leading-relaxed">{String(profData)}</p>
                                ) : (
                                    <p className="text-xs text-white/20 italic font-medium px-2">Data Stream Offline</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </SectionCard>
    );
}

function FinalVerdictSection({ data }: any) {
    if (!data) return null;
    const { readinessPercentage, readinessLabel, rejectionReasons, stepsToTopTier } = data;
    const labelColors: any = { 'Ready': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', 'Almost Ready': 'bg-blue-500/20 text-blue-400 border-blue-500/30', 'Needs Work': 'bg-amber-500/20 text-amber-400 border-amber-500/30', 'Not Ready': 'bg-rose-500/20 text-rose-400 border-rose-500/30' };

    return (
        <SectionCard title="Final Verdict" icon={Icons.Shield} accent="indigo">
            <div className="flex flex-col lg:flex-row gap-12 items-start mb-12">
                <div className="flex-shrink-0">
                    <ScoreCircle score={readinessPercentage || 0} size={180} label="Clearance Level" />
                </div>
                <div className="flex-1 w-full space-y-8">
                    {readinessLabel && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Current Assessment</h4>
                            <div className="flex items-center">
                                <span className={`text-sm px-6 py-2 rounded-full font-black uppercase tracking-widest border transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] ${labelColors[readinessLabel] || 'bg-white/5 text-white/50 border-white/10'}`}>
                                    {readinessLabel}
                                </span>
                            </div>
                        </div>
                    )}
                    {rejectionReasons && rejectionReasons.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400/50 flex items-center gap-2">
                                <Icons.AlertCircle className="w-4 h-4" />
                                Critical Vulnerabilities
                            </h4>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {rejectionReasons.map((r: any, i: number) => (
                                    <li key={i} className="flex items-start gap-4 p-4 bg-rose-500/[0.03] border border-rose-500/10 rounded-2xl group hover:border-rose-500/30 transition-all">
                                        <span className="text-rose-500/40 mt-1 flex-shrink-0"><Icons.ChevronRight className="w-3 h-3" /></span>
                                        <span className="text-sm text-rose-200/60 font-light leading-relaxed group-hover:text-rose-200 transition-colors">{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
            {stepsToTopTier && stepsToTopTier.length > 0 && (
                <div className="p-8 bg-indigo-500/[0.03] border border-indigo-500/20 rounded-[2.5rem] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />

                    <h4 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400/80 mb-8 flex items-center gap-4 relative z-10">
                        <Icons.Rocket className="w-5 h-5" />
                        Ascension Protocol
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        {stepsToTopTier.map((step: any, i: number) => (
                            <div key={i} className="flex items-start gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] transition-all group/item">
                                <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-500/10 group-hover/item:scale-110 transition-transform">
                                    {(i + 1).toString().padStart(2, '0')}
                                </span>
                                <p className="text-sm text-white/50 leading-relaxed font-light group-hover/item:text-white/80 transition-colors">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </SectionCard>
    );
}

function ResultView({ sessionId, onGoBack }: any) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [status, setStatus] = useState('loading');
    const pollRef = useRef<any>(null);
    const bar = useLoadingBar();

    useEffect(() => {
        if (loading || !data) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        setTimeout(() => {
            const reveals = document.querySelectorAll('.reveal');
            reveals.forEach(el => observer.observe(el));
        }, 100);

        return () => observer.disconnect();
    }, [data, loading]);

    const fetchSession = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
            if (response.status === 404) {
                bar.error();
                setError("Session not found. Please submit again.");
                setLoading(false);
                return;
            }
            if (!response.ok) {
                const msg = ERROR_MESSAGES[response.status] || ERROR_MESSAGES[500];
                throw new Error(msg);
            }
            const result = await response.json();
            if (result.status === 'processing' || result.status === 'pending') {
                setStatus('processing');
                return;
            }
            if (result.status === 'error') {
                bar.error();
                setError(result.error || "Analysis failed during processing.");
                setLoading(false);
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                return;
            }
            bar.finish();
            setData(adaptResult(result));
            setStatus('completed');
            setLoading(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } catch (err: any) {
            bar.error();
            setError(err.message || ERROR_MESSAGES[500]);
            setLoading(false);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
    }, [sessionId]);

    useEffect(() => {
        bar.start();
        fetchSession();
        pollRef.current = setInterval(() => {
            if (status === 'processing' || status === 'loading') {
                fetchSession();
            }
        }, 3000);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchSession, status]);

    const handleCopyId = async () => {
        try {
            await navigator.clipboard.writeText(sessionId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = sessionId;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (loading) {
        return <LoadingScreen message={status === 'processing' ? "AI is analyzing your resume..." : "Loading results..."} />;
    }

    if (error) {
        return <ErrorAlert message={error} onRetry={fetchSession} onGoBack={onGoBack} />;
    }

    if (!data) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 organic-reveal relative z-10">
            {/* Ambient Background Glow for Results */}
            <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-indigo-500/5 rounded-full blur-[150px] -z-10" />
            <div className="absolute bottom-1/4 left-1/4 w-[30rem] h-[30rem] bg-purple-500/5 rounded-full blur-[120px] -z-10" />

            <div className="mb-16">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                            <Circle className="h-1.5 w-1.5 fill-indigo-500" />
                            Final Analysis Protocol
                        </div>
                        <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">Profile Intelligence.</h2>
                        <p className="text-lg text-white/30 font-light max-w-2xl">
                            Session <span className="font-mono text-indigo-400 font-bold bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 ml-2">{sessionId}</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <button onClick={handleCopyId}
                            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${copied
                                ? 'bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                                }`}>
                            {copied ? <><Icons.Check /> Sequence Copied</> : <><Icons.Copy /> Copy ID</>}
                        </button>
                        <button onClick={onGoBack}
                            className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                            <Icons.ArrowLeft /> New Sequence
                        </button>
                    </div>
                </div>
            </div>
            <div className="space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 reveal">
                    <ResumeScoreSection data={data.resumeScore} />
                    <RecruiterEyeViewSection data={data.recruiterEyeView} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 reveal">
                    <StrengthsSection data={data.strengths} />
                    <WeaknessesSection data={data.weaknesses} />
                </div>
                <div className="reveal relative">
                    <TopOnePercentSection data={data.topOnePercentComparison} />
                </div>
                <div className="reveal"><GapAnalysisSection data={data.gapAnalysis} /></div>
                <div className="reveal"><ResumeImprovementsSection data={data.resumeImprovements} /></div>
                <div className="reveal"><RoadmapSection data={data.roadmap} /></div>
                <div className="reveal"><ProfileOptimizationSection data={data.profileOptimization} /></div>
                <div className="reveal"><FinalVerdictSection data={data.finalVerdict} /></div>
            </div>
        </div>
    );
}

function HistoryView({ onSelectSession, onGoBack }: any) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [searchId, setSearchId] = useState('');
    const [statusFilter, setStatusFilter] = useState<'complete' | 'error' | 'pending'>('complete');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/sessions`);
                if (!response.ok) throw new Error("Failed to fetch history");
                const data = await response.json();
                setSessions(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, []);

    useEffect(() => {
        if (loading || sessions.length === 0) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        // Small delay to ensure DOM is ready
        const t = setTimeout(() => {
            const reveals = document.querySelectorAll('.reveal');
            reveals.forEach(el => observer.observe(el));
        }, 100);

        return () => {
            clearTimeout(t);
            observer.disconnect();
        };
    }, [sessions, loading]);

    const filteredSessions = sessions.filter(s => {
        const matchesSearch = s.targetRole.toLowerCase().includes(searchId.toLowerCase()) || 
                             s.id.toLowerCase().includes(searchId.toLowerCase());
        const matchesStatus = s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) return <LoadingScreen message="Retrieving History..." />;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 organic-reveal relative z-10">
            <div className="absolute top-0 right-0 w-[50rem] h-[50rem] bg-indigo-500/5 rounded-full blur-[150px] -z-10" />
            
            <div className="mb-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                        <Icons.Clock className="h-3 w-3" />
                        Historical Records
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter">Past Analysis.</h2>
                    <p className="text-lg text-white/30 font-light max-w-2xl">
                        Review your previously computed career intelligence sequences.
                    </p>
                </div>
                <button onClick={onGoBack}
                    className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white/70 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                    <Icons.ArrowLeft /> Back to Home
                </button>
            </div>

            {/* Search and Tabs */}
            <div className="mb-12 space-y-8 reveal">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="relative flex-1 max-w-2xl">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20">
                            <Icons.Search className="w-4 h-4" />
                        </div>
                        <input 
                            type="text"
                            placeholder="Filter by ID or Role..."
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-light"
                        />
                    </div>
                    
                    <div className="flex items-center p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl self-start">
                        {(['complete', 'pending', 'error'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                                    statusFilter === status 
                                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                    : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error ? (
                <div className="glass-card rounded-3xl p-12 text-center border-rose-500/20 bg-rose-500/[0.02]">
                    <p className="text-rose-400 font-medium">{error}</p>
                </div>
            ) : filteredSessions.length === 0 ? (
                <div className="glass-card rounded-[3rem] p-24 text-center border-white/5 bg-white/[0.02]">
                    <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/10 opacity-20">
                        <Icons.FileText className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-white/20 uppercase tracking-widest">No Sequences Found</h3>
                    <p className="text-white/10 mt-2">Try a different ID or role search term</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 reveal">
                    {filteredSessions.map((session) => (
                        <div 
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            className="glass-card group rounded-[2rem] p-8 border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-indigo-500/30 transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute top-1/2 -right-4 p-6 opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none">
                                <Icons.ArrowRight className="text-indigo-400 w-8 h-8" />
                            </div>
                            
                            <div className="space-y-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <BrandLogo className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Target Role</p>
                                        <h4 className="text-white font-bold truncate group-hover:text-indigo-300 transition-colors">{session.targetRole}</h4>
                                    </div>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                                        <span>Status</span>
                                        <span className={session.status === 'complete' ? 'text-emerald-400' : session.status === 'error' ? 'text-rose-400' : 'text-amber-400'}>
                                            {session.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-white/40 font-light">
                                            {new Date(session.createdAt * 1000).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                        {session.result?.resumeScore?.overall && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                <span className="text-sm font-black text-white">{session.result.resumeScore.overall}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-white/10 uppercase tracking-widest">SID: {session.id.slice(0, 8)}...</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/0 group-hover:text-indigo-400 transition-all">Open Report →</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function App() {
    const [currentView, setCurrentView] = useState('submit');
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('session');
        if (sid) {
            setSessionId(sid);
            setCurrentView('result');
        }
    }, []);

    const handleSessionCreated = (sid: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('session', sid);
        window.history.pushState({}, '', url.toString());
        setSessionId(sid);
        setCurrentView('result');
    };

    const handleNewSession = () => {
        const url = new URL(window.location.href);
        url.searchParams.delete('session');
        window.history.pushState({}, '', url.toString());
        setSessionId(null);
        setCurrentView('submit');
    };

    useEffect(() => {
        // Inject brand favicon
        const svg = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="favicon-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#A5F3FC"/>
                        <stop offset="0.45" stop-color="#60A5FA"/>
                        <stop offset="1" stop-color="#1D4ED8"/>
                    </linearGradient>
                    <linearGradient id="favicon-dark-gradient" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0F172A"/>
                        <stop offset="1" stop-color="#1E3A8A"/>
                    </linearGradient>
                </defs>
                <path d="M12 2.75L19 5.55V11.4C19 16.18 16.21 20.37 12 22C7.79 20.37 5 16.18 5 11.4V5.55L12 2.75Z" fill="url(#favicon-gradient)" opacity="0.22"/>
                <path d="M12 2.75L19 5.55V11.4C19 16.18 16.21 20.37 12 22C7.79 20.37 5 16.18 5 11.4V5.55L12 2.75Z" stroke="url(#favicon-gradient)" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M7.8 16.8C9.45 15.4 10.85 14.18 11.85 13.18C13.18 11.85 14.18 10.63 15.88 8.72" stroke="url(#favicon-gradient)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M13.95 8.7H15.88V10.62" stroke="url(#favicon-gradient)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8.15 15.95H9.7V17.5H8.15V15.95Z" fill="url(#favicon-dark-gradient)" stroke="url(#favicon-gradient)" stroke-width="0.95"/>
                <path d="M10.28 13.92H11.98V15.62H10.28V13.92Z" fill="url(#favicon-dark-gradient)" stroke="url(#favicon-gradient)" stroke-width="0.95"/>
                <path d="M12.62 11.52H14.52V13.42H12.62V11.52Z" fill="url(#favicon-dark-gradient)" stroke="url(#favicon-gradient)" stroke-width="0.95"/>
                <circle cx="16.9" cy="7.15" r="1.2" fill="#DBEAFE" opacity="0.95"/>
            </svg>
        `;
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = url;
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const sid = params.get('session');
            if (sid) {
                setSessionId(sid);
                setCurrentView('result');
            } else {
                setSessionId(null);
                setCurrentView('submit');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    return (
        <div className="min-h-screen bg-[#030303] selection:bg-indigo-500 selection:text-white">
            <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_50%)] pointer-events-none" />
            <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setCurrentView('submit')}>
                            <div className="flex items-center justify-center w-11 h-11 rounded-2xl border border-white/15 bg-gradient-to-br from-sky-400/35 via-blue-500/30 to-blue-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_24px_rgba(37,99,235,0.28)] backdrop-blur-xl group-hover:scale-110 transition-transform">
                                <div className="scale-110"><BrandLogo className="w-5 h-5" /></div>
                            </div>
                            <h1 className="text-2xl font-black tracking-tighter">
                                <span className="text-white">Career</span><span className="text-indigo-400">Sense</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-6">
                            {currentView === 'result' && (
                                <button onClick={handleNewSession}
                                    className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                                    ← Initialize New Analysis
                                </button>
                            )}
                            <div className="hidden md:block h-6 w-px bg-white/10" />
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Node Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <main>
                {currentView === 'submit' ? (
                    <SubmitView 
                        onSessionCreated={handleSessionCreated} 
                        onViewHistory={() => setCurrentView('history')}
                    />
                ) : currentView === 'history' ? (
                    <HistoryView 
                        onSelectSession={(sid: string) => {
                            setSessionId(sid);
                            setCurrentView('result');
                        }}
                        onGoBack={() => setCurrentView('submit')}
                    />
                ) : (
                    <ResultView sessionId={sessionId} onGoBack={handleNewSession} />
                )}
            </main>
        </div>
    );
}

export default App;
