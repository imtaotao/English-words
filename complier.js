const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

// 谷歌翻译的接口
const createLink = text => `https://translate.google.cn/#view=home&op=translate&sl=en&tl=zh-CN&text=${text}`
const createAudioLink = text => `https://translate.google.cn/translate_tts?ie=UTF-8&q=${text}&tl=en&total=1&idx=0&textlen=5&tk=473558.103757&client=webapp&prev=input`

// 文件所在的地方
const filesPath = path.resolve(__dirname, './text')
const historyPath = path.resolve(__dirname, './history') 
const destPath = path.resolve(__dirname, './README.md')

// ------------- 编译部分 ---------------------------------
async function main () {
  const files = getTextFiles(filesPath)
  // 最新修改的放最上面
  files.sort((a, b) => b.mtime - a.mtime)

  const ast = files.map(({ mtime, fn }) => createAst(mtime, fn()))
  const code = genMarkdown(ast)
  await genFile(code)
  console.log('\n√ Compiled.\n')
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
    code(`### 第 **${i + 1}** 部分，总共 **${part.length}** 个单词`)

    part.forEach((wordInfo, i) => {
      code(genSingleItem(wordInfo, i))
    })

    // 换行
    code('', 2)
  })
  return code()
}

function genSingleItem ({ word, link }, idx) {
  const googleLink = createLink(word)
  const audioLink = createAudioLink(word)
  let baseContent = `${idx}. [${word}](${googleLink})`
  if (link) {
    baseContent += ` --- \`[相关链接](${link})\``
  }
  return baseContent
}

function joinString (title = '') {
  let code = title + '\n\n'
  return (string, n = 1) => {
    if (typeof string !== 'string') {
      return code
    }
    code += string + '\n'.repeat(n)
  }
}

async function genFile (code) {
  const transferfile = (from, to) => {
    return new Promise(resolve => {
      const readable = fs.createReadStream(from)
      readable.on('open', () => readable.pipe(fs.createWriteStream(to)))
      readable.on('end', resolve)
    })
  }
  const getLegalPath = (array, name, i = 0) => {
    const fixname = `${i}.${name}`
    return array.includes(fixname)
      ? getLegalPath(array, name, ++i)
      : fixname
  }
  const gen = () => new Promise(resolve => {
    fs.createWriteStream(destPath).end(code, resolve)
  })

  if (fs.existsSync(destPath)) {
    // 先备份到历史记录中
    if (!fs.existsSync(historyPath)) {
      fs.mkdirSync(historyPath)
    }
    const historyFiles = fs.readdirSync(historyPath)
    const copyPath = getLegalPath(historyFiles, path.basename(destPath))
    await transferfile(destPath, path.resolve(historyPath, copyPath))
    return gen()
  }
  return gen()
}

// ------------- 提交到仓库 ---------------------------------
function cmd (command, exit = true) {
  return new Promise ((resolve, reject) => {
    console.log(`\n---------- ${command} ------------\n`)
    exec(command, (error, stdout, stderror) => {
      if (error || stderror) {
        console.error('[Error]: ' + (error || stderror))
        exit
          ? process.exit(1)
          : reject()
        return
      }
      console.log('[OK]: ' + stdout)
      resolve()
    })
  })
}

async function submit () {
  await cmd('git pull', false)
  await cmd('git add .')
  await cmd('git commit -m "feat: add new words"')
  await cmd('git push')
}

// ------------- 运行 ---------------------------------
main().then(submit).then(() => {
  console.log('\n√ Complete\n')
})