import axios from 'axios'
import adapter from 'axios/lib/adapters/http'

axios.defaults.adapter = adapter

const http = axios.create({
  adapter
})

export default http
