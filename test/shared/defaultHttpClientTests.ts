// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import * as assert from "assert";
import * as should from "should";
import { DefaultHttpClient } from "../../lib/defaultHttpClient";
import { RestError } from "../../lib/restError";
import { isNode } from "../../lib/util/utils";
import { WebResource, HttpRequestBody } from "../../lib/webResource";
import { baseURL } from "../testUtils";
import { createReadStream } from 'fs';
import { join } from 'path';

function getAbortController(): AbortController {
  let controller: AbortController;
  if (typeof AbortController === "function") {
    controller = new AbortController();
  } else {
    const AbortControllerPonyfill = require("abortcontroller-polyfill/dist/cjs-ponyfill").AbortController;
    controller = new AbortControllerPonyfill();
  }
  return controller;
}

describe("defaultHttpClient", () => {
  it("should send HTTP requests", async () => {
    const request = new WebResource(`${baseURL}/example-index.html`, "GET");
    const httpClient = new DefaultHttpClient();

    const response = await httpClient.sendRequest(request);
    assert.deepStrictEqual(response.request, request);
    assert.strictEqual(response.status, 200);
    assert(response.headers);
    // content-length varies based on OS line endings
    assert.strictEqual(response.headers.get("content-length"), response.bodyAsText!.length.toString());
    assert.strictEqual(response.headers.get("content-type")!.split(";")[0], "text/html");
    const responseBody: string | null | undefined = response.bodyAsText;
    const expectedResponseBody =
      `<!doctype html>
<html>
<head>
    <title>Example Domain</title>

    <meta charset="utf-8" />
    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
    body {
        background-color: #f0f0f2;
        margin: 0;
        padding: 0;
        font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

    }
    div {
        width: 600px;
        margin: 5em auto;
        padding: 50px;
        background-color: #fff;
        border-radius: 1em;
    }
    a:link, a:visited {
        color: #38488f;
        text-decoration: none;
    }
    @media (max-width: 700px) {
        body {
            background-color: #fff;
        }
        div {
            width: auto;
            margin: 0 auto;
            border-radius: 0;
            padding: 1em;
        }
    }
    </style>
</head>

<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is established to be used for illustrative examples in documents. You may use this
    domain in examples without prior coordination or asking for permission.</p>
    <p><a href="http://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>
`;
    assert.strictEqual(
      responseBody && responseBody.replace(/\r\n/g, "\n"),
      expectedResponseBody.replace(/\r\n/g, "\n"));
  });

  it("should return a response instead of throwing for awaited 404", async () => {
    const request = new WebResource(`${baseURL}/nonexistent`, "GET");
    const httpClient = new DefaultHttpClient();

    const response = await httpClient.sendRequest(request);
    assert(response);
  });

  it("should allow canceling requests", async function () {
    const controller = getAbortController();
    const request = new WebResource(`${baseURL}/fileupload`, "POST", new Uint8Array(1024 * 1024 * 10), undefined, undefined, true, undefined, controller.signal);
    const client = new DefaultHttpClient();
    const promise = client.sendRequest(request);
    controller.abort();
    try {
      await promise;
      assert.fail("");
    } catch (err) {
      should(err).not.be.instanceof(assert.AssertionError);
    }
  });

  it("should not overwrite a user-provided cookie (nodejs only)", async function () {
    // Cookie is only allowed to be set by the browser based on an actual response Set-Cookie header
    if (!isNode) {
      this.skip();
    }

    const client = new DefaultHttpClient();

    const request1 = new WebResource(`${baseURL}/set-cookie`);
    await client.sendRequest(request1);

    const request2 = new WebResource(`${baseURL}/cookie`);
    const response2 = await client.sendRequest(request2);
    should(response2.headers.get("Cookie")).equal("data=123456");

    const request3 = new WebResource(`${baseURL}/cookie`, "GET", undefined, undefined, { Cookie: "data=abcdefg" });
    const response3 = await client.sendRequest(request3);
    should(response3.headers.get("Cookie")).equal("data=abcdefg");
  });

  it("should allow canceling multiple requests with one token", async function () {
    const controller = getAbortController();
    const buf = new Uint8Array(1024 * 1024 * 1);
    const requests = [
      new WebResource(`${baseURL}/fileupload`, "POST", buf, undefined, undefined, true, undefined, controller.signal),
      new WebResource(`${baseURL}/fileupload`, "POST", buf, undefined, undefined, true, undefined, controller.signal)
    ];
    const client = new DefaultHttpClient();
    const promises = requests.map(r => client.sendRequest(r));
    controller.abort();
    // Ensure each promise is individually rejected
    for (const promise of promises) {
      try {
        await promise;
        assert.fail("");
      } catch (err) {
        should(err).not.be.instanceof(assert.AssertionError);
      }
    }
  });

  it("should report upload and download progress for simple bodies", async function () {
    let uploadNotified = false;
    let downloadNotified = false;

    const body = isNode ? new Buffer(1024 * 1024) : new Uint8Array(1024 * 1024);
    const request = new WebResource(`${baseURL}/fileupload`, "POST", body, undefined, undefined, false, undefined, undefined, 0,
      ev => {
        uploadNotified = true;
        if (typeof ProgressEvent !== "undefined") {
          ev.should.not.be.instanceof(ProgressEvent);
        }
        ev.loadedBytes.should.be.a.Number;
      },
      ev => {
        downloadNotified = true;
        if (typeof ProgressEvent !== "undefined") {
          ev.should.not.be.instanceof(ProgressEvent);
        }
        ev.loadedBytes.should.be.a.Number;
      });

    const client = new DefaultHttpClient();
    await client.sendRequest(request);
    assert(uploadNotified);
    assert(downloadNotified);
  });

  it("should report upload and download progress for blob or stream bodies", async function() {
    let uploadNotified = false;
    let downloadNotified = false;

    let body: HttpRequestBody;
    if (isNode) {
      body = () => createReadStream(join(__dirname, "..", "resources", "example-index.html"));
    } else {
      body = new Blob([new Uint8Array(1024 * 1024)]);
    }
    const request = new WebResource(`${baseURL}/fileupload`, "POST", body, undefined, undefined, true, undefined, undefined, 0,
      ev => {
        uploadNotified = true;
        if (typeof ProgressEvent !== "undefined") {
          ev.should.not.be.instanceof(ProgressEvent);
        }
        ev.loadedBytes.should.be.a.Number;
      },
      ev => {
        downloadNotified = true;
        if (typeof ProgressEvent !== "undefined") {
          ev.should.not.be.instanceof(ProgressEvent);
        }
        ev.loadedBytes.should.be.a.Number;
      });

    const client = new DefaultHttpClient();
    const response = await client.sendRequest(request);
    const streamBody = response.readableStreamBody;
    if (response.blobBody) {
      await response.blobBody;
    } else if (streamBody) {
      streamBody.on('data', () => {});
      await new Promise((resolve, reject) => {
        streamBody.on("end", resolve);
        streamBody.on("error", reject);
      });
    }
    assert(uploadNotified);
    assert(downloadNotified);
  });

  it("should honor request timeouts", async function () {
    const request = new WebResource(`${baseURL}/slow`, "GET", undefined, undefined, undefined, false, false, undefined, 100);
    const client = new DefaultHttpClient();
    try {
      await client.sendRequest(request);
      throw new Error("request did not fail as expected");
    } catch (err) {
      err.message.should.match(/timeout/);
    }
  });

  it("should give a graceful error for nonexistent hosts", async function() {
    const request = new WebResource(`http://foo.notawebsite/`);
    const client = new DefaultHttpClient();
    try {
      await client.sendRequest(request);
      throw new Error("request did not fail as expected");
    } catch (err) {
      err.should.be.instanceof(RestError);
      err.code.should.equal("REQUEST_SEND_ERROR");
    }
  });

  it("should interpret undefined as an empty body", async function () {
    const request = new WebResource(`${baseURL}/expect-empty`, "PUT");
    const client = new DefaultHttpClient();
    const response = await client.sendRequest(request);
    response.status.should.equal(200, response.bodyAsText!);
  });
});
