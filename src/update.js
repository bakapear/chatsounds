process.chdir(__dirname)

let fs = require('fs')
let util = require('./util')
let github = require('./github')

async function fetchSoundList (list, output) {
  let out = []

  for (let path in list) {
    let repos = [list[path]].flat()

    for (let repo of repos) {
      let { tree } = await github.getTree(repo, null, true)

      for (let i = 0; i < tree.length; i++) {
        let file = tree[i]

        if (file.type !== 'blob' || !file.path.startsWith(path)) continue

        let sub = file.path.slice(path.length + 1).trim()

        out.push(`${repo}:${sub}`)

        util.write(`[${output}] ${repo} (${((i + 1) * 100 / tree.length).toFixed(2)}%)`)
      }
    }
  }

  fs.writeFileSync(output, out.join('\n'))
  util.write(`[${output}] Saved ${out.length} paths.\n`)
}

async function fetchLuaMaps (lua, output) {
  let out = []

  let { tree } = await github.getTree(lua.repo, lua.tree, true)
  for (let i = 0; i < tree.length; i++) {
    let file = tree[i]

    if (file.type !== 'blob') continue

    out.push(`${lua.repo}:${lua.path + '/' + file.path}`)

    util.write(`[${output}] (${((i + 1) * 100 / tree.length).toFixed(2)}%)`)
  }

  fs.writeFileSync(output, out.join('\n'))
  util.write(`[${output}] Saved ${out.length} maps.\n`)
}

function parseLuaMap (raw, replace) {
  let matches = raw.matchAll(/(?:L\["(.*?)"]|path.*?=.*?"(.+?)")/g)

  let out = {}
  let key = null

  for (let match of matches) {
    let [, a, b] = match

    if (a) key = a

    if (key) {
      if (!Object.hasOwn(out, key)) out[key] = []
      else if (b) {
        if (replace) b = replace(b, key)
        out[key].push(b)
      }
    }
  }

  return out
}

async function mapGameSounds (luamaps, gamesounds, output) {
  let maps = fs.readFileSync(luamaps, 'utf-8').split('\n')
  let sounds = fs.readFileSync(gamesounds, 'utf-8').split('\n')

  let res = {}

  for (let i = 0; i < maps.length; i++) {
    let lua = await util.fetch(github.toRawFile(maps[i])).text()

    let nl = false

    let body = parseLuaMap(lua, sound => {
      sound = sound.substr(0, sound.lastIndexOf('.') + 1)
      if (sound.startsWith('/')) sound = sound.slice(1)

      let s = sounds.find(x => x.indexOf(sound) > 0)
      if (!s) {
        console.error(`${!nl ? '\n' : ''}Could not map game sound: '${sound.slice(0, -1)}'`)
        nl = true
      }

      return s
    })

    res = { ...res, ...body }

    util.write(`[${output}] (${((i + 1) * 100 / maps.length).toFixed(2)}%)`)
  }

  let out = []

  for (let key in res) {
    let sounds = res[key].filter(x => x).join('|')
    if (sounds) out.push(`${key}|${sounds}`)
  }

  fs.writeFileSync(output, out.join('\n'))
  util.write(`[${output}] Saved ${out.length} sound paths.\n`)
}

async function mapChatSounds (chatsounds, output) {
  let sounds = fs.readFileSync(chatsounds, 'utf-8').split('\n')

  let res = {}
  let key = null

  let maps = []

  for (let i = 0; i < sounds.length; i++) {
    let sound = sounds[i]

    let path = sound.split(':').slice(1).join(':').split('/')

    if (!sound.endsWith('.ogg')) maps.push(sound)
    else {
      key = path[1]
      if (key.lastIndexOf('.') > 0) key = key.slice(0, key.lastIndexOf('.'))

      if (!res[key]) res[key] = []
      res[key].push(sound)
    }

    util.write(`[${output}] (${((i + 1) * 100 / sounds.length).toFixed(2)}%)`)
  }

  // maps = maps.filter(x => x.endsWith('map.txt')).map(x => x.slice(0, x.lastIndexOf('/')))
  // TODO: handle map.txt stuff?

  let out = []

  for (let key in res) {
    let sounds = res[key].filter(x => x).join('|')
    if (sounds) out.push(`${key}|${sounds}`)
  }

  fs.writeFileSync(output, out.join('\n'))
  util.write(`[${output}] Saved ${out.length} sound paths.\n`)
}

function mergeLists (lists, table, output) {
  let res = []

  for (let i = 0; i < lists.length; i++) {
    let file = lists[i]

    let list = fs.readFileSync(file, 'utf-8').split('\n')

    for (let j = 0; j < list.length; j++) {
      let line = list[j]

      let parts = line.split('|')
      let key = parts.shift()
      if (!Object.hasOwn(res, key)) res[key] = []
      res[key].push(...parts)

      util.write(`[${output}] ${i + 1}/${lists.length} (${((j + 1) * 100 / list.length).toFixed(2)}%)`)
    }
  }

  let out = []

  let regex = new RegExp(`(${table.join('|')}):`, 'g')

  for (let key in res) {
    let sounds = res[key].filter(x => x).join('|')
    if (sounds) {
      sounds = sounds.replace(regex, (a, b) => table.indexOf(b).toString(36) + ':')
      // out.push(`${key}|${sounds}`)
      out.push(key, sounds)
    }
  }

  fs.writeFileSync(output, out.join('\n'))
  util.write(`[${output}] Saved ${out.length} sound paths.\n`)
}

async function update (cfg, table, dir, output, game = true) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir)

  let out = {
    chatsounds: dir + '/chatsounds.list',
    gamesounds: dir + '/gamesounds.list',
    luamaps: dir + '/luamaps.list',
    chat: dir + '/chat.list',
    game: dir + '/game.list'
  }

  if (!game && !fs.existsSync(out.game)) {
    game = true
    delete out.game
  }

  // fetch
  await fetchSoundList(cfg.chatsounds, out.chatsounds)
  if (game) {
    await fetchSoundList(cfg.gamesounds, out.gamesounds)
    await fetchLuaMaps(cfg.luamaps, out.luamaps)
  }

  // map
  await mapChatSounds(out.chatsounds, out.chat)
  if (game) await mapGameSounds(out.luamaps, out.gamesounds, out.game)

  // merge

  mergeLists([out.chat, out.game], table, output)

  for (let p in out) fs.existsSync(out[p]) && fs.unlinkSync(out[p])
}

let cfg = require('../data/config.json')
let TABLE = [cfg.chatsounds, cfg.gamesounds].map(x => Object.values(x)).flat(2)
update(cfg, TABLE, '../data', '../data/master.list')
