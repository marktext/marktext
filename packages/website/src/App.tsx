import TitleBar from './components/TitleBar'
import Feature from './components/Feature'
import Theme from './components/Theme'
import Sponsor from './components/Sponsor'
import Footer from './components/Footer'
import './app.global.css'

function App() {
  return (
    <div id="app">
      <TitleBar />
      <Feature />
      <Theme />
      <Sponsor />
      <Footer />
    </div>
  )
}

export default App
