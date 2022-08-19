#! /usr/bin/env node
process.chdir(__dirname)

let util = require('../src/util.js')
let child = require('child_process')
let readline = require('readline')
let ChatSounds = require('../src')

setTitle('chatsounds')
clearLines()

let CODES = {
  red: '\u001b[31;1m',
  blue: '\u001b[36m',
  gray: '\u001b[30;1m',
  yellow: '\u001b[33m',
  reset: '\u001b[0m',
  showCursor: '\u001B[?25h',
  hideCursor: '\u001B[?25l'
}

let CURSOR = '█'

child.exec('ffplay -version').stderr.on('data', () => { throw Error('ffplay not found!') })

let players = []
let master = null
let cs = null

function setTitle (title) {
  process.stdout.write(String.fromCharCode(27) + ']0;' + title + String.fromCharCode(7))
}

function clearLines () {
  for (let i = 0; i < process.stdout.rows; i++) {
    readline.moveCursor(process.stdout, 0, -1)
    readline.clearLine(process.stdout)
  }
  readline.cursorTo(process.stdout, 0, process.stdout.rows - 1)
  readline.clearLine(process.stdout)
}

function showMatches (input, size, pointer) {
  if (!size) size = process.stdout.rows - 1

  let matches = cs.query(input)

  matches.length = matches.length > size ? size : matches.length

  pointer = (pointer ?? -1) % matches.length
  clearLines()

  let current = null

  for (let i = 0; i < matches.length; i++) {
    readline.cursorTo(process.stdout, 0)
    readline.moveCursor(process.stdout, 0, -1)

    let txt = matches[i].match
    txt = txt.slice(0, process.stdout.columns)

    if (pointer === i) {
      if (txt.length + 2 > process.stdout.columns) txt = txt.slice(0, -2)
      txt = `[${CODES.yellow}${txt}${CODES.reset}]`
      current = matches[i]
    } else txt = `${CODES.gray}${txt}${CODES.reset}`

    process.stdout.write(txt)
  }

  readline.cursorTo(process.stdout, 0, process.stdout.rows - 1)

  input = CODES.blue + input
  input = input.replaceAll('#', CODES.red + '#')
  input += CODES.reset

  process.stdout.write(input + CURSOR)

  readline.cursorTo(process.stdout, process.stdout.columns)

  return current
}

function play (url) {
  let app = child.spawn('ffplay', [url, '-nodisp', '-autoexit']) // lifesaver?
  players.push(app)
  app.on('exit', () => {
    let player = players.findIndex(x => x.pid === app.pid)
    if (player !== -1) players.splice(player, 1)
  })
}

function doAction (match) {
  let matches = cs.decode(match)
  let sound = matches[Math.floor(Math.random() * matches.length)]
  console.log(sound)
  play(sound)
}

async function main (cfg) {
  readline.createInterface({ input: process.stdin, output: process.stdout })

  master = await util.fetch(cfg.master).text().catch(() => {
    throw Error('Could not fetch master file @ ' + cfg.master)
  })

  let config = await util.fetch(cfg.config).json().catch(() => {
    throw Error('Could not fetch config file @ ' + cfg.config)
  })

  // setTitle(`chatsounds ${master ? '' : '(local)'}`.trim())

  cs = new ChatSounds(config /* '../data/config.json' */, master.split('\n') /* '../data/master.list' */)

  process.on('exit', () => {
    players.forEach(x => x.kill())
    process.stdout.write(CODES.showCursor)
  })
  process.stdout.write(CODES.hideCursor)

  let str = ''
  let pointer = 0
  let current = null

  process.stdin.on('data', buffer => {
    for (let code of buffer) {
      if (code === 3) process.exit()
      if (code === 13) {
        clearLines()
        if (current) {
          doAction(current)
        }
        process.stdout.write(CURSOR)
        str = ''
        return
      } else if (code === 27) {
        players.forEach(x => x.kill())
      } else if (code === 8) {
        str = str.slice(0, -1)
        pointer = 0
      } else if (code === 9) pointer++
      else {
        str += String.fromCharCode(code)
        pointer = 0
      }
    }
    current = showMatches(str, null, pointer)
  })
}

main({
  config: 'https://raw.githubusercontent.com/bakapear/chatsounds/main/data/config.json',
  master: 'https://raw.githubusercontent.com/bakapear/chatsounds/main/data/master.list'
})
