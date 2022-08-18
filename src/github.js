let { fetch } = require('./util')

let DEFAULT_BRANCH = 'master'
let OPTS = { headers: { 'User-Agent': 'carrot' } }

module.exports = {
  formatRepo (str) {
    let match = str.match(/^(.*?\/.*?)(?:\/(.*?))?(?:$|:)(.*)/).slice(1)
    if (!match[1]) match[1] = DEFAULT_BRANCH
    return match
    // [repo, branch, path]
  },
  async getTree (repostr, tree, recursive = true) {
    let [repo, branch] = this.formatRepo(repostr)
    return await fetch(`https://api.github.com/repos/${repo}/git/trees/${tree || branch}?recursive=${Number(recursive)}`, OPTS).json().catch(e => {
      let err = null
      try { err = JSON.parse(e.body).message } catch (_) { err = e }
      throw new Error(err)
    })
  },
  toRawFile (str) {
    let [repo, branch, path] = this.formatRepo(str)
    return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
  }
}
