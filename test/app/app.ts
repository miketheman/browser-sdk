import { datadogLogs } from '@datadog/browser-logs'
import { datadogRum } from '@datadog/browser-rum'

datadogLogs.init({
  clientToken: 'key',
  forwardErrorsToLogs: true,
  internalMonitoringEndpoint: '/monitoring',
  logsEndpoint: '/logs',
})

datadogRum.init({
  applicationId: 'rum',
  clientToken: 'key',
  internalMonitoringEndpoint: '/monitoring',
  rumEndpoint: '/rum',
})
