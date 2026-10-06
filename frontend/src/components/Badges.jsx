import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, CircleHelp, Flame, ShieldCheck, ShieldHalf, Zap } from 'lucide-react'

const LEVEL_ICON = { Low: ShieldCheck, Medium: ShieldHalf, High: Flame }
export const levelIcon = (level) => LEVEL_ICON[level] || AlertTriangle

// Small label: "Low risk" with an icon (never colour alone).
export function RiskChip({ level }) {
  const Icon = levelIcon(level)
  return <span className={`badge ${level}`}><Icon size={13} aria-hidden="true" />{level} risk</span>
}

// Bigger tile version used on cards.
export function RiskTile({ level }) {
  const Icon = levelIcon(level)
  return <div className={`tile ${level}`}><Icon size={20} aria-hidden="true" /><b>{level} risk</b></div>
}

export function UnusualChip({ unusual }) {
  return unusual?.flag
    ? <span className="badge flag"><Zap size={13} aria-hidden="true" />Unusual activity</span>
    : <span className="badge ok"><CheckCircle2 size={13} aria-hidden="true" />Nothing unusual</span>
}

export function UnusualTile({ unusual }) {
  const flagged = unusual?.flag
  return (
    <div className={`tile ${flagged ? 'flag' : ''}`}>
      {flagged ? <Zap size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
      <div>
        <b>{flagged ? 'Unusual activity' : 'Normal activity'}</b>
        <div className="sub">{flagged ? unusual.reason : 'Nothing unusual'}</div>
      </div>
    </div>
  )
}

// A little "?" that explains a term. AI terms point to How it works; market terms point to the Glossary.
export function HelpTip({ text, to }) {
  const icon = <CircleHelp size={14} aria-hidden="true" />
  return to
    ? <Link to={to} title={text} aria-label={`${text} (opens an explanation)`} className="faint ml-1 inline-flex align-middle hover:text-ac">{icon}</Link>
    : <span title={text} className="faint ml-1 inline-flex align-middle" aria-label={text}>{icon}</span>
}

export function Initials({ sym, color }) {
  const text = sym.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-semibold"
      style={{ background: `${color}26`, color }} aria-hidden="true">{text}</div>
  )
}
