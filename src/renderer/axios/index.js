import axios from 'axios'
import adapter from 'axios/lib/adapters/xhr'

const http = axios.create({
  adapter
})

export default http
