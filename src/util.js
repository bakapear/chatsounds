let readline = require('readline')
let https = require('https')

module.exports = {
  write (msg) {
    readline.cursorTo(process.stdout, 0)
    readline.clearLine(process.stdout)
    process.stdout.write(msg)
  },
  fetch (url, opts = {}) {
    let out = new Promise((resolve, reject) => {
      let req = https.get(url, opts, (res, data = '', error = false) => {
        if (res.statusCode >= 400) error = true
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          res.body = data
          if (error) reject(res)
          else resolve(res)
        })
      })
      req.on('error', e => reject(e))
      req.end()
    })

    out.text = () => Promise.resolve(out).then(p => p.body)
    out.json = () => Promise.resolve(out).then(p => JSON.parse(p.body))

    return out
  }
}
