/* global process */

import {createClient} from 'contentful'

const client = createClient({
  space: process.env.CONTENTFUL_SPACE,
  accessToken: process.env.CONTENTFUL_KEY,
  host: 'cdn.contentful.com'
})

client.sync({initial: true})
  .then(response => {
    process.stdout.write(JSON.stringify(response))
  })
