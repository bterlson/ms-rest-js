// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { HttpOperationResponse } from "./httpOperationResponse";
import { WebResource } from "./webResource";

export class RestError extends Error {
  static readonly REQUEST_SEND_ERROR = "REQUEST_SEND_ERROR";
  static readonly REQUEST_ABORTED_ERROR = "REQUEST_ABORTED_ERROR";
  static readonly PARSE_ERROR = "PARSE_ERROR";

  code?: string;
  statusCode?: number;
  request?: WebResource;
  response?: HttpOperationResponse;
  body?: any;
  constructor(message: string, code?: string, statusCode?: number, request?: WebResource, response?: HttpOperationResponse, body?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.request = request;
    this.response = response;
    this.body = body;

    Object.setPrototypeOf(this, RestError.prototype);
  }
}