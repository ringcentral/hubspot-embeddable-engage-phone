import { render } from 'react-dom'
import {
  createElementFromHTML
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import App from './react-index'

export function initReactModule () {
  const id = 'rc-react-module'
  let rootElement = document.getElementById(id)
  rootElement = createElementFromHTML(`<div id="${id}"></div>`)
  const home = document.getElementById('engage-voice-embeddable')
  if (!home) {
    return setTimeout(initReactModule, 1000)
  }
  home.appendChild(rootElement)
  render(
    <App />,
    rootElement
  )
}
