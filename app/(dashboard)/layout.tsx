'use client'
import Sidebar from '@/components/Sidebar'
import MobileMenu from '@/components/MobileMenu'
import GlobalSearch from '@/components/GlobalSearch'
import VoiceAssistant from '@/components/VoiceAssistant'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .dw{display:flex;height:100vh;overflow:hidden;background:var(--bg)}
        .dsb{display:flex}
        .dm{flex:1;display:flex;flex-direction:column;min-width:0;overflow-y:auto;overflow-x:hidden}
        .mm-mobile{display:none}
        @media(max-width:768px){
          .dw{flex-direction:column}
          .dsb{display:none}
          .mm-mobile{display:block}
        }
      `}</style>
      <div className="dw">
        <div className="dsb"><Sidebar /></div>
        <div className="mm-mobile"><MobileMenu /></div>
        <main className="dm">{children}</main>
      </div>
      <GlobalSearch />
      <VoiceAssistant />
    </>
  )
}
