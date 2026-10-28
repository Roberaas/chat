import { redirect } from 'next/navigation'

// Harita artık Toptan menüsünün içinde
export default function HaritaRedirect() { redirect('/crm/musteriler?kanal=toptan') }
