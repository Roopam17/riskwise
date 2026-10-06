import { Link } from 'react-router-dom'
import { Page } from '../components/Layout'
import { useTitle } from '../hooks/data'

export default function NotFound() {
  useTitle('Page not found')
  return (
    <Page narrow>
      <div className="card mt-10 text-center">
        <h1 className="h2">We could not find that page</h1>
        <p className="muted mt-2">The link may be old or mistyped.</p>
        <Link to="/" className="btn btn-primary mt-4">Go to the home page</Link>
      </div>
    </Page>
  )
}
