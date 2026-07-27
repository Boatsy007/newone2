import { Navigate } from 'react-router-dom'

/**
 * The championship concept is not a launched PlayFooty product.
 * Preserve the historic URL without exposing an unfinished public feature.
 */
export default function Championship() {
  return <Navigate to="/rankings" replace />
}
