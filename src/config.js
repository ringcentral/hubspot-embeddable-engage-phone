/**
 * content config file
 * with proper config,
 * insert `call with ringcentral` button
 * or hover some elemet show call button tooltip
 * or convert phone number text to click-to-call link
 *
 */

/// *
import _ from 'lodash'
import {
  RCBTNCLS2,
  checkPhoneNumber,
  sendMsgToRCIframe
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import { upgrade } from 'ringcentral-embeddable-extension-common/src/feat/upgrade-notification'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import fetchBg from 'ringcentral-embeddable-extension-common/src/common/fetch-with-background'
import { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import { getCSRFToken, getIds, rc } from './feat/common'
import { getDeals } from './feat/deal'
import {
  getCompanyById
} from './feat/company'
import {
  match
} from 'ringcentral-embeddable-extension-common/src/common/db'
import { initReactModule } from './feat/react-entry'

import {
  fetchAllContacts,
  formatContacts
} from './feat/contacts.js'

import {
  renderAuthButton
} from './feat/auth'
import {
  syncCallLogToThirdParty
} from './feat/log-sync.js'

window.is_engage_voice = true

let {
  apiServerHS
} = thirdPartyConfigs

function formatNumbers (res) {
  const r = formatContacts([res])[0]
  return r.phoneNumbers.map(p => {
    return {
      id: p.phoneNumber,
      title: 'Direct',
      number: p.phoneNumber
    }
  })
}

async function getNumbers (ids = getIds()) {
  if (!ids) {
    return []
  }
  let {
    portalId,
    vid
  } = ids
  let url = `${apiServerHS}/contacts/v1/contact/vid/${vid}/profile?resolveOwner=false&showSourceMetadata=false&identityProfileMode=all&showPastListMemberships=false&formSubmissionMode=none&showPublicToken=false&propertyMode=value_only&showAnalyticsDetails=false&resolveAssociations=true&portalId=${portalId}&clienttimeout=14000&property=mobilephone&property=phone&property=email&property=hubspot_owner_id`
  let csrf = getCSRFToken()
  let res = await fetchBg(url, {
    headers: {
      ...jsonHeader,
      'x-hubspot-csrf-hubspotapi': csrf
    }
  })
  return res ? formatNumbers(res) : []
}

async function getDealNumbers (ids = getIds()) {
  if (!ids) {
    return []
  }
  let deal = await getDeals('', Number(ids.vid))
  if (!deal) {
    return []
  }
  let vids = _.get(deal, 'associations.associatedVids') || []
  let numbers = []
  for (let vid of vids) {
    let ids0 = {
      portalId: ids.portalId,
      vid
    }
    let ns = await getNumbers(ids0)
    numbers = [
      ...numbers,
      ...ns
    ]
  }
  return numbers
}

async function getCompanyPhoneNumbers () {
  let ids = getIds(window.location.href)
  if (!ids) {
    return []
  }
  let company = await getCompanyById(ids.vid)
  return company.phoneNumbers.map((p, i) => {
    return {
      id: i + '#' + company.companyId,
      title: 'Company phone number',
      number: p.phoneNumber
    }
  }).filter(o => checkPhoneNumber(o.number))
}

export function getUserId () {
  let emailDom = document.querySelector('.user-info-email')
  if (!emailDom) {
    return ''
  }
  let email = emailDom.textContent.trim()
  return email
}

export const insertClickToCallButton = [
  {
    shouldAct: href => {
      return /contacts\/\d+\/contact\/\d+/.test(href)
    },
    getContactPhoneNumbers: getNumbers,
    parentsToInsertButton: [
      {
        getElem: () => {
          let p = document.querySelector('[data-unit-test="highlightSubtitle"]')
          return p
            ? p.parentNode.parentNode : null
        },
        insertMethod: 'append',
        shouldInsert: () => {
          let all = document.querySelectorAll('.text-center .' + RCBTNCLS2)
          if (all.length > 1) {
            let arr = Array.from(all)
            let i = 0
            for (let ele of arr) {
              if (i !== 0) {
                ele.remove()
              }
              i++
            }
          }
          return !all.length
        }
      }
    ]
  },
  {
    shouldAct: href => {
      return /contacts\/\d+\/deal\/\d+/.test(href)
    },
    getContactPhoneNumbers: getDealNumbers,
    parentsToInsertButton: [
      {
        getElem: () => {
          let p = document.querySelector('[class*="ProfileHighlightContainer__Wrapper"]')
          return p
        },
        insertMethod: 'append',
        shouldInsert: () => {
          let all = document.querySelectorAll('[class*="ProfileHighlightContainer__Wrapper"] .' + RCBTNCLS2)
          if (all.length > 1) {
            let arr = Array.from(all)
            let i = 0
            for (let ele of arr) {
              if (i !== 0) {
                ele.remove()
              }
              i++
            }
          }
          return !all.length
        }
      }
    ]
  },
  {
    shouldAct: href => {
      return /contacts\/\d+\/company\/\d+/.test(href)
    },
    getContactPhoneNumbers: getCompanyPhoneNumbers,
    parentsToInsertButton: [
      {
        getElem: () => {
          let p = document.querySelector('[class*="CompanyContactEditableTitle"]')
          return p
            ? p.parentNode.parentNode.parentNode : null
        },
        insertMethod: 'append',
        shouldInsert: () => {
          let all = document.querySelectorAll('.text-center .' + RCBTNCLS2)
          if (all.length > 1) {
            let arr = Array.from(all)
            let i = 0
            for (let ele of arr) {
              if (i !== 0) {
                ele.remove()
              }
              i++
            }
          }
          return !all.length
        }
      }
    ]
  }
]

// hover contact node to show click to dial tooltip
export const hoverShowClickToCallButton = [
  {
    shouldAct: href => {
      return href.includes('contacts/list/') || href.includes('contacts/view/all/')
    },
    selector: 'table.table tbody tr',
    getContactPhoneNumbers: async elem => {
      let linkElem = elem.querySelector('[href*="/contacts"]')
      let href = linkElem
        ? linkElem.getAttribute('href')
        : ''

      let ids = getIds(href)
      return getNumbers(ids)
    }
  },
  {
    shouldAct: href => {
      return href.includes('companies/list/') || href.includes('companies/view/all/')
    },
    selector: 'table.table tbody tr',
    getContactPhoneNumbers: async elem => {
      let linkElem = elem.querySelector('.name-cell a')
      let href = linkElem
        ? linkElem.getAttribute('href')
        : ''
      let ids = getIds(href)
      if (!ids) {
        return []
      }
      let company = await getCompanyById(ids.vid)
      return company.phoneNumbers.map((p, i) => {
        return {
          id: i + '#' + company.companyId,
          title: 'Company phone number',
          number: p.phoneNumber
        }
      }).filter(o => checkPhoneNumber(o.number))
    }
  }
]

// modify phone number text to click-to-call link
export const phoneNumberSelectors = [{
  shouldAct: (href) => {
    return href.includes('/contacts')
  },
  selector: '[data-selenium-test="timeline-editable-section"] b'
}, {
  shouldAct: (href) => {
    return href.includes('/contacts')
  },
  selector: '[data-measured-element="timeline-participant-details-right-content"] span'
}]

/**
 * thirdPartyService config
 * @param {*} serviceName
 */
export function thirdPartyServiceConfig (serviceName) {
  console.log(serviceName)

  let services = {
    name: serviceName,
    callLoggerEnabled: true,
    contactMatcherEnabled: true
  }

  let handleRCEvents = async e => {
    const { payload = {}, requestId } = e.data || {}
    console.debug('payload', payload)
    if (payload.requestType === 'rc-ev-logCall') {
      const { data } = payload
      data.triggerType = 'auto'
      data.description = data.task.notes
      syncCallLogToThirdParty(data)
      sendMsgToRCIframe({
        type: 'MessageTransport-response',
        requestId,
        result: 'ok'
      }, true)
    } else if (payload.requestType === 'rc-ev-matchContacts') {
      const phoneNumbers = payload.data.map(q => q.phoneNumber)
      const res = await match(phoneNumbers)
      sendMsgToRCIframe({
        type: 'MessageTransport-response',
        requestId,
        result: res
      }, true)
    }
  }
  return {
    services,
    handleRCEvents,
    isEngageVoice: true
  }
}

/**
 * init third party
 * could init dom insert etc here
 */
export async function initThirdParty () {
  // hanlde contacts events
  let userId = getUserId()
  rc.currentUserId = userId
  rc.cacheKey = 'contacts' + '_' + userId

  // get the html ready
  renderAuthButton()

  // if (rc.local.accessToken) {
  //   notifyRCAuthed()
  // }

  upgrade()

  initReactModule()
}
