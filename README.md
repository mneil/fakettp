# fakettp

fake browser side http server via service workers with node api compatibility.

# usage

## bundlers

you can alias `http` to `fakettp` in your bundler config to use it as a drop in
replacement for node's http module. Example webpack config:

```sh
npm install fakettp --save-dev
```

```js
module.exports = {
  resolve: {
    alias: {
      http: "fakettp",
    },
    // or
    fallback: {
      http: require.resolve("fakettp"),
    }
  },
};
```

## browsers

this is a library primarily intended for use in bundlers like webpack.
example use case would be running an express app or socket io app locally.

a single global variable `FAKETTP` is exposed which partially implements socket,
net.stream, and net.server, and net.http interfaces from node.

it currently implements enough to run most express and socket io apps untouched.
socket io needs to be tuned in client side to use polling and not web sockets.

`http.createServer` is the main entry point (or rather `FAKETTP.createServer`).
fakettp is built into a UMD module, so it can be used in bundlers or browsers.

# example

![demo](./ext/demo.png)

You can create a server and listen like so:

```js
FAKETTP.createServer().on("request", (req, res) => {
  req.on('data', (chunk) => {
    console.log(`Received ${chunk.length} bytes of data in request body.`);
    console.log(`Request chunk: ${chunk.toString()}`);
  });
  req.on('end', () => {
    console.log('No more data in request body.');
  });
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('{"yo":"nice"}');
}).listen();
```

![listen](./ext/listen.png)

After that all requests will be intercepted and handled by the service worker.
Only requests to the same origin will be intercepted (excluding worker itself).
The HTML page loading the worker is also excluded from interception.

You can for example send a request to the server like so:

```js
async function postData(data = {}, url = "test.html") {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

postData({ answer: "browser" }).then((data) => {
  console.log(data);
});
```

![response](./ext/response.png)

# development

- Run `npm run build` to build the project.
- Run `npm run serve` to start webpack dev server.
- Run `npm run watch` to watch for changes and rebuild.
- Run `npx http-serve --cors dist` to run production build.

in dev modes, verbose logging is enabled. in production, it is disabled.

# status

this is what is known to work good enough for most use cases:

- Class: `http.Server`
  - Event: `'close'`
  - Event: `'connection'`
  - Event: `'request'`
  - `server.close([callback])`
  - `server.listen()`
  - `server.listening`
- Class: `http.ServerResponse`
  - Event: `'close'`
  - Event: `'finish'`
  - `response.end([data][, encoding][, callback])`
  - `response.finished`
  - `response.getHeader(name)`
  - `response.getHeaderNames()`
  - `response.getHeaders()`
  - `response.hasHeader(name)`
  - `response.headersSent`
  - `response.removeHeader(name)`
  - `response.setHeader(name, value)`
  - `response.socket`
  - `response.statusCode`
  - `response.statusMessage`
  - `response.write(chunk[, encoding][, callback])`
  - `response.writeHead(statusCode[, statusMessage][, `headers])
- Class: `http.IncomingMessage`
  - Event: `'close'`
  - `message.complete`
  - `message.destroy([error])`
  - `message.headers`
  - `message.httpVersion`
  - `message.method`
  - `message.rawHeaders`
  - `message.socket`
  - `message.statusCode`
  - `message.statusMessage`
  - `message.url`
- `http.STATUS_CODES` through [http-browserify][1]
- `http.createServer([options][, requestListener])`
- `http.get(options[, callback])` through [http-browserify][1]
- `http.get(url[, options][, callback])` through [http-browserify][1]
- `http.request(options[, callback])` through [http-browserify][1]
- `http.request(url[, options][, callback])` through [http-browserify][1]
- Class: `net.Socket`
  - Event: `'close'`
  - Event: `'data'`
  - Event: `'drain'`
  - Event: `'end'`
  - Event: `'error'`
  - `socket.address()`
  - `socket.bufferSize`
  - `socket.bytesRead`
  - `socket.bytesWritten`
  - `socket.destroy([exception])`
  - `socket.destroyed`
  - `socket.end([data][, encoding][, callback])`
  - `socket.write(data[, encoding][, callback])`

[1]: https://www.npmjs.com/package/http-browserify
