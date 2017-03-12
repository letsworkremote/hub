import fs from 'fs'

fs.readFile('./build/config.json', 'utf-8', (err, res) => {
  if (err) {
    process.stderr.write(err.message)
    return process.exit(1)
  }
  const config = JSON.parse(res)
  process.stdout.write(config[process.argv[process.argv.length - 1]])
})
