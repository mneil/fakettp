import debug from "debug";
import {
  ARM,
  FIN,
  assert,
  serializeRequest,
  SerializedResponse,
  isRunningInServiceWorker,
  getBundledWorkerFileName,
  MessagePortToReadableStream,
} from "./common";

const log = debug("fakettp:sw");

function shouldProxyUrl(url: URL) {
  return (
    self.location.origin === url.origin &&
    self.location.pathname !== url.pathname &&
    url.pathname !== "/" &&
    url.pathname !== `/${getBundledWorkerFileName()}`
  );
}

export function createProxyClient() {
  let armed = false;
  log("creating sw client");
  assert(isRunningInServiceWorker());
  const scope = self as unknown as ServiceWorkerGlobalScope;
  const messageListeners = new Map<number, (event: MessageEvent<SerializedResponse>) => void>();
  scope.addEventListener("fetch", (ev: FetchEvent) => {
    log("fetch event: %s", ev.request.url);
    if (!armed) {
      log("unarmed, letting browser handle request: %s", ev.request.url);
      return;
    }
    ev.respondWith(
      new Promise(function (resolve, reject) {
        scope.clients
          .get(ev.clientId)
          .then((mt) => {
            log("processing fetch event: %s", ev.request.url);
            const requestUrl = new URL(ev.request.url);
            if (!armed || !shouldProxyUrl(requestUrl)) {
              log("letting browser handle request: %s", ev.request.url);
              return resolve(fetch(ev.request));
            }
            const requestSerialized = serializeRequest(ev.request);
            const requestId = requestSerialized.id;
            log("fetch event: %s, id: %d", ev.request.url, requestId);
            messageListeners.set(requestId, function (event: MessageEvent<SerializedResponse>) {
              log("fetch event: %s, id: %d, response event: %s", ev.request.url, requestId, event.data.id);
              messageListeners.delete(requestId);
              if (!event.data.proxy) {
                log("bypassing fetch event: %s, id: %d", ev.request.url, requestId);
                return resolve(fetch(ev.request));
              }
              const { data: responseInit } = event;
              const responseId = responseInit.id;
              assert(responseId === requestId, "request-response pair id mismatch");
              const responseBody = MessagePortToReadableStream(event.ports[0]);
              log("responding to fetch event: %s, id: %d", ev.request.url, requestId);
              resolve(new Response(responseBody, responseInit));
            });
            const { body: requestBody, ...requestRest } = requestSerialized;
            mt?.postMessage(requestRest, requestBody ? [requestBody] : []);
          })
          .catch(reject);
      })
    );
  });
  scope.addEventListener("message", (event: MessageEvent<SerializedResponse | typeof ARM | typeof FIN>) => {
    if (event.data === ARM) {
      log("arming");
      armed = true;
      return;
    }
    if (event.data === FIN) {
      log("disarming");
      armed = false;
      return;
    }
    const { data: responseInit } = event;
    const responseId = responseInit.id;
    if (messageListeners.has(responseId)) {
      const messageListener = messageListeners.get(responseId);
      messageListener(event as MessageEvent<SerializedResponse>);
    } else {
      log("message event: %d, no listener found", responseId);
    }
  });
  scope.addEventListener("activate", function () {
    log("activating");
    return scope.clients.claim();
  });
}
