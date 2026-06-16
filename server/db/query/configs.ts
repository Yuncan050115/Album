// 配置表

'use server'

import { db, withDbRetry } from '~/server/lib/db'

type CacheRow = {
  id: string
  config_key: string
  config_value: string | null
  detail?: string | null
}

const CONFIG_CACHE_TTL = Number(process.env.CONFIG_CACHE_TTL_MS || 5000)
const configCache = new Map<string, { expires: number, value: CacheRow[] }>()

function cacheKey(keys: string[]) {
  return [...keys].sort().join('|')
}

function readCache(keys: string[]) {
  const hit = configCache.get(cacheKey(keys))
  if (!hit || hit.expires < Date.now()) return null
  return hit.value
}

function writeCache(keys: string[], value: CacheRow[]) {
  configCache.set(cacheKey(keys), { expires: Date.now() + CONFIG_CACHE_TTL, value })
  return value
}

export async function clearConfigCache() {
  configCache.clear()
}


/**
 * 根据单个key获取配置
 * @param key 配置键
 * @returns 配置项
 */
export async function fetchConfigByKey(key: string) {
  return await withDbRetry(() => db.configs.findFirst({
    where: {
      config_key: key
    },
    select: {
      id: true,
      config_key: true,
      config_value: true,
      detail: true
    }
  }), `config:${key}`);
}

/**
 * 根据多个key获取配置
 * @param keys 配置键列表
 * @returns 配置列表
 */
export async function fetchConfigByKeys(keys: string[]) {
  return fetchConfigsByKeys(keys)
}

/**
 * 根据 key 获取配置
 * @param keys key 列表
 * @returns 配置列表
 */
export async function fetchConfigsByKeys(keys: string[]) {
  const cached = readCache(keys)
  if (cached) return cached

  const value = await withDbRetry(() => db.configs.findMany({
    where: {
      config_key: {
        in: keys
      }
    },
    select: {
      id: true,
      config_key: true,
      config_value: true,
      detail: true
    }
  }), `configs:${cacheKey(keys)}`)
  return writeCache(keys, value)
}

/**
 * 获取密钥
 * @returns 密钥
 */
export async function fetchSecretKey() {
  return await db.configs.findFirst({
    where: {
      config_key: 'secret_key'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  })
}

/**
 * 获取 auth 状态
 * @returns auth 状态
 */
export async function queryAuthStatus() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_enable'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}

/**
 * 获取 auth 临时密钥
 * @returns auth 临时密钥
 */
export async function queryAuthTemplateSecret() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_temp_secret'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}

/**
 * 获取 auth 密钥
 * @returns auth 密钥
 */
export async function queryAuthSecret() {
  return await db.configs.findFirst({
    where: {
      config_key: 'auth_secret'
    },
    select: {
      id: true,
      config_key: true,
      config_value: true
    }
  });
}
