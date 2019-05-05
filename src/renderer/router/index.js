import App from '@/pages/app'
import Preference from '@/pages/preference'
import General from '@/prefComponents/general'
import Editor from '@/prefComponents/editor'
import Markdown from '@/prefComponents/markdown'
import Theme from '@/prefComponents/theme'

const routes = type => ([{
  path: '/', redirect: type === 'editor'? '/editor' : '/preference'
}, {
  path: '/editor', component: App 
}, {
  path: '/preference', component: Preference,
  children: [{
    path: '', component: General
  }, {
    path: 'general', component: General, name: 'general'
  }, {
    path: 'editor', component: Editor, name: 'editor'
  }, {
    path: 'markdown', component: Markdown, name: 'markdown'
  }, {
    path: 'theme', component: Theme, name: 'theme'
  }]
}])

export default routes
