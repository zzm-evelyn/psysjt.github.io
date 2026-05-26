/* ============================================================
   apiClient.js — 后端 API 客户端
   封装 fetch 请求，支持超时、重试、错误处理
   ============================================================ */

/**
 * 基础请求函数
 * @param {string} method - HTTP 方法
 * @param {string} path - API 路径（例如 /health）
 * @param {object|null} data - 请求体数据
 * @param {object} options - 额外选项
 * @returns {Promise} - 响应数据
 */
async function apiRequest(method, path, data, options = {}) {
  const url = API_ENDPOINT + path;
  const fetchOptions = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(options.timeout || API_TIMEOUT)
  };

  // 添加 admin token
  const token = localStorage.getItem('admin_token');
  if (token) {
    fetchOptions.headers['Authorization'] = 'Bearer ' + token;
  }

  if (data !== null && data !== undefined) {
    fetchOptions.body = JSON.stringify(data);
  }

  const maxRetries = options.retries !== undefined ? options.retries : API_RETRY_COUNT;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      // 处理文件下载
      if (options.download) {
        if (!response.ok) {
          throw new Error('下载失败: ' + response.status);
        }
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = options.filename || 'download';
        a.click();
        URL.revokeObjectURL(downloadUrl);
        return { status: 'ok' };
      }

      // 处理 204 No Content
      if (response.status === 204) {
        return { status: 'ok' };
      }

      const result = await response.json();

      if (!response.ok) {
        const error = new Error(result.error || '请求失败');
        error.code = result.code || 'UNKNOWN_ERROR';
        error.status = response.status;
        throw error;
      }

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请检查网络或后端服务是否可用');
      }
      if (attempt < maxRetries) {
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw error;
    }
  }
}

/**
 * GET 请求
 */
async function apiGet(path, options = {}) {
  return apiRequest('GET', path, null, options);
}

/**
 * POST 请求
 */
async function apiPost(path, data, options = {}) {
  return apiRequest('POST', path, data, options);
}

/**
 * PUT 请求
 */
async function apiPut(path, data, options = {}) {
  return apiRequest('PUT', path, data, options);
}

/**
 * DELETE 请求
 */
async function apiDelete(path, options = {}) {
  return apiRequest('DELETE', path, null, options);
}

/**
 * 下载文件
 */
async function downloadFile(path, filename) {
  return apiRequest('GET', path, null, { download: true, filename: filename });
}

/**
 * 检查后端是否可用
 */
async function checkHealth() {
  try {
    const result = await apiGet('/health', { timeout: 5000 });
    return result.status === 'ok';
  } catch (e) {
    console.warn('[apiClient] 后端不可用:', e.message);
    return false;
  }
}
