import { Tooltip } from 'antd'
import { useState, useEffect } from 'react'
import { SyncOutlined } from '@ant-design/icons'
// import * as ls from 'ringcentral-embeddable-extension-common/src/common/ls'
import { getContacts } from './contacts'

export default function Index () {
  const [syncing, setSync] = useState(false)
  const title = syncing
    ? 'Syncing contact data to Engage Voice widget, please wait'
    : 'Sync contact data to Engage Voice widget, you should do this once you add or change contact info'

  function handleClick () {
    if (syncing) {
      return
    }
    window.postMessage({
      type: 'rc-sync-ev-contacts'
    }, '*')
    // setSync(true)
  }

  function onEvent (e) {
    if (e && e.data && e.data.type === 'rc-sync-contact-finished') {
      setSync(false)
    }
  }

  useEffect(() => {
    console.log('run useEffect')
    window.addEventListener('message', onEvent)
    getContacts()
    return () => {
      window.removeEventListener('message', onEvent)
    }
  })
  return (
    <Tooltip title={title} overlayStyle={{ zIndex: 100000 }}>
      <div className='pointer rc-sync-btn-1'>
        <SyncOutlined
          spin={syncing}
          onClick={handleClick}
        />
      </div>
    </Tooltip>
  )
}
