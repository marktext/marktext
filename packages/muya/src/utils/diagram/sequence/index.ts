import Diagram from './sequence-diagram-snap';
import './sequence-diagram.css';

// Vendored `js-sequence-diagrams` (bramp, BSD) wired to render via snap.svg.
// The upstream `js-sequence-diagrams` npm package is a dead security-holder
// placeholder, so the legacy muyajs engine vendored the library source. We do
// the same here to keep feature parity. The exported `Diagram` exposes
// `parse(code)` returning an object with `drawSVG(container, { theme })`.
export default Diagram;
