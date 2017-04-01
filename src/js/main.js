/* global document */

import loadFont from 'meownica-web-fonts-loader'

loadFont('//fonts.googleapis.com/css?family=Roboto:300,400,700,900', 'webfont-loaded')

const s = document.createElement('script')
s.src = 'https://lets-work-remote.disqus.com/embed.js'
s.setAttribute('data-timestamp', +new Date())
document.body.appendChild(s)
