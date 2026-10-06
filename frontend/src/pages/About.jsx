import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import { useTitle } from '../hooks/data'

const contact = import.meta.env.VITE_CONTACT_EMAIL

function Section({ id, title, children }) {
  return <section id={id} className="card mb-3.5 scroll-mt-20"><h2 className="h3 mb-2">{title}</h2><div className="prose-rw">{children}</div></section>
}

export default function About() {
  useTitle('About and disclaimer')
  return (
    <Page>
      <h1 className="h2 mb-1">About and disclaimer</h1>
      <p className="muted mb-4 max-w-3xl">Please read this page. It explains what RiskWise is, and what it is not.</p>
      <div className="max-w-3xl">
        <Section id="what" title="What RiskWise is">
          <p>RiskWise is a free, non-commercial, educational project. It shows, for Indian stocks, a delayed price, a <b className="text-tx">risk level</b> for the coming week (how bumpy the ride is expected to be), and a flag when a day looks unusual for a stock. It exists to help people understand risk in plain English. See <Link to="/how-it-works" className="underline">How it works</Link> for exactly how.</p>
        </Section>
        <Section id="disclaimer" title="Disclaimer: this is not advice">
          <p><b className="text-tx">RiskWise does not give investment advice.</b> Nothing on this site is a recommendation to buy, sell or hold any security. The operator is not a SEBI-registered investment adviser or research analyst.</p>
          <p>Risk levels are statistical forecasts. They can be wrong, and they cannot see surprises such as sudden news. A "Low risk" label does not mean a stock cannot fall, and a "High risk" label does not mean it will. Past behaviour does not guarantee future behaviour. Investing in the stock market involves the risk of losing money. Please do your own research or speak to a qualified adviser before you invest, and use the site at your own risk.</p>
        </Section>
        <Section id="data" title="Data notice">
          <p>Prices and company facts come from a free, unofficial source (Yahoo Finance). Prices are <b className="text-tx">delayed or indicative</b>, and may be late, wrong or missing. Some company facts, such as a P/E ratio or return on equity, are not available for every company. Do not use this site to place trades. The list of stocks comes from the National Stock Exchange of India's published list; stocks that trade only on the BSE are not covered yet.</p>
        </Section>
        <Section id="privacy" title="Privacy">
          <p>We keep only two things about you: <b className="text-tx">your email address</b> (so you can log in) and <b className="text-tx">your watchlist</b> (the stocks you saved). We do not sell or share them, and we do not show ads. Logins and watchlists are handled by Supabase, a hosting service for databases.</p>
          <p>You can delete your account at any time from your <Link to="/account" className="underline">account page</Link>. That permanently deletes your login and your watchlist. Your theme choice (dark or light) is stored in your browser only.</p>
        </Section>
        <Section id="contact" title="Contact and feedback">
          <p>Found a bug, a wrong number or something confusing? We would like to hear about it.{' '}
            {contact ? <>Email <a href={`mailto:${contact}`} className="underline">{contact}</a>.</> : 'A contact address will be added here before the site launches.'}</p>
        </Section>
      </div>
    </Page>
  )
}
