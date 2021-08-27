/* global browser */

const selectedContainer = (() => {
  // Open in the default FF container if we don't have a specific one
  let container = 'firefox-default'
  return {
    set: (account) => { container = account },
    reset: () => { container = 'firefox-default' },
    get: () => { return container }
  }
})()

const randomColor = (_ => {
  const colors = [
    'blue', 'turquoise', 'purple', 'yellow',
    'orange', 'red', 'pink', 'green'
  ]
  return function () { return colors[Math.floor(Math.random() * colors.length)] }
})()

const randomIcon = (_ => {
  const icons = [
    'fingerprint', 'briefcase', 'dollar', 'cart', 'circle', 'gift',
    'vacation', 'food', 'fruit', 'pet', 'tree', 'chill', 'fence'
  ]
  return function () { return icons[Math.floor(Math.random() * icons.length)] }
})()

const COOKIE_JAR = {}

async function getOrCreateCookieStore () {
  let cookieStoreId
  const containerName = selectedContainer.get()
  const container = await browser.contextualIdentities.query({ name: containerName })
  if (container.length > 0) {
    const accountContainer = container[0]
    cookieStoreId = accountContainer.cookieStoreId
  } else {
    const newContainer = await browser.contextualIdentities.create({
      name: containerName, color: randomColor(), icon: randomIcon()
    })
    cookieStoreId = newContainer.cookieStoreId
  }
  return cookieStoreId
}

async function moveCookiesToContainer (newCookieContainer) {
  // Pass the captured cookies that are not empty into the new container
  for (const cookie in COOKIE_JAR) {
    const newCookie = COOKIE_JAR[cookie]
    if (newCookie.value !== '""' && newCookie.url.match(newCookie.domain)) {
      await browser.cookies.set(Object.assign(COOKIE_JAR[cookie], { storeId: newCookieContainer }))
      delete COOKIE_JAR[cookie]
    }
  }
}

async function openInContainer (request) {
  const tab = await browser.tabs.get(request.tabId)
  const url = request.url

  if (selectedContainer.get() === 'firefox-default') {
    return
  }
  if (tab.cookieStoreId !== 'firefox-default') {
    return
  }
  const cookieStoreId = await getOrCreateCookieStore()
  await moveCookiesToContainer(cookieStoreId)
  await browser.tabs.create({
    url,
    cookieStoreId,
    active: tab.active,
    index: tab.index,
    windowId: tab.windowId
  })

  browser.tabs.remove(tab.id)
  selectedContainer.reset()

  return { cancel: true }
}

async function syncSamlCookies (_) {
  const cookieStoreId = await getOrCreateCookieStore()
  await moveCookiesToContainer(cookieStoreId)
}

function cookieToObject (rawCookie) {
  const cookieFields = rawCookie.split(';')
  const [name, value] = cookieFields.shift().split('=')
  const cookieObject = { name: name, value: value }
  for (const field of cookieFields) {
    Object.assign(cookieObject, parseCookieAv(field))
  }
  return cookieObject
}
// Parses the additional fields in the cookie
function parseCookieAv (field) {
  const splitField = field.split('=')
  if (field.match('Expires=')) {
    // Replace dashes, otherwise Firefox will parse Aug-2022 as 08/-2022.
    const parsedDate = new Date(splitField[1].replaceAll('-', '/'))
    return { expirationDate: parsedDate.getTime() / 1000 }
  }
  if (field.match('Path=')) {
    return { path: splitField[1] }
  }
  if (field.match('Secure')) {
    return { secure: true }
  }
  if (field.match('Domain')) {
    return { domain: splitField[1] }
  }
  if (field.match('SameSite')) {
    return { sameSite: splitField[1].toLowerCase() }
  }
  if (field.match('HttpOnly')) {
    return { httpOnly: true }
  }
  return {}
}

async function getRequestCookies (r) {
  // Lookup cookies sent in the container's store, add them to the cookie Jar
  for (const header of r.requestHeaders) {
    if (header.name.toLowerCase() === 'cookie') {
      const cookieNames = header.value.split(';').map(y => y.split('=')[0].trim())
      for (const cookie of cookieNames) {
        const cookieInContainer = await browser.cookies.getAll({ name: cookie })
        const newCookie = Object.assign(cookieInContainer[0], { url: r.url })
        delete newCookie.hostOnly
        delete newCookie.session
        COOKIE_JAR[newCookie.name] = newCookie
        console.debug(`[LOG] Cookie pushed, name: ${newCookie.name}`)
      }
    }
  }
}

function getResponseCookies (r) {
  for (const header of r.responseHeaders) {
    if (header.name.toLowerCase().match('cookie')) {
      for (const rawCookie of header.value.split('\n')) {
        const newCookie = Object.assign({}, cookieToObject(rawCookie), { url: r.url })
        COOKIE_JAR[newCookie.name] = newCookie
        console.debug(`[LOG] Cookie pushed, name: ${newCookie.name}`)
      }
      break
    }
  }
}

//

browser.webRequest.onHeadersReceived.addListener(getResponseCookies, { urls: ['https://signin.aws.amazon.com/saml'], types: ['main_frame'] }, ['blocking', 'responseHeaders'])

browser.webRequest.onBeforeSendHeaders.addListener(getRequestCookies, { urls: ['https://signin.aws.amazon.com/saml'], types: ['main_frame'] }, ['blocking', 'requestHeaders'])

// Firefox doesn't allow cookies that don't match between the url and the domain, this syncs the cookies
// for the SAML POST
browser.webRequest.onBeforeRequest.addListener(syncSamlCookies, { urls: ['https://signin.aws.amazon.com/saml'], types: ['main_frame'] }, ['blocking'])

// Swap over in the last call to the Console home
browser.webRequest.onBeforeRequest.addListener(openInContainer, { urls: ['https://console.aws.amazon.com/console/home?state*'], types: ['main_frame'] }, ['blocking'])

// This lets us know what is the name we should give the new Container
browser.runtime.onMessage.addListener(function (message) {
  selectedContainer.set(message.data)
  console.debug(`[LOG] Set container to: ${selectedContainer.get()}`)
})

console.log('[LOG] Background extension loaded!')
