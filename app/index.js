const express = require('express')
const proxy = require('http-proxy-middleware')
const morgan = require('morgan')
const chalk = require('chalk')
const _ = require('lodash')
const config = require('./src/config')
const bodyParser = require('body-parser')

const admin = require('./src/routes/admin')

process.on('uncaughtException', function (error) {
  console.error(error.message)
})

const only = () => {
  return function (tokens, req, res) {
    const status = tokens.status(req, res)
    const color = status < 400 ? 'green' : 'red'
    return chalk[color]([
      tokens.method(req, res),
      // tokens.url(req, res),
      status,
      tokens.res(req, res, 'content-length'), '-',
      tokens['response-time'](req, res), 'ms'
    ].join(' '))
  }
}

const setHeaders = (who) => {

  return function onProxyRes(proxyRes, req, res) {

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type,Accept')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')

    const env = config.getEnv()

    if (env.verbose) {
      const oldWrite = res.write,
          oldEnd = res.end

      const chunks = []

      res.write = function (chunk) {
        chunks.push(new Buffer(chunk))

        oldWrite.apply(res, arguments)
      }

      res.end = function (chunk) {
        if (chunk)
          chunks.push(new Buffer(chunk))

        let body = Buffer.concat(chunks).toString('utf8').replace(/\n+$/g, '')
        console.log(chalk.bold(chalk.cyan(who), req.path), chalk.gray(`\n[Output]`), env.formatJson ? JSON.stringify(JSON.parse(body), null, 2) : body)

        oldEnd.apply(res, arguments)
      }
    }
  }
}

function onProxyReq(proxyReq, req, res) {
  const env = config.getEnv()
  let done = false

  if (env.verbose) {
    if (env.showQueryString && _.keys(req.query).length) {
      console.log('\n')
      console.log(chalk.gray('[QueryString]'), JSON.stringify(req.query, null, env.formatJson ? 2 : null))
      done = true
    }

    if (env.showBody && req.method === "POST" && _.keys(req.body).length) {
      if (!done) {
        console.log('\n')
      }
      console.log(chalk.gray('[PostBody]'), JSON.stringify(req.body, null, env.formatJson ? 2 : null))
    }
  }

  if (req.method === "POST") {
    let bodyData = JSON.stringify(req.body)
    proxyReq.setHeader('Content-Type', 'application/json')
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData))
    proxyReq.write(bodyData)
  }
}

function onError(err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  })
  res.end(err)
}

const setApp = (name, port0, port) => {
  const app = express()
  app.use(morgan(only()))
  app.use(bodyParser.json())
  app.use('/favicon.ico', function (req, res) {
    res.send('')
  })
  if (name === 'FULL-NODE') {
    app.use('/admin', admin)
  }
  app.use('/', proxy({
    changeOrigin: true,
    onProxyReq,
    onProxyRes: setHeaders(name),
    onError,
    target: `http://127.0.0.1:${port0}`
  }))
  app.listen(port)

}


setApp('FULL-NODE', 18190, 8090)
setApp('SOLIDITY-NODE', 18191, 8091)
setApp('EVENT-SERVER', 18891, 8092)

const n = "\n"

console.log(n, 'Full Node listening on', chalk.bold('http://127.0.0.1:8090'),
    n, 'Solidity Node listening on', chalk.bold('http://127.0.0.1:8091'),
    n, 'Event Server listening on', chalk.bold('http://127.0.0.1:8092'), n)

