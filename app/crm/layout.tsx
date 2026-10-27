import './crm.css'

// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const metadata = { title: 'Roberto CRM' }
export default function CrmRootLayout({ children }: { children: React.ReactNode }) { return <div className="crm">{children}</div> }
