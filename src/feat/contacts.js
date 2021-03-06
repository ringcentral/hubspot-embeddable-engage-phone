/**
 * third party contacts related feature
 */

import _ from 'lodash'
import {
  getAllCompany, formatCompanyContact
} from './company'
import {
  showAuthBtn
} from './auth'
import {
  popup,
  createElementFromHTML,
  formatPhone,
  host,
  notify
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import { rc, getPortalId, getCSRFToken } from './common'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import fetchBg from 'ringcentral-embeddable-extension-common/src/common/fetch-with-background'
import {
  remove,
  insert,
  getByPage,
  match
} from 'ringcentral-embeddable-extension-common/src/common/db'
import { setCache, getCache } from 'ringcentral-embeddable-extension-common/src/common/cache'

let {
  serviceName,
  apiServerHS
} = thirdPartyConfigs

const lastSyncOffset = 'last-sync-offset'
const lastSyncOffsetCompany = 'last-sync-offset-company'

/**
 * click contact info panel event handler
 * @param {Event} e
 */
function onClickContactPanel (e) {
  let { target } = e
  let { classList } = target
  if (classList.contains('rc-close-contact')) {
    document
      .querySelector('.rc-contact-panel')
      .classList.add('rc-hide-contact-panel')
  }
}

function onloadIframe () {
  let dom = document
    .querySelector('.rc-contact-panel')
  dom && dom.classList.add('rc-contact-panel-loaded')
}

/**
 * build name from contact info
 * @param {object} contact
 * @return {string}
 */
function buildName (contact) {
  let firstname = _.get(
    contact,
    'properties.firstname.value'
  ) || ''
  let lastname = _.get(
    contact,
    'properties.lastname.value'
  ) || ''
  let name = firstname || lastname ? firstname + ' ' + lastname : 'noname'
  return {
    name,
    firstname,
    lastname
  }
}

/**
 * build email
 * @param {Object} contact
 */
function buildEmail (contact) {
  for (let f of contact['identity-profiles']) {
    for (let g of f.identities) {
      if (g.type === 'EMAIL') {
        return [g.value]
      }
    }
  }
  return []
}

/**
 * build phone numbers from contact info
 * @param {object} contact
 * @return {array}
 */
function buildPhone (contact) {
  let phoneNumber = _.get(contact, 'properties.phone.value')
  let mobile = _.get(contact, 'properties.mobilephone.value')
  let res = []
  if (phoneNumber) {
    res.push({
      phoneNumber,
      phoneType: 'directPhone'
    })
  }
  if (mobile) {
    res.push({
      phoneNumber: mobile,
      phoneType: 'directPhone'
    })
  }
  const r = {
    phoneNumbersForSearch: res.map(
      d => formatPhone(d.phoneNumber)
    ).join(','),
    phoneNumbers: res
  }
  return r
}

/**
 * convert hubspot contacts to ringcentral contacts
 * @param {array} contacts
 * @return {array}
 */
export function formatContacts (contacts) {
  return contacts.map(contact => {
    if (contact.companyId) {
      return formatCompanyContact(contact)
    }
    return {
      id: contact.vid + '',
      ...buildName(contact),
      type: serviceName,
      emails: buildEmail(contact),
      ...buildPhone(contact),
      portalId: contact['portal-id'] + '',
      companyId: _.get(contact, 'properties.associatedcompanyid.value') + ''
    }
  })
}

/**
 * get contact list, one single time
 *
 * Request URL: https://api.hubspot.com/contacts/search/v1/search/contacts?resolveOwner=false&showSourceMetadata=false&identityProfileMode=all&showPastListMemberships=false&formSubmissionMode=none&showPublicToken=false&propertyMode=value_only&showAnalyticsDetails=false&resolveAssociations=false&portalId=4920570&clienttimeout=14000
Request Method: POST
Status Code: 200
Remote Address: 104.16.252.5:443
Referrer Policy: no-referrer-when-downgrade
access-control-allow-credentials: false
cf-ray: 4c075411da2295ef-SJC
content-encoding: br
content-type: application/json;charset=utf-8
date: Mon, 01 Apr 2019 03:03:10 GMT
expect-ct: max-age=604800, report-uri="https://report-uri.cloudflare.com/cdn-cgi/beacon/expect-ct"
server: cloudflare
status: 200
strict-transport-security: max-age=31536000; includeSubDomains; preload
x-trace: 2B60804C6252CCB7E03A4B80ED288C2CE6C759A75E000000000000000000
Provisional headers are shown
Accept: application/json, text/javascript, ; q=0.01
content-type: application/json
Origin: https://api.hubspot.com
Referer: https://api.hubspot.com/cors-preflight-iframe/
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.86 Safari/537.36
X-HS-Referer: https://app.hubspot.com/contacts/4920570/contacts/list/view/all/?
X-HubSpot-CSRF-hubspotapi: PZpN8Tvb7erQooRpVlIdpA
resolveOwner: false
showSourceMetadata: false
identityProfileMode: all
showPastListMemberships: false
formSubmissionMode: none
showPublicToken: false
propertyMode: value_only
showAnalyticsDetails: false
resolveAssociations: false
portalId: 888888
clienttimeout: 14000
{offset: 0, count: 100, filterGroups: [{filters: []}], properties: [],…}
count: 100
filterGroups: [{filters: []}]
offset: 0
properties: []
query: ""
sorts: [{property: "createdate", order: "DESC"}, {property: "vid", order: "DESC"}]

 */
export async function getContact (
  page = 1,
  _count = 100,
  _vidOffset,
  getRecent = false
) {
  let count = _count
  let vidOffset = _vidOffset || (page - 1) * count
  let portalId = getPortalId()
  // https://api.hubapi.com/contacts/v1/lists/all/contacts/all
  //  let url =`${apiServerHS}/contacts/v1/lists/all/contacts/all?count=${count}&vidOffset=${vidOffset}&property=firstname&property=phone&property=lastname&property=mobilephone&property=company`
  const baseUrl = getRecent
    ? '/contacts/v1/lists/recently_updated/contacts/recent'
    : '/contacts/v1/lists/all/contacts/all'
  let url = `${apiServerHS}${baseUrl}?resolveOwner=false&showSourceMetadata=false&identityProfileMode=all&showPastListMemberships=false&formSubmissionMode=none&showPublicToken=false&propertyMode=value_only&showAnalyticsDetails=false&resolveAssociations=true&portalId=${portalId}&clienttimeout=14000&property=mobilephone&property=phone&property=email&property=firstname&property=lastname&property=hubspot_owner_id&vidOffset=${vidOffset}&count=${count}`
  // let data = {
  //   offset: vidOffset,
  //   count,
  //   filterGroups: [
  //     {
  //       filters: []
  //     }
  //   ],
  //   // properties: [],
  //   properties: ['firstname', 'phone', 'lastname', 'mobilephone', 'company'],
  //   sorts: [
  //     {
  //       property: 'createdate',
  //       order: 'DESC'
  //     }, {
  //       property: 'vid',
  //       order: 'DESC'
  //     }
  //   ],
  //   query: ''
  // }
  let headers = {
    ...jsonHeader,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-HS-Referer': window.location.href,
    'X-HubSpot-CSRF-hubspotapi': getCSRFToken()
  }
  let res = await fetchBg(url, {
    // body: data,
    headers,
    method: 'get'
  })
  if (res && res.contacts) {
    return res
  } else {
    console.log('fetch contacts error')
    console.log(res)
    return {
      contacts: [],
      'has-more': true,
      'offset': vidOffset
    }
  }
}

export async function fetchAllContacts (_getRecent) {
  if (!rc.local.accessToken) {
    showAuthBtn()
    return
  }
  if (rc.isFetchingContacts) {
    return
  }
  let getRecent = !!_getRecent
  rc.isFetchingContacts = true
  loadingContacts()
  let page = 1
  let hasMore = true
  let hasMoreCompany = true
  let result = []
  const syncOffset = lastSyncOffset
  const syncOffsetCom = lastSyncOffsetCompany
  let offset = await getCache(syncOffset) || 0
  let offsetCompany = await getCache(syncOffsetCom) || 0
  console.debug(offset, 'offset', getRecent)
  console.debug(offsetCompany, 'offsetCompany')
  let dbTest = await getByPage(1, 1)
  console.debug('getRecent', getRecent)
  console.debug('dbTest', dbTest)
  if (!dbTest || !dbTest.count || offset || offsetCompany) {
    getRecent = false
  }
  console.debug('getRecent2', getRecent)
  if (!getRecent && !offset && !offsetCompany) {
    await remove()
  }
  let countRecentMax = 3
  let countRecent = 0
  let countRecentCompanyMax = 3
  let countRecentCompany = 0
  while (
    hasMore &&
    (countRecent < countRecentMax)
  ) {
    if (!getRecent) {
      await setCache(syncOffset, offset, 'never')
    }
    let res = await getContact(page, undefined, offset, getRecent)
    result = formatContacts(res.contacts)
    page = page + 1
    hasMore = res['has-more']
    offset = res['vid-offset']
    if (getRecent) {
      countRecent++
    }
    await insert(result)
  }
  if (!getRecent) {
    await setCache(syncOffset, 0, 'never')
  }
  while (
    hasMoreCompany &&
    (countRecentCompany < countRecentCompanyMax)
  ) {
    if (!getRecent) {
      await setCache(syncOffsetCom, offsetCompany, 'never')
    }
    let res = await getAllCompany(offsetCompany, undefined, getRecent)
    result = formatContacts(res.companies)
    hasMoreCompany = res['has-more']
    offsetCompany = res['offset']
    if (getRecent) {
      countRecentCompany++
    }
    await insert(result)
  }
  if (!getRecent) {
    await setCache(syncOffsetCom, 0, 'never')
  }
  rc.isFetchingContacts = false
  rc.syncTimeStamp = Date.now()
  await setCache('rc-sync-timestamp', rc.syncTimeStamp, 'never')
  stopLoadingContacts()
  notifyReSyncContacts()
  notify('Syncing contacts done', 'info', 1000)
}

/**
 * get contact lists
 */
export const getContacts = async (page) => {
  let final = {
    result: [],
    hasMore: false
  }
  if (!rc.rcLogined) {
    return final
  }
  if (!rc.local.accessToken) {
    showAuthBtn()
    return final
  }
  let cached = await getByPage(page).catch(e => console.log(e.stack))
  if (cached && cached.result && cached.result.length) {
    console.debug('use cache')
    return cached
  } else {
    fetchAllContacts()
  }
  return final
}

export function hideContactInfoPanel () {
  let dom = document
    .querySelector('.rc-contact-panel')
  dom && dom.classList.add('rc-hide-contact-panel')
}

/**
 * show caller/callee info
 * @param {Object} call
 */
export async function showContactInfoPanel (call) {
  if (
    !call ||
    call.telephonyStatus !== 'Ringing' ||
    call.direction === 'Outbound'
  ) {
    return
  }
  popup()
  let phone = _.get(call, 'from.phoneNumber') || _.get(call, 'from')
  if (!phone) {
    return
  }
  phone = formatPhone(phone)
  let contacts = await match([phone])
  let contact = _.get(contacts, `${phone}[0]`)
  if (!contact) {
    return
  }
  let type = contact.isCompany
    ? 'company'
    : 'contact'
  // let contactTrLinkElem = canShowNativeContact(contact)
  // if (contactTrLinkElem) {
  //   return showNativeContact(contact, contactTrLinkElem)
  // }
  let url = `${host}/contacts/${contact.portalId}/${type}/${contact.id}/?interaction=note`
  let elem = createElementFromHTML(
    `
    <div class="animate rc-contact-panel" draggable="false">
      <div class="rc-close-box">
        <div class="rc-fix rc-pd2x">
          <span class="rc-fleft">Contact</span>
          <span class="rc-fright">
            <span class="rc-close-contact">&times;</span>
          </span>
        </div>
      </div>
      <div class="rc-contact-frame-box">
        <iframe scrolling="no" class="rc-contact-frame" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" allow="microphone" src="${url}" id="rc-contact-frame">
        </iframe>
      </div>
      <div class="rc-loading">loading...</div>
    </div>
    `
  )
  elem.onclick = onClickContactPanel
  elem.querySelector('iframe').onload = onloadIframe
  let old = document
    .querySelector('.rc-contact-panel')
  old && old.remove()

  document.body.appendChild(elem)
  // moveWidgets()
}

function loadingContacts () {
  let loadingContactsBtn = document.getElementById('rc-reloading-contacts')
  if (loadingContactsBtn) {
    return
  }
  let elem = createElementFromHTML(
    `
    <span
      class="rc-reloading-contacts"
      id="rc-reloading-contacts"
      title="Reload contacts"
    />Syncing contacts, please stay in this page until it is done</span>
    `
  )
  document.body.appendChild(elem)
}

function stopLoadingContacts () {
  let loadingContactsBtn = document.getElementById('rc-reloading-contacts')
  if (loadingContactsBtn) {
    loadingContactsBtn.remove()
  }
}

export function notifyReSyncContacts () {
  rc.postMessage({
    type: 'rc-adapter-sync-third-party-contacts'
  })
}

export async function getOwnerId (vid) {
  let count = 1
  let vidOffset = 0
  let portalId = getPortalId()
  // https://api.hubapi.com/contacts/v1/lists/all/contacts/all
  //  let url =`${apiServerHS}/contacts/v1/lists/all/contacts/all?count=${count}&vidOffset=${vidOffset}&property=firstname&property=phone&property=lastname&property=mobilephone&property=company`

  let url = `${apiServerHS}/contacts/search/v1/search/contacts?resolveOwner=false&showSourceMetadata=false&identityProfileMode=all&showPastListMemberships=false&formSubmissionMode=none&showPublicToken=false&propertyMode=value_only&showAnalyticsDetails=false&resolveAssociations=true&portalId=${portalId}&clienttimeout=14000&property=mobile&property=phone&property=email&property=hubspot_owner_id`
  let data = {
    offset: vidOffset,
    count,
    filterGroups: [
      {
        filters: []
      }
    ],
    // properties: [],
    properties: ['firstname', 'phone', 'lastname', 'mobilephone', 'company', 'hubspot_owner_id'],
    sorts: [
      {
        property: 'createdate',
        order: 'DESC'
      }, {
        property: 'vid',
        order: 'DESC'
      }
    ],
    query: ''
  }
  let headers = {
    ...jsonHeader,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-HS-Referer': window.location.href,
    'X-HubSpot-CSRF-hubspotapi': getCSRFToken()
  }
  let res = await fetchBg(url, {
    body: data,
    headers,
    method: 'post'
  })
  if (vid) {
    return _.get(res, 'contacts[0].vid')
  }
  return _.get(
    res,
    'contacts[0].properties.hubspot_owner_id.value'
  )
}
