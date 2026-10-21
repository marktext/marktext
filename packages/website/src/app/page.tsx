import Download from '@/components/Download'
import Extensions from '@/components/Extensions'
import FocusExport from '@/components/FocusExport'
import Footer from '@/components/Footer'
import Hero from '@/components/Hero'
import Nav from '@/components/Nav'
import PageEffects from '@/components/PageEffects'
import Preview from '@/components/Preview'
import Stats from '@/components/Stats'
import Support from '@/components/Support'
import Themes from '@/components/Themes'

export default function Home() {
  return (
    <>
      <div className="bg-fx" />
      <div className="bg-grid" />
      <Nav />
      <span id="top" />
      <Hero />
      <Stats />
      <Preview />
      <Extensions />
      <Themes />
      <FocusExport />
      <Support />
      <Download />
      <Footer />
      <PageEffects />
    </>
  )
}
