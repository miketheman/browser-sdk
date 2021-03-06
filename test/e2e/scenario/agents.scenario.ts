import { LogsGlobal } from '@datadog/browser-logs'
import { RumEvent, RumEventCategory, RumResourceEvent, RumViewEvent } from '@datadog/browser-rum'
import {
  browserExecute,
  browserExecuteAsync,
  findLastEvent,
  flushBrowserLogs,
  flushEvents,
  renewSession,
  retrieveInitialViewEvents,
  retrieveLogs,
  retrieveLogsMessages,
  retrieveRumEvents,
  retrieveRumEventsTypes,
  sortByMessage,
  tearDown,
  withBrowserLogs,
} from './helpers'

beforeEach(() => {
  // tslint:disable-next-line: no-unsafe-any
  browser.url(`/${(browser as any).config.e2eMode}-e2e-page.html`)
})

afterEach(tearDown)

const UNREACHABLE_URL = 'http://localhost:9999/unreachable'

describe('logs', () => {
  it('should send logs', async () => {
    await browserExecute(() => {
      ;((window as any).DD_LOGS as LogsGlobal).logger.log('hello')
    })
    await flushEvents()
    const logs = await retrieveLogsMessages()
    expect(logs).toContain('hello')
  })

  it('should send errors', async () => {
    await browserExecute(() => {
      console.error('oh snap')
    })
    await flushEvents()
    const logs = await retrieveLogsMessages()
    expect(logs).toContain('console error: oh snap')
    await withBrowserLogs((browserLogs) => {
      expect(browserLogs.length).toEqual(1)
    })
  })

  it('should add RUM internal context to logs', async () => {
    await browserExecute(() => {
      ;((window as any).DD_LOGS as LogsGlobal).logger.log('hello')
    })
    await flushEvents()
    const log = (await retrieveLogs())[0]
    expect(log.application_id).toBe('rum')
    expect(log.view.id).toBeDefined()
  })
})

describe('rum', () => {
  it('should send errors', async () => {
    await browserExecute(() => {
      console.error('oh snap')
    })
    await flushEvents()
    const types = await retrieveRumEventsTypes()
    expect(types).toContain(RumEventCategory.ERROR)
    await withBrowserLogs((browserLogs) => {
      expect(browserLogs.length).toEqual(1)
    })
  })

  it('should track xhr timings', async () => {
    await browserExecuteAsync((baseUrl, done) => {
      let loaded = false
      const xhr = new XMLHttpRequest()
      xhr.addEventListener('load', () => (loaded = true))
      xhr.open('GET', `${baseUrl}/ok`)
      xhr.send()

      const interval = setInterval(() => {
        if (loaded) {
          clearInterval(interval)
          done(undefined)
        }
      }, 500)
    }, browser.options.baseUrl!)

    await flushEvents()
    const timing = (await retrieveRumEvents()).find(
      (event: RumEvent) =>
        event.evt.category === 'resource' && (event as RumResourceEvent).http.url === `${browser.options.baseUrl}/ok`
    ) as RumResourceEvent

    expect(timing as any).not.toBe(undefined)
    expect(timing.http.method).toEqual('GET')
    expect((timing.http as any).status_code).toEqual(200)
    expect(timing.duration).toBeGreaterThan(0)
    expect(timing.http.performance!.download.start).toBeGreaterThan(0)
  })

  it('should send performance timings along the view events', async () => {
    await flushEvents()
    const events = await retrieveRumEvents()

    const viewEvent = findLastEvent(events, (event) => event.evt.category === 'view') as RumViewEvent

    expect(viewEvent as any).not.toBe(undefined)
    const measures = viewEvent.view.measures
    expect((measures as any).dom_complete).toBeGreaterThan(0)
    expect((measures as any).dom_content_loaded).toBeGreaterThan(0)
    expect((measures as any).dom_interactive).toBeGreaterThan(0)
    expect((measures as any).load_event_end).toBeGreaterThan(0)
  })

  it('should create a new View when the session is renewed', async () => {
    await renewSession()
    await flushEvents()

    const viewEvents = await retrieveInitialViewEvents()

    expect(viewEvents.length).toBe(2)
    expect(viewEvents[0].session_id).not.toBe(viewEvents[1].session_id)
    expect(viewEvents[0].view.id).not.toBe(viewEvents[1].view.id)
  })
})

describe('error collection', () => {
  it('should track xhr error', async () => {
    await browserExecuteAsync(
      (baseUrl, unreachableUrl, done) => {
        let count = 0
        let xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => (count += 1))
        xhr.open('GET', `${baseUrl}/throw`)
        xhr.send()

        xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => (count += 1))
        xhr.open('GET', `${baseUrl}/unknown`)
        xhr.send()

        xhr = new XMLHttpRequest()
        xhr.addEventListener('error', () => (count += 1))
        xhr.open('GET', unreachableUrl)
        xhr.send()

        xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => (count += 1))
        xhr.open('GET', `${baseUrl}/ok`)
        xhr.send()

        const interval = setInterval(() => {
          if (count === 4) {
            clearInterval(interval)
            done(undefined)
          }
        }, 500)
      },
      browser.options.baseUrl!,
      UNREACHABLE_URL
    )
    await flushBrowserLogs()
    await flushEvents()
    const logs = (await retrieveLogs()).sort(sortByMessage)

    expect(logs.length).toEqual(2)

    expect(logs[0].message).toEqual(`XHR error GET ${browser.options.baseUrl}/throw`)
    expect(logs[0].http.status_code).toEqual(500)
    expect(logs[0].error.stack).toMatch(/Server error/)

    expect(logs[1].message).toEqual(`XHR error GET ${UNREACHABLE_URL}`)
    expect(logs[1].http.status_code).toEqual(0)
    expect(logs[1].error.stack).toEqual('Failed to load')
  })

  it('should track fetch error', async () => {
    await browserExecuteAsync(
      (baseUrl, unreachableUrl, done) => {
        let count = 0
        fetch(`${baseUrl}/throw`).then(() => (count += 1))
        fetch(`${baseUrl}/unknown`).then(() => (count += 1))
        fetch(unreachableUrl).catch(() => (count += 1))
        fetch(`${baseUrl}/ok`).then(() => (count += 1))

        const interval = setInterval(() => {
          if (count === 4) {
            clearInterval(interval)
            done(undefined)
          }
        }, 500)
      },
      browser.options.baseUrl!,
      UNREACHABLE_URL
    )
    await flushBrowserLogs()
    await flushEvents()
    const logs = (await retrieveLogs()).sort(sortByMessage)

    expect(logs.length).toEqual(2)

    expect(logs[0].message).toEqual(`Fetch error GET ${browser.options.baseUrl}/throw`)
    expect(logs[0].http.status_code).toEqual(500)
    expect(logs[0].error.stack).toMatch(/Server error/)

    expect(logs[1].message).toEqual(`Fetch error GET ${UNREACHABLE_URL}`)
    expect(logs[1].http.status_code).toEqual(0)
    expect(logs[1].error.stack).toContain('TypeError')
  })
})
