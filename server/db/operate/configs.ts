// 配置表

"use server";

import { db } from "~/server/lib/db";

/**
 * 更新 S3 配置
 * @param configs 配置信息
 */
export async function updateS3Config(configs: any) {
  return await db.$executeRaw`
    UPDATE "public"."configs"
    SET config_value = CASE
       WHEN config_key = 'accesskey_id' THEN ${configs.accesskeyId}
       WHEN config_key = 'accesskey_secret' THEN ${configs.accesskeySecret}
       WHEN config_key = 'region' THEN ${configs.region}
       WHEN config_key = 'endpoint' THEN ${configs.endpoint}
       WHEN config_key = 'bucket' THEN ${configs.bucket}
       WHEN config_key = 'storage_folder' THEN ${configs.storageFolder}
       WHEN config_key = 'force_path_style' THEN ${configs.forcePathStyle}
       WHEN config_key = 's3_cdn' THEN ${configs.s3Cdn}
       WHEN config_key = 's3_cdn_url' THEN ${configs.s3CdnUrl}
       ELSE 'N&A'
    END,
        updated_at = NOW()
    WHERE config_key IN ('accesskey_id', 'accesskey_secret', 'region', 'endpoint', 'bucket', 'storage_folder', 'force_path_style', 's3_cdn', 's3_cdn_url');
  `;
}

/**
 * 更新 R2 配置
 * @param configs 配置信息
 */
export async function updateR2Config(configs: any) {
  const entries = [
    ["r2_accesskey_id", configs.r2AccesskeyId || "", "Cloudflare R2 Access Key ID"],
    ["r2_accesskey_secret", configs.r2AccesskeySecret || "", "Cloudflare R2 Secret Access Key"],
    ["r2_endpoint", configs.r2Endpoint || "", "R2 S3 API Endpoint"],
    ["r2_bucket", configs.r2Bucket || "", "R2 Bucket 名称"],
    ["r2_storage_folder", configs.r2StorageFolder || "", "存储目录，可空"],
    ["r2_public_domain", configs.r2PublicDomain || "", "公开访问域名/CDN 域名，可空"],
  ] as const;

  for (const [config_key, config_value, detail] of entries) {
    await db.configs.upsert({
      where: { config_key },
      update: { config_value, detail, updatedAt: new Date() },
      create: { config_key, config_value, detail },
    });
  }
  return { count: entries.length };
}

/**
 * 更新 AList 配置
 * @param configs 配置信息
 */
export async function updateAListConfig(configs: any) {
  return await db.$executeRaw`
    UPDATE "public"."configs"
    SET config_value = CASE
       WHEN config_key = 'alist_url' THEN ${configs.alistUrl}
       WHEN config_key = 'alist_token' THEN ${configs.alistToken}
       ELSE 'N&A'
    END,
        updated_at = NOW()
    WHERE config_key IN ('alist_url', 'alist_token');
  `;
}

/**
 * 更新自定义信息
 * @param payload 自定义信息
 */
export async function updateCustomInfo(payload: {
  title: string;
  customFaviconUrl: string;
  customAuthor: string;
  feedId: string;
  userId: string;
  customIndexStyle: number;
  customIndexDownloadEnable: boolean;
  enablePreviewImageMaxWidthLimit: boolean;
  previewImageMaxWidth: number;
  previewQuality: number;
}) {
  const {
    title,
    customFaviconUrl,
    customAuthor,
    feedId,
    userId,
    customIndexStyle,
    customIndexDownloadEnable,
    enablePreviewImageMaxWidthLimit,
    previewImageMaxWidth,
    previewQuality,
  } = payload;
  await db.$transaction(async (tx) => {
    await tx.configs.update({
      where: {
        config_key: "custom_title",
      },
      data: {
        config_value: title,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "custom_favicon_url",
      },
      data: {
        config_value: customFaviconUrl,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "custom_author",
      },
      data: {
        config_value: customAuthor,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "rss_feed_id",
      },
      data: {
        config_value: feedId,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "rss_user_id",
      },
      data: {
        config_value: userId,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "custom_index_style",
      },
      data: {
        config_value: customIndexStyle.toString(),
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "custom_index_download_enable",
      },
      data: {
        config_value: customIndexDownloadEnable ? "true" : "false",
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "preview_max_width_limit_switch",
      },
      data: {
        config_value: enablePreviewImageMaxWidthLimit ? "1" : "0",
        updatedAt: new Date(),
      },
    });
    if (previewImageMaxWidth > 0) {
      await tx.configs.update({
        where: {
          config_key: "preview_max_width_limit",
        },
        data: {
          config_value: previewImageMaxWidth.toString(),
          updatedAt: new Date(),
        },
      });
    }
    if (previewQuality > 0) {
      await tx.configs.update({
        where: {
          config_key: "preview_quality",
        },
        data: {
          config_value: previewQuality.toString(),
          updatedAt: new Date(),
        },
      });
    }
  });
}

/**
 * 保存授权临时密钥
 * @param token 临时密钥
 */
export async function saveAuthTemplateSecret(token: string) {
  await db.configs.update({
    where: {
      config_key: "auth_temp_secret",
    },
    data: {
      config_value: token,
      updatedAt: new Date(),
    },
  });
}

/**
 * 保存授权密钥
 * @param enable 是否启用
 * @param secret 密钥
 */
export async function saveAuthSecret(enable: string, secret: string) {
  await db.$transaction(async (tx) => {
    await tx.configs.update({
      where: {
        config_key: "auth_enable",
      },
      data: {
        config_value: enable,
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "auth_secret",
      },
      data: {
        config_value: secret,
        updatedAt: new Date(),
      },
    });
  });
}

/**
 * 删除授权密钥
 */
export async function deleteAuthSecret() {
  await db.$transaction(async (tx) => {
    await tx.configs.update({
      where: {
        config_key: "auth_enable",
      },
      data: {
        config_value: "false",
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "auth_secret",
      },
      data: {
        config_value: "",
        updatedAt: new Date(),
      },
    });
    await tx.configs.update({
      where: {
        config_key: "auth_temp_secret",
      },
      data: {
        config_value: "",
        updatedAt: new Date(),
      },
    });
  });
}

/**
 * 更新腾讯云 COS 配置。
 * 这里不能只 UPDATE，因为旧库里如果缺少 COS 配置行，前端会看起来“保存成功”但实际没有写入。
 */
export async function updateCosConfig(cosConfig: {
  cosSecretId: string;
  cosSecretKey: string;
  cosRegion: string;
  cosBucket: string;
  cosStorageFolder: string;
  cosDomain: string;
}) {
  const entries = [
    ["cos_secret_id", cosConfig.cosSecretId, "腾讯云 COS SecretId"],
    ["cos_secret_key", cosConfig.cosSecretKey, "腾讯云 COS SecretKey"],
    [
      "cos_region",
      cosConfig.cosRegion,
      "腾讯云 COS 地域，如：ap-guangzhou / ap-hongkong",
    ],
    [
      "cos_bucket",
      cosConfig.cosBucket,
      "腾讯云 COS 存储桶完整名称，如：yuncan-125xxxxxxx",
    ],
    [
      "cos_storage_folder",
      cosConfig.cosStorageFolder,
      "腾讯云 COS 存储目录，填 / 或留空表示根目录",
    ],
    [
      "cos_domain",
      cosConfig.cosDomain,
      "腾讯云 COS 自定义域名 / CDN 域名，可留空",
    ],
  ] as const;

  for (const [config_key, config_value, detail] of entries) {
    await db.configs.upsert({
      where: { config_key },
      update: { config_value, detail, updatedAt: new Date() },
      create: { config_key, config_value, detail },
    });
  }
  return { count: entries.length };
}
