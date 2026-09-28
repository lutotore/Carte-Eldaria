import { createApp } from 'vue'
// Sous-ensemble latin seulement : il couvre le français (é, à, œ…) sans charger le cyrillique ou le grec.
import '@fontsource/im-fell-dw-pica/latin-400.css'
import '@fontsource/im-fell-dw-pica/latin-400-italic.css'
import '@fontsource/alegreya-sans/latin-400.css'
import '@fontsource/alegreya-sans/latin-700.css'
import '@fontsource/alegreya-sans/latin-400-italic.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.vue'

createApp(App).mount('#app')
