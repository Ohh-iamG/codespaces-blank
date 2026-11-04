/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-c3369df1'], (function (workbox) { 'use strict';

  importScripts("/sw-push.js");
  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "sw-push.js",
    "revision": "43cadeb9d34957bd93c2fe19a59019e4"
  }, {
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "37a392ef7d14a6ff7bb77808d78b4daf"
  }, {
    "url": "pwa-512x512.png",
    "revision": "8d2ecebc4b01e904e3c3d0e495317c1c"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0ba23fabb8a579637b96138880b50343"
  }, {
    "url": "index.html",
    "revision": "d2de1615d11ffed21171bcd4cecf3082"
  }, {
    "url": "icon.svg",
    "revision": "a61b2c7ef9effae16658fe82217b1fe4"
  }, {
    "url": "favicon.ico",
    "revision": "3672a1a412eeeffbf99d9228ffe6dded"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "3672a1a412eeeffbf99d9228ffe6dded"
  }, {
    "url": "assets/web-DczBYHDe.js",
    "revision": null
  }, {
    "url": "assets/index-DysjPIum.css",
    "revision": null
  }, {
    "url": "assets/index-CelGc8YO.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "3672a1a412eeeffbf99d9228ffe6dded"
  }, {
    "url": "favicon.ico",
    "revision": "3672a1a412eeeffbf99d9228ffe6dded"
  }, {
    "url": "icon.svg",
    "revision": "a61b2c7ef9effae16658fe82217b1fe4"
  }, {
    "url": "manifest.json",
    "revision": "93237250f382e73b1980143e726cc629"
  }, {
    "url": "pwa-192x192.png",
    "revision": "0ba23fabb8a579637b96138880b50343"
  }, {
    "url": "pwa-512x512.png",
    "revision": "8d2ecebc4b01e904e3c3d0e495317c1c"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "37a392ef7d14a6ff7bb77808d78b4daf"
  }, {
    "url": "sw-push.js",
    "revision": "43cadeb9d34957bd93c2fe19a59019e4"
  }, {
    "url": "manifest.webmanifest",
    "revision": "7779660d6757a9208f036bccd7b706c1"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api/]
  }));
  workbox.registerRoute(/^\/api\/pulse\/daily/, new workbox.StaleWhileRevalidate({
    "cacheName": "daily-pulse-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 14400
    })]
  }), 'GET');
  workbox.registerRoute(/^\/api\/entities/, new workbox.StaleWhileRevalidate({
    "cacheName": "entities-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 43200
    })]
  }), 'GET');
  workbox.registerRoute(/^\/api\/circle/, new workbox.NetworkFirst({
    "cacheName": "circle-cache",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 7200
    })]
  }), 'GET');

}));
