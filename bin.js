#!/usr/bin/env node

var pull = require('pull-stream')
var Client = require('ssb-client')
var sort = require('ssb-sort')
var parallel = require('run-parallel')

var rootMessageId = process.argv[2]

if (rootMessageId == null) {
  console.log('usage: ssb-reveal <rootMessageId>')
} else {
  run()
}

function run () {
  Client(function (err, client) {
    if (err) throw err

    parallel(
      [
        cb => getMessage({ client, messageId: rootMessageId }, cb),
        cb => getThreadRepliesByRootId({ client, rootMessageId }, cb),
        cb => client.about.get(cb)
      ],
      function (err, [rootMessage, threadReplies, about]) {
        if (err) throw err

        var thread = [rootMessage, ...threadReplies]
        thread.forEach(function (message, index) {
          if (index === 0) {
            console.log(`- ${formatMessageLink({ message, about })}`)
          } else {
            console.log(`  - ${formatMessageLink({ message, about })}`)
          }
        })

        client.close()
      }
    )
  })
}

function formatMessageLink ({ message, about }) {
  var authorName = about[message.value.author]['name'][message.value.author][0]
  var time = formatTimestamp(message.value.timestamp)
  return `[${time} : ${authorName}](${message.key}?unbox=${message.value.unbox})`
}

function formatTimestamp (timestamp) {
  var date = new Date(timestamp)
  var year = date.getUTCFullYear()
  var month = date.getUTCMonth()
  var day = date.getUTCDate()
  var hours = date.getUTCHours()
  var minutes = date.getUTCMinutes()
  return `${pad(year)}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}`
}

function pad (number) {
  return number < 10 ? `0${number}` : number
}

// wrap client.get to be same format as returned by indexes
function getMessage ({ client, messageId }, cb) {
  client.get(
    {
      private: true,
      id: rootMessageId
    },
    function (err, message) {
      if (err) cb(err)
      else cb(null, { key: messageId, value: message })
    }
  )
}

function getThreadRepliesByRootId ({ client, rootMessageId }, cb) {
  var query = [
    {
      $filter: {
        value: {
          content: {
            root: rootMessageId
          },
          timestamp: {
            $gt: 1
          }
        }
      }
    }
  ]

  pull(
    client.query.read({ query }),
    pull.collect(function (err, messages) {
      if (err) return cb(err)

      cb(null, sort(messages))
    })
  )
}

