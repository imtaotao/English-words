const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

// 谷歌翻译的接口
const createLink = text => `https://translate.google.cn/#view=home&op=translate&sl=en&tl=zh-CN&text=${encodeURIComponent(text)}`
const createAudioLink = text => {
  const tk = createTK(text)
  const total = text.length
  return `http://translate.google.cn/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&total=1&idx=0&textlen=${total}&tk=${tk}&client=webapp&prev=output`
}

// 文件所在的地方
const filesPath = path.resolve(__dirname, './text')
const historyPath = path.resolve(__dirname, './history') 
const destPath = path.resolve(__dirname, './README.md')

// ------------- 生成 tk 值 ---------------------------------
// 找来的，不是很清楚具体的算法
function createTK (a) {
  a = a.trim()
  const b = 406644
  const b1 = 3293161072
  const jd = "."
  const $b = "+-a^+6"
  const Zb = "+-3^+b+-f"

  for (var e = [], f = 0, g = 0; g < a.length; g++) {
    let m = a.charCodeAt(g)
    128 > m ? e[f++] = m : (2048 > m ? e[f++] = m >> 6 | 192 : (55296 == (m & 64512) && g + 1 < a.length && 56320 == (a.charCodeAt(g + 1) & 64512) ? (m = 65536 + ((m & 1023) << 10) + (a.charCodeAt(++g) & 1023),
    e[f++] = m >> 18 | 240,
    e[f++] = m >> 12 & 63 | 128) : e[f++] = m >> 12 | 224,
    e[f++] = m >> 6 & 63 | 128),
    e[f++] = m & 63 | 128)
  }
  a = b;
  for (f = 0; f < e.length; f++) a += e[f],
  a = RL(a, $b);
  a = RL(a, Zb);
  a ^= b1 || 0;
  0 > a && (a = (a & 2147483647) + 2147483648);
  a %= 1E6;
  return a.toString() + jd + (a ^ b)
}

function RL (a, b) {
  const t = "a";
  const Yb = "+";
  for (let c = 0; c < b.length - 2; c += 3) {
    var d = b.charAt(c + 2),
    d = d >= t ? d.charCodeAt(0) - 87 : Number(d),
    d = b.charAt(c + 1) == Yb ? a >>> d: a << d;
    a = b.charAt(c) == Yb ? a + d & 4294967295 : a ^ d
  }
  return a
}

// ------------- 编译部分 ---------------------------------
async function main () {
  console.log('chentao')
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
      link: null,
      word: line.replace(/:/g, '').trim(),
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
  const code = joinString(`## **${day}** days in total，**${len}** words`)
  
  ast.forEach((part, i) => {
    if (part.length === 0) return
    code(`#### Part **${i + 1}** of **${part.length}** words`)
    code(`Last modified time: \`${part.mtime}\``)

    part.forEach((wordInfo, i) => {
      code(genSingleItem(wordInfo, i))
    })

    // 换行
    code('', 2)
  })
  return code()
}

function genSingleItem ({ word, link }, idx) {
  if (!word) return ''
  const googleLink = createLink(word)
  const audioLink = createAudioLink(word)
  let baseContent = `+ [\`${word}\`](${googleLink}) --- [v](${audioLink})`
  if (link) {
    baseContent += ` --- [l](${link})`
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
  const getLegalPath = (array, name, i = 1) => {
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
const argv = process.argv
const clg = () => console.log('\n√ Complete\n')
if (argv.includes('-c')) {
  main().then(clg)
} else if (argv.includes('-m')) {
  submit().then(clg)
} else if (argv.includes('-w')) {
  let i = 0
  fs.watch(filesPath, async () => {
    console.clear()
    await main()
    console.log('Rebuild: ' + ++i)
  })
} else {
  main().then(submit).then(clg)
}