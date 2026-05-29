import FeatureCard from './FeatureCard'
import { ExportIcon, TargetIcon } from './Icons'

export default function FocusExport() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="grid-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <FeatureCard
            className="card reveal"
            style={{ padding: 34 }}
            icon={<TargetIcon />}
            title="Focus & typewriter mode"
            titleStyle={{ fontSize: 21 }}
            description="Dim everything but the line you're writing, and keep it locked to center. Distraction-free by design."
            descStyle={{ fontSize: 15 }}
          >
            <div className="mini" style={{ fontSize: 13, lineHeight: 1.8 }}>
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
            className="card reveal d1"
            style={{ padding: 34 }}
            icon={<ExportIcon />}
            title="Export anywhere"
            titleStyle={{ fontSize: 21 }}
            description={
              <>
                Turn any document into a polished <strong>PDF</strong> or self-contained{' '}
                <strong>HTML</strong> file — your theme included.
              </>
            }
            descStyle={{ fontSize: 15 }}
          >
            <div className="platforms" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
              <div className="plat" style={{ minWidth: 0, padding: '12px 18px' }}>
                <b style={{ fontSize: 14 }}>PDF</b>
              </div>
              <div className="plat" style={{ minWidth: 0, padding: '12px 18px' }}>
                <b style={{ fontSize: 14 }}>HTML</b>
              </div>
              <div className="plat" style={{ minWidth: 0, padding: '12px 18px' }}>
                <b style={{ fontSize: 14 }}>.md</b>
              </div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  )
}
