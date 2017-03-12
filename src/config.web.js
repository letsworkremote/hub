import pjson from '../package.json'

export const config = {
  environment: process.env.ENVIRONMENT || 'production',
  version: pjson.version,
  name: pjson.name,
  appName: 'Let\'s Work Remote',
  description: 'Deutschsprachiges Portal rund um die Arbeit in verteilten Teams. Ein Projekt von Tanja und Markus Tacker.',
  lang: 'de',
  baseHref: process.env.BASE_HREF || '/',
  webHost: process.env.WEB_HOST || 'https://lets-work-remote.de'
}

process.stdout.write(JSON.stringify(config))
