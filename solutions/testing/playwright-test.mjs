import spawn from 'cross-spawn'
import arg from 'arg'
import chokidar from 'chokidar'

const args = arg(
  {
    // Types
    '--help': Boolean,
    '--integration': Boolean,
    '--e2e': Boolean,
    '--pause-on-failure': [Boolean],
    '--watch': Boolean,
    // '--debug': Boolean,
    '--chromium': Boolean,

    // Aliases
    '-h': '--help',
    '-i': '--integration',
    '-e': '--e2e',
    '-p': '--pause-on-failure',
    '-w': '--watch',
    '-c': '--chromium',
    // '-d': '--debug',
  },
  { permissive: true }
)

const testType = args['--integration']
  ? 'integration'
  : args['--e2e']
  ? 'e2e'
  : null

const pauseOnFailure = args['--pause-on-failure']

const run = (options, ...paths) =>
  new Promise((resolve, reject) => {
    const argsToForward = args._
    const testArgs = ['test']
    const env = { ...process.env }

    if (testType) env.TEST_TYPE = testType

    if (!argsToForward.includes('--config')) {
      testArgs.push('--config', 'playwright/playwright.config.ts')
    }

    if (args['--chromium'] && !argsToForward.includes('--project=chromium')) {
      testArgs.push('--project=chromium')
    }

    // if (args['--debug'] && !argsToForward.includes(''))

    if (pauseOnFailure) {
      env.PAUSE_ON_FAILURE = true

      if (!argsToForward.includes('--headed')) {
        testArgs.push('--headed')
      }
    }

    const instance = spawn(
      'playwright',
      [...testArgs, ...argsToForward, ...paths],
      { stdio: 'inherit', env }
    )

    if (options?.verbose !== false) {
      console.log('>', instance.spawnargs.join(' '))
      if (testType || pauseOnFailure) {
        console.log(
          `> env: ${testType ? `TEST_TYPE=${testType}` : ''} ${
            pauseOnFailure ? 'PAUSE_ON_FAILURE=true' : ''
          }`
        )
      }
    }

    instance.on('close', () => {
      resolve()
    })
    instance.on('error', (error) => {
      reject(error)
    })
  })

const watch = () =>
  new Promise((_, reject) => {
    const integrationPath = 'playwright/integration/tests/**/*.spec.ts'
    const e2ePath = 'playwright/e2e/tests/**/*.spec.ts'
    const paths =
      testType === 'integration'
        ? integrationPath
        : testType === 'e2e'
        ? e2ePath
        : [integrationPath, e2ePath]

    const watcher = chokidar.watch(paths, {
      ignoreInitial: true,
      // Prevents changes from being registered multiple times
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    })

    function handlePath(path) {
      console.log('>', path)
      run({ verbose: false }, path).catch((error) => {
        console.error('An error happened using Playwright for:', path)
        console.error(error)
      })
    }

    watcher.on('add', handlePath)
    watcher.on('change', handlePath)
    watcher.on('error', reject)
    watcher.on('ready', () => console.log('Watching for file changes...\n'))
  })

if (args['--watch']) {
  await watch()
} else {
  await run()
}
