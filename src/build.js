/* global process */

import content from '../build/content.json'
import pjson from '../package.json'
import {Converter} from 'showdown'
import {sync as globSync} from 'glob'
import {readFileSync, writeFileSync} from 'fs'
import {template} from 'lodash'
import moment from 'moment'

const markdownConverter = new Converter({
  simplifiedAutoLink: true,
  strikethrough: true,
  tables: true
})

/**
 * Recursively build the template, this allows for includes to contain includes …
 */
const buildTemplate = (templateString, data, step) => {
  step = step || 1
  if (step >= 10) {
    console.error('Reached maximum nesting level', step)
    return templateString
  }
  const previousResult = templateString
  const result = template(templateString)(data)
  if (result === previousResult) {
    return result
  }
  return buildTemplate(result, data, ++step)
}

const isPage = entry => entry.sys.contentType.sys.id === 'page'
const isPost = entry => entry.sys.contentType.sys.id === 'post'
const isAuthor = entry => entry.sys.contentType.sys.id === 'author'

const buildPostContent = (post, locale) => {
  const content = {}
  Object.keys(post.fields).forEach(k => {
    switch (k) {
      case 'content':
      case 'abstract':
        content[k] = markdownConverter.makeHtml(post.fields[k][locale])
        break
      case 'hero':
        content[k] = {
          title: post.fields[k][locale].fields.title[locale],
          file: post.fields[k][locale].fields.file[locale]
        }
        break
      case 'author':
        content[k] = {
          name: post.fields[k][locale].fields.name[locale],
          slug: post.fields[k][locale].fields.slug[locale]
        }
        break
      default:
        content[k] = post.fields[k][locale]
    }
  })
  return content
}

const buildAuthorContent = (author, locale) => {
  const content = {}
  Object.keys(author.fields).forEach(k => {
    switch (k) {
      case 'description':
        content[k] = markdownConverter.makeHtml(author.fields[k][locale])
        break
      case 'photo':
        content[k] = {
          title: author.fields[k][locale].fields.title[locale],
          file: author.fields[k][locale].fields.file[locale]
        }
        break
      default:
        content[k] = author.fields[k][locale]
    }
  })
  return content
}

const buildPageContent = (page, locale) => {
  const content = {}
  Object.keys(page.fields).forEach(k => {
    switch (k) {
      case 'content':
        content[k] = markdownConverter.makeHtml(page.fields[k][locale])
        break
      default:
        content[k] = page.fields[k][locale]
    }
  })
  return content
}

const build = {
  environment: process.env.ENVIRONMENT || 'production',
  version: pjson.version,
  name: pjson.name,
  time: Date.now(),
  locale: process.env.CONTENTFUL_LOCALE
}

const shortDate = date => moment(date).format('DD.MM.YYYY')
const striptags = str => str.replace(/<[^>]+>/g, '')

// Find includes
const includesFiles = {}
globSync('./src/includes/*.html').map(f => {
  includesFiles[f.replace('./src/includes/', '').replace(/\.html$/, '')] = readFileSync(f, 'utf8')
})

// Build the config
const config = {}
content.entries.filter(e => e.sys.contentType.sys.id === 'config').map(c => {
  const key = c.fields.key[build.locale]
  config[key] = process.env[`CONFIG_${key.toUpperCase()}`] || c.fields.value[build.locale]
})

// Build collections
const collections = {}
content.entries.filter(e => e.sys.contentType.sys.id === 'collection').map(c => {
  collections[c.fields.title[build.locale]] = c.fields.items[build.locale].map(e => {
    if (isPage(e)) return buildPageContent(e, build.locale)
    if (isPost(e)) return buildPostContent(e, build.locale)
  })
})

// This renders a page
const buildPage = (content, identifier, template) => {
  const includes = {}
  const page = {
    url: config.webHost + config.baseHref + identifier + '.html'
  }
  const templateData = {
    build: Object.assign({identifier}, build),
    config,
    content,
    collections,
    includes,
    shortDate,
    striptags,
    page
  }

  // Build includes
  Object.keys(includesFiles).forEach(k => {
    includes[k] = buildTemplate(includesFiles[k], templateData)
  })

  // Build page
  const pageTemplate = buildTemplate(readFileSync(`./src/${template}.html`, 'utf8'), templateData)

  // Build pages
  writeFileSync(`build/${identifier}.html`, pageTemplate)

  // Done
  console.log(`build/${identifier}.html`)

  return templateData
}

// Posts
const posts = content.entries.filter(e => isPost(e))
  .map(post => {
    const content = buildPostContent(post, build.locale)
    return buildPage(content, content.slug, 'post')
  })

// Authors
content.entries.filter(e => isAuthor(e))
  .map(page => {
    const content = buildAuthorContent(page, build.locale)
    buildPage(content, content.slug, 'author')
  })

// Pages
content.entries.filter(e => isPage(e))
  .map(page => {
    const content = buildPageContent(page, build.locale)
    buildPage(content, content.slug, 'page')
  })

// Index
buildPage({posts}, 'index', 'index')
