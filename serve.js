let R = require('ramda')

function serve({ 
  process, 
  express,
  cors,
  bodyParser, 
  wrap, 
  assignBadge, 
  isRequestValid,
  getAllUsernames,
  getUserByUsername,
  getUserFields,
  handlePostCreated
}) {

  let app = express()

  app.use(cors())

  // pretty hacky solution to get rawbody, too tired 
  // to figure better solution out
  // From: https://coderwall.com/p/qrjfcw/capture-raw-post-body-in-express-js
  let rawBodySaver = function (req, res, buf, encoding) {
    if (buf && buf.length) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
  app.use(bodyParser.json({ verify: rawBodySaver }))
  app.use(bodyParser.urlencoded({ extended: false, verify: rawBodySaver }))
  app.use(bodyParser.raw({ verify: rawBodySaver, type: function () { return true } }))
 

  app.post('/webhook', wrap(async function(req, res) {
    if (!isRequestValid(req)) {
      res.status(403).send('invalid signature')
      return
    }
      
    if(req.headers['x-discourse-event'] === 'user_created') {
      let { username, created_at } = req.body.user
      let date = new Date(Date.parse(created_at))
      let year = date.getFullYear()
      let month = date.getMonth()
      // only assign this badge for ppl in aug
      if (!(month === 7 && year === 2017)){
        res.status(200).send('carry on')
        return
      }
      let SPECIAL_FOREVER_BADGE_ID = 102
      await assignBadge({ username, badgeId: SPECIAL_FOREVER_BADGE_ID })
      console.log(`Assigned special forever badge to ${username}`)
      res.status(200).send('ok')
    } else if (req.headers['x-discourse-event'] === 'post_created') {
      let {
        username,
        topic_slug,
        topic_id,
        post_number
      } = req.body.post

      await handlePostCreated({
        username,
        topicSlug: topic_slug,
        topicId: topic_id,
        postNumber: post_number
      })
      res.status(200).send('ok')

    } else if(req.headers['x-discourse-event'] === 'user_updated') {

      let hackableDataCache = state.cache.result.data  
      if (!hackableDataCache) {
        res.status(200).send('carry on')
      } else {
        let hackableJSON = req.body.user.user_fields[''+fieldId]
        if (!hackableJSON) {
          res.status(200).send('carry on')
          return
        }
        let cachedUser = hackableDataCache
          .find(user => user.username === req.body.user.username)
        if (cachedUser) {
          let fieldId = await fetchHackableJSONFieldId()
          cachedUser.hackable_json = hackableJSON
        } else {
          hackableDataCache.push({
            username: req.body.user.username,
            hackable_json: hackableJSON
          })
        }
        res.status(200).send('carry on')
      }
    } else {
      res.status(200).send('carry on')
    }
    
  }))

  app.get('/', (req,res) => {
    res.send('k')
  })

  const nowInMs = () => Number(new Date())
  
  const resultCacheMaxAge = 1000 * 60 * 10

  let state = {
    cache: {
      result: {
        isRefreshing: false,
        data: null,
        expires: -1
      }
    }
  }

  app.get('/hackable-data', wrap(async function(req, res) {

    if (state.cache.result.expires < nowInMs()) {
      console.log('Result cache expired, issuing refresh ...')
      refreshResultCache()
    }

    if (!state.cache.result.data) {
      return res.status(503).json({ 
        error_code: 'warming_up', 
        error_message: 'Warming up caches, please retry in a minute' 
      })
    }

    return res.json(state.cache.result.data)
  }))

  async function fetchHackableJSONFieldId() {
    let userFields = await getUserFields()
    let jsonField = userFields.find(x => x.name === 'Hackable JSON')
    return jsonField.id
  }

  async function refreshResultCache() {
    if (state.cache.result.isRefreshing) return

    state.cache.result.isRefreshing = true
    
    let fieldId = await fetchHackableJSONFieldId()

    let usernames = await getAllUsernames()

    let allUserDatas = []
    let batch = []
    async function processBatch() {
      let userDatas = await Promise.all(batch.map(getUserByUsername))
      allUserDatas = allUserDatas.concat(userDatas)
      console.log(`Loaded user data for ${batch.join(', ')}`)
      batch = []
    }
    for (let username of usernames) {
      if (batch.length < 10) {
        batch.push(username)
      } else {
        await processBatch()
      }
    }
    await processBatch()

    console.log('All userdata loaded.')

    const 
      removeDuplicateUsers = R.pipe(
        R.reduce((lookup, user) => {
          lookup[user.username] = user
          return lookup
        }, {}),
        R.values
      ),
      filterUsersWithField = fieldId => R.filter(userData => 
        userData.user.user_fields && 
        userData.user.user_fields['' + fieldId]
      )

    const makeResult = R.pipe(
      filterUsersWithField(fieldId),
      R.map(userData => ({
        username: userData.user.username,
        hackable_json: userData.user.user_fields['' + fieldId]
      })),
      removeDuplicateUsers
    )

    state.cache.result = {
      isRefreshing: false,
      data: makeResult(allUserDatas), 
      expires: nowInMs() + resultCacheMaxAge
    }
  }

  process.on('unhandledRejection', function(reason){
    console.error('Unhandled rejection', reason)
    process.exit(1)
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception', err)
    process.exit(1)
  });
  
  const port = process.env.PORT || 3001
  app.listen(port, () => {
    console.log(`Listening on port ${port}!`)
  })
}




module.exports = serve