import FeatureCard from './FeatureCard'
import { ExportIcon, TargetIcon } from './Icons'

export default function FocusExport() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="grid-3 grid-2">
          <FeatureCard
            variant="lg"
            icon={<TargetIcon />}
            title="Focus & typewriter mode"
            description="Dim everything but the line you're writing, and keep it locked to center. Distraction-free by design."
          >
            <div className="mini mini--lg">
              <span style={{ opacity: 0.3 }}>The paragraph above fades back.</span>
              <br />
              <span style={{ color: 'var(--text)' }}>
                This line stays sharp and centered.
                <span className="cursor" />
              </span>
              <br />
              <span style={{ opacity: 0.3 }}>And the next one waits its turn.</span>
            </div>
          </FeatureCard>

          <FeatureCard
            variant="lg"
            delay="d1"
            icon={<ExportIcon />}
            title="Export anywhere"
            description={
              <>
                Turn any document into a polished <strong>PDF</strong> or self-contained{' '}
                <strong>HTML</strong> file — your theme included.
              </>
            }
          >
            <div className="platforms platforms--start">
              <div className="plat plat--compact"><b>PDF</b></div>
              <div className="plat plat--compact"><b>HTML</b></div>
              <div className="plat plat--compact"><b>.md</b></div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
