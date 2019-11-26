const fs = require('fs')
const path = require('path')

// 谷歌翻译的接口
const createLink = text => `https://translate.google.cn/#view=home&op=translate&sl=en&tl=zh-CN&text=${text}`
const createAudioLink = text => `https://translate.google.cn/translate_tts?ie=UTF-8&q=${text}&tl=en&total=1&idx=0&textlen=5&tk=473558.103757&client=webapp&prev=input`

// 文件所在的地方
const filesPath = path.resolve(__dirname, './text')

function main () {
  const files = getTextFiles(filesPath)
  // 最新修改的放最上面
  files.sort((a, b) => b.mtime - a.mtime)
  const ast = files.map(({ mtime, fn }) => createAst(mtime, fn()))
  genMarkdown(ast)
}

// 获取文件内容
function getTextFiles (pt) {
  const fns = []
  const files = fs.readdirSync(pt)
  const fn = p => fs.readFileSync(p).toString()

  files.forEach(p => {
    const currentPath = path.join(pt, p)
    const infor = fs.statSync(currentPath)
    if (infor.isDirectory()) {
      fns.push.apply(fns, getTextFiles(currentPath))
    } else {
      fns.push({
        mtime: infor.mtime,
        fn: () => fn(currentPath)
      })
    }
  })
  return fns
}

// 生成简单的 ast
function createAst (mtime, source) {
  source = source.trim()
  if (!source) return []
  const lines = source.split('\n')
  const result = lines.map(line => {
    line = line.trim()
    const match = /([^:]+):(.+)/g.exec(line)
    if (match) {
      return {
        word: match[1].trim(),
        link: match[2].trim(),
      }
    }
    return {
      word: line,
      link: null,
    }
  })
  result.mtime = convertTime(mtime)
  return result
}

function convertTime (date) {
  const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : '0' + n
  }
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  const datestr = [year, month, day].map(formatNumber).join('-')
  const timestr = [hour, minute, second].map(formatNumber).join(':')
  return datestr + ' ' + timestr
}

// 生成 markdown 文件
function genMarkdown (ast) {
  const day = ast.length
  const len = ast.reduce((total, val) => total + val.length, 0)
  const code = joinString(`## 总共 **${day}** 天，包含 **${len}** 个单词`)
  
  ast.forEach((part, i) => {
    if (part.length === 0) return
    code(`### 第 **${i}** 部分，总共 **${part.length}** 个单词`, true)

    part.forEach((wordInfo, i) => {
      code(genSingleItem(wordInfo, i))
    })
  })
}

function genSingleItem ({ word, link }, idx) {
  const googleLink = createAst(word)
  const audioLink = createAudioLink(word)
  return `${idx}. <audio src="${audioLink}"></audio>`
}

function joinString (title) {
  let code = title + '\n\n'
  return (string, isTitle) => {
    if (typeof string !== 'string') {
      return code
    }
    code += (
      string + isTitle
        ? '\n'
        : ''
    )
  }
}

main()