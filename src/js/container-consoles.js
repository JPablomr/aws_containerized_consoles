/* global browser */

const arnToContainerName = (arn) => {
  let account, role
  [account, role] = arn.split(':').slice(-2)
  role = role.replace('role/', '')
  return `${account}-${role}`
}

const readyCheck = (_ => {
  const message = '<span> Console will open in a separate Firefox container.</span>'
  const aDiv = document.createElement('div')
  aDiv.style.margin = '10px auto'
  aDiv.style.maxWidth = '500px'
  aDiv.innerHTML = message
  return aDiv
})()

function sendToBackground(value) {
  const containerName = arnToContainerName(value)
  browser.runtime.sendMessage({
    data: containerName
  })
}

function attachListeners () {
  const accountClass = 'saml-radio'
  const accounts = document.getElementsByClassName(accountClass)
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    account.addEventListener('click', function(){ sendToBackground(this.value) })
    // Catch if an account had been clicked already
    if (account.checked) {
      sendToBackground(account.value)
    }
  }
  document.getElementById('saml_form').insertAdjacentElement('afterend', readyCheck)
}

attachListeners()
