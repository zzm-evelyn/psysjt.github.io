/* ============================================================
   config.js — 前端配置
   部署时修改 API_BASE_URL 指向实际后端地址
   ============================================================ */

// 后端 API 基地址
// 本地开发：http://localhost:5000
// 生产环境：https://your-api-domain.com
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://psysjt-glcfqmmcfy.cn-hongkong.fcapp.run'; // TODO: 部署时替换为实际域名

// API 版本前缀
const API_PREFIX = '/api';

// 完整 API 地址
const API_ENDPOINT = API_BASE_URL + API_PREFIX;

// 请求超时时间（毫秒）
const API_TIMEOUT = 15000;

// 重试次数
const API_RETRY_COUNT = 1;
