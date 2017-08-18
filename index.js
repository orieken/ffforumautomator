let crypto = require('crypto')

let express = require('express')
let bodyParser = require('body-parser')

let fetch = require('node-fetch')
let baseUrl = 'https://www.funfunforum.com'
let apiKey = '95dd6ff1568aee96381f31bbb3f2fbf4653ae33ff426dec7dc2250f85da6ab7a'
let webhookSecret = 'cA3yDzaQsJquW}TjzyQKz'

let isRequestValid = require('./isrequestvalid').bind(null, {
  crypto,
  webhookSecret
})

let assignBadge = require('./assignbadge').bind(null, {
  fetch,
  baseUrl,
  apiKey
})

let getAllUsernames = require('./getallusernames').bind(null, {
  fetch,
  baseUrl,
  apiKey
})

let serve = require('./serve').bind(null, {
  express,
  bodyParser,
  assignBadge,
  isRequestValid
})

serve()
/*
async function go() {
  let usernames = await getAllUsernames()
  console.log('usernames', usernames)
  
  for(username of usernames) {
    await assignBadge({
      apiKey,
      username,
      badgeId: SPECIAL_FOREVER_BADGE_ID
    })
    console.log(`assigned badge to ${username}`)
  }
}

go().then(() => console.log('done!'))*/


