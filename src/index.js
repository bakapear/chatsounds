let fs = require('fs')
let github = require('./github')

class ChatSounds {
  constructor (config, master) {
    this.cfg = typeof config === 'object' ? config : require(config)

    this.master = Array.isArray(master) ? master : fs.readFileSync(master, 'utf-8').split('\n')

    this.table = [this.cfg.chatsounds, this.cfg.gamesounds].reduce((prev, cur) => {
      let entries = Object.entries(cur)
      for (let entry of entries) {
        let [key, values] = entry
        if (!Array.isArray(values)) values = [values]
        for (let value of values) prev[value] = key
      }
      return prev
    }, {})

    this.keys = Object.keys(this.table)
  }

  query (keyword) {
    keyword = keyword.toLowerCase().trim()
    if (!keyword) return []

    let results = []

    for (let i = 0; i < this.master.length; i += 2) {
      let match = this.master[i]
      let index = match.indexOf(keyword)

      if (index >= 0) {
        results.push({
          match,
          index: i,
          score: (1 - (index / keyword.length)) + (1 - (match.length / keyword.length))
        })
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  decode (match) {
    let files = this.master[match.index + 1].split('|')
    return files.map(file => {
      let split = file.indexOf(':')
      let repo = file.slice(0, split)
      let path = file.slice(split + 1)
      repo = this.keys[parseInt(repo, 36)]

      return github.toRawFile(repo + ':' + this.table[repo] + '/' + path)
    })
  }
}

module.exports = ChatSounds
