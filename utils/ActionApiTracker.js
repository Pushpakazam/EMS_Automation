class ActionApiTracker {
  constructor(page, options = {}) {
    this.page = page;
    this.includeMethods = (options.includeMethods || ['POST', 'PUT', 'PATCH', 'DELETE']).map((m) =>
      String(m).toUpperCase()
    );
    this.includeUrlPatterns = options.includeUrlPatterns || [/\/api\//i];
    this.excludeUrlPatterns =
      options.excludeUrlPatterns || [/analytics/i, /segment/i, /intercom/i, /hotjar/i, /socket/i];
    this.maxBodyChars = Number.isFinite(options.maxBodyChars) ? options.maxBodyChars : 5000;

    this.records = [];
    this._handler = this._onResponse.bind(this);
    this._started = false;
  }

  start() {
    if (this._started) return;
    this.page.on('response', this._handler);
    this._started = true;
  }

  stop() {
    if (!this._started) return;
    this.page.off('response', this._handler);
    this._started = false;
  }

  _shouldCapture(url, method, resourceType) {
    if (!this.includeMethods.includes(method)) return false;
    if (!['fetch', 'xhr'].includes(resourceType)) return false;
    if (this.excludeUrlPatterns.some((pattern) => pattern.test(url))) return false;
    return this.includeUrlPatterns.some((pattern) => pattern.test(url));
  }

  _safeLimitString(value) {
    if (typeof value !== 'string') return value;
    if (value.length <= this.maxBodyChars) return value;
    return `${value.slice(0, this.maxBodyChars)}...<truncated>`;
  }

  _parsePossibleJson(value) {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return this._safeLimitString(value);
    }
  }

  _validateRecord(record) {
    const errors = [];

    if (record.status < 200 || record.status >= 300) {
      errors.push(`Expected 2xx but received ${record.status}`);
    }

    const data = record.responseBody;
    if (data && typeof data === 'object') {
      if (Object.prototype.hasOwnProperty.call(data, 'success') && data.success === false) {
        errors.push('Response field "success" is false');
      }

      if (
        Object.prototype.hasOwnProperty.call(data, 'status') &&
        typeof data.status === 'string' &&
        ['error', 'failed', 'failure'].includes(data.status.toLowerCase())
      ) {
        errors.push(`Response field "status" indicates failure: ${data.status}`);
      }
    }

    return {
      passed: errors.length === 0,
      errors,
    };
  }

  async _onResponse(response) {
    const request = response.request();
    const method = request.method().toUpperCase();
    const url = response.url();
    const resourceType = request.resourceType();

    if (!this._shouldCapture(url, method, resourceType)) return;

    const contentType = response.headers()['content-type'] || '';

    let responseBody;
    try {
      if (/application\/json/i.test(contentType)) {
        responseBody = await response.json();
      } else {
        responseBody = this._safeLimitString(await response.text());
      }
    } catch {
      responseBody = '<unavailable>';
    }

    const postDataRaw = request.postData();
    const record = {
      capturedAt: new Date().toISOString(),
      method,
      url,
      resourceType,
      status: response.status(),
      ok: response.ok(),
      requestBody: this._parsePossibleJson(this._safeLimitString(postDataRaw)),
      responseBody,
    };

    record.validation = this._validateRecord(record);
    this.records.push(record);
  }

  getSummary() {
    const total = this.records.length;
    const passed = this.records.filter((r) => r.validation.passed).length;
    const failed = total - passed;

    return {
      totalCaptured: total,
      passedValidations: passed,
      failedValidations: failed,
      capturedApis: this.records.map((r) => ({
        method: r.method,
        url: r.url,
        status: r.status,
        passed: r.validation.passed,
        errors: r.validation.errors,
      })),
      failedApis: this.records
        .filter((r) => !r.validation.passed)
        .map((r) => ({
          method: r.method,
          url: r.url,
          status: r.status,
          errors: r.validation.errors,
        })),
    };
  }

  getValidationFailures() {
    return this.records
      .filter((r) => !r.validation.passed)
      .map((r) => `${r.method} ${r.url} -> ${r.status} | ${r.validation.errors.join('; ')}`);
  }
}

module.exports = { ActionApiTracker };
