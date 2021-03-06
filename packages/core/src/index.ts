export { DEFAULT_CONFIGURATION, Configuration, UserConfiguration } from './configuration'
export { ErrorMessage, ErrorContext, HttpContext, ErrorOrigin, ErrorObservable } from './errorCollection'
export { BuildEnv, Datacenter, Environment, makeStub, makeGlobal, commonInit, isValidBrowsingContext } from './init'
export { MonitoringMessage, monitored, monitor, addMonitoringMessage } from './internalMonitoring'
export { Observable } from './observable'
export { RequestType, RequestDetails, startRequestCollection, RequestObservable } from './requestCollection'
export {
  startSessionManagement,
  // Exposed for tests
  SESSION_COOKIE_NAME,
  stopSessionManagement,
} from './sessionManagement'
export { HttpRequest, Batch } from './transport'
export * from './utils'
export { getCookie, setCookie, COOKIE_ACCESS_DELAY } from './cookie'

export * from './specHelper'
