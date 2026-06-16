import "server-only";

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { fetchConfigsByKeys } from "~/server/db/query/configs";
import { getClient } from "~/server/lib/s3";
import { getR2Client } from "~/server/lib/r2";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { db } from "~/server/lib/db";
import { uploadBufferToCos } from "~/server/lib/file-upload";

const app = new Hono();

function readableStorageError(e: unknown, storage?: string) {
  const anyError = e as any;
  const code = anyError?.Code || anyError?.code || "";
  const message = String(anyError?.message || anyError || "连接失败");

  if (storage === "cos") {
    if (code === "InvalidAccessKeyId" || message.includes("InvalidAccessKeyId")) {
      return "腾讯云 COS SecretId 无效：请使用访问管理 CAM 的 API 密钥 SecretId，不是存储桶名、APPID 或临时链接；如果刚新建密钥，等几十秒后再测。";
    }
    if (code === "SignatureDoesNotMatch" || message.includes("SignatureDoesNotMatch")) {
      return "腾讯云 COS SecretKey 不匹配：请检查 SecretId 和 SecretKey 是否是一对，且没有复制多余空格。";
    }
    if (code === "NoSuchBucket" || message.includes("NoSuchBucket")) {
      return "腾讯云 COS Bucket 不存在：Bucket 必须填完整名称，例如 example-1250000000。";
    }
    if (code === "AccessDenied" || message.includes("AccessDenied")) {
      return "腾讯云 COS 权限不足：请给该 SecretId 授权当前 Bucket 的 GetBucket、PutObject、GetObject 权限。";
    }
    if (message.includes("Region") || message.includes("region")) {
      return "腾讯云 COS Region 可能填写错误：请填写 ap-guangzhou、ap-shanghai、ap-hongkong 这类地域代码。";
    }
  }

  if (storage === "r2") {
    if (code === "InvalidAccessKeyId" || message.includes("InvalidAccessKeyId")) {
      return "Cloudflare R2 Access Key ID 无效：请使用 R2 API Token 里的 Access Key ID，不是 Account ID。";
    }
    if (code === "SignatureDoesNotMatch" || message.includes("SignatureDoesNotMatch")) {
      return "Cloudflare R2 Secret Access Key 不匹配：请确认 Access Key ID 与 Secret Access Key 是同一组。";
    }
    if (code === "NoSuchBucket" || message.includes("NoSuchBucket")) {
      return "Cloudflare R2 Bucket 不存在：请填写 Bucket 名称，不要填域名。";
    }
    if (code === "AccessDenied" || message.includes("AccessDenied")) {
      return "Cloudflare R2 权限不足：请给该 API Token 授权当前 Bucket 的读写权限。";
    }
  }

  return message;
}

// 测试连接并列出顶层目录。无论成功失败都返回 JSON，避免前端把纯文本 Failed 当 JSON 解析。
app.post("/test-connection", async (c) => {
  let storage = "";
  try {
    const body = await c.req.json();
    const { prefix, path } = body;
    storage = body?.storage || "";

    if (!storage) {
      return c.json({ code: 400, message: "存储类型不能为空" }, 400);
    }

    const result = await listBucketContents(storage, path || "", prefix || "");
    return c.json({
      code: 200,
      message: "Success",
      data: result,
    });
  } catch (e) {
    console.error(e);
    const message = readableStorageError(e, storage);
    return c.json({
      code: 500,
      message,
      error: (e as any)?.Code || (e as any)?.code || "STORAGE_TEST_FAILED",
    }, 500);
  }
});

// 浏览目录。失败也必须返回 JSON，避免前端解析纯文本 Failed 报错。
app.post("/browse-directory", async (c) => {
  let storage = "";
  try {
    const body = await c.req.json();
    const { path, prefix } = body;
    storage = body?.storage || "";

    if (!storage) {
      return c.json({ code: 400, message: "存储类型不能为空" }, 400);
    }

    const result = await listBucketContents(storage, path || "", prefix || "");
    return c.json({
      code: 200,
      message: "Success",
      data: result,
    });
  } catch (e) {
    console.error(e);
    return c.json({
      code: 500,
      message: readableStorageError(e, storage),
      error: (e as any)?.Code || (e as any)?.code || "STORAGE_BROWSE_FAILED",
    }, 500);
  }
});


function cleanTencentSecretId(value: unknown) {
  const cleaned = String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretId|AccessKeyId|ID|密钥ID|访问密钥ID)\s*[:：=	 ]+/i, "")
    .replace(/\s+/g, "");
  const match = cleaned.match(/AKID[A-Za-z0-9]{20,}/);
  return match ? match[0] : cleaned;
}

function cleanTencentSecretKey(value: unknown) {
  return String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretKey|AccessKeySecret|KEY|密钥Key|访问密钥Key)\s*[:：=	 ]+/i, "")
    .replace(/\s+/g, "");
}

function cleanTencentRegion(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function cleanTencentBucket(value: unknown) {
  return String(value ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0];
}

function normalizeUrlHost(value = "") {
  try {
    return new URL(String(value)).host;
  } catch {
    return "";
  }
}

function getFileExtensionFromUrl(value = "", contentType = "") {
  try {
    const pathname = new URL(value).pathname;
    const name = pathname.split("/").pop() || "";
    const ext = name.includes(".")
      ? name.substring(name.lastIndexOf(".")).toLowerCase()
      : "";
    if (ext && ext.length <= 8) return ext;
  } catch {}
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  if (contentType.includes("avif")) return ".avif";
  return ".jpg";
}

function safeMigrationName(id: string, url: string, contentType = "") {
  const ext = getFileExtensionFromUrl(url, contentType);
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `migrated/alist/${ts}/${id}${ext}`;
}

async function fetchRemoteAsBuffer(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Album-COS-Migrator/1.0",
    },
  });
  if (!res.ok) throw new Error(`下载失败 ${res.status}`);
  const contentType =
    res.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

app.post("/cos/migrate-alist-images", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const includePreview = body?.includePreview !== false;
    const limit = Math.min(Math.max(Number(body?.limit || 300), 1), 1000);

    const findConfig = await fetchConfigsByKeys([
      "alist_url",
      "cos_domain",
      "cos_bucket",
      "cos_region",
    ]);
    const alistUrl =
      findConfig.find((item) => item.config_key === "alist_url")
        ?.config_value || "";
    const alistHost = normalizeUrlHost(alistUrl);
    const cosDomain =
      findConfig.find((item) => item.config_key === "cos_domain")
        ?.config_value || "";
    const cosBucket =
      findConfig.find((item) => item.config_key === "cos_bucket")
        ?.config_value || "";
    const cosRegion =
      findConfig.find((item) => item.config_key === "cos_region")
        ?.config_value || "";
    const cosHost =
      normalizeUrlHost(cosDomain) ||
      normalizeUrlHost(`https://${cosBucket}.cos.${cosRegion}.myqcloud.com`);

    if (!alistHost)
      throw new Error("AList / OpenList 地址未配置，无法判断旧图片来源");

    const rows = await db.images.findMany({
      where: {
        del: 0,
        OR: [
          { url: { contains: alistHost } },
          { preview_url: { contains: alistHost } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "asc" },
      select: { id: true, url: true, preview_url: true },
    });

    let migrated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { id: string; message: string }[] = [];

    for (const row of rows) {
      try {
        const nextData: {
          url?: string;
          preview_url?: string;
          updatedAt: Date;
        } = { updatedAt: new Date() };
        const currentUrl = row.url || "";
        const currentPreviewUrl = row.preview_url || "";
        const urlHost = normalizeUrlHost(currentUrl);
        const previewHost = normalizeUrlHost(currentPreviewUrl);

        if (currentUrl && urlHost === alistHost) {
          const downloaded = await fetchRemoteAsBuffer(currentUrl);
          nextData.url = await uploadBufferToCos({
            buffer: downloaded.buffer,
            contentType: downloaded.contentType,
            fileName: safeMigrationName(
              row.id,
              currentUrl,
              downloaded.contentType,
            ),
            type: "",
          });
        }

        if (
          includePreview &&
          currentPreviewUrl &&
          previewHost === alistHost &&
          currentPreviewUrl !== currentUrl
        ) {
          const downloaded = await fetchRemoteAsBuffer(currentPreviewUrl);
          nextData.preview_url = await uploadBufferToCos({
            buffer: downloaded.buffer,
            contentType: downloaded.contentType,
            fileName: safeMigrationName(
              `${row.id}-preview`,
              currentPreviewUrl,
              downloaded.contentType,
            ),
            type: "",
          });
        } else if (
          nextData.url &&
          (!currentPreviewUrl ||
            previewHost === alistHost ||
            currentPreviewUrl === currentUrl)
        ) {
          nextData.preview_url = nextData.url;
        }

        if (!nextData.url && !nextData.preview_url) {
          if (urlHost === cosHost || previewHost === cosHost) skipped++;
          else skipped++;
          continue;
        }

        await db.images.update({ where: { id: row.id }, data: nextData });
        migrated++;
      } catch (e: any) {
        failed++;
        errors.push({ id: row.id, message: e?.message || "迁移失败" });
      }
    }

    return c.json({
      code: 200,
      message: "Success",
      data: {
        scanned: rows.length,
        migrated,
        skipped,
        failed,
        errors: errors.slice(0, 10),
      },
    });
  } catch (e: any) {
    console.error(e);
    return c.json({
      code: 500,
      message: readableStorageError(e, "cos"),
      error: e?.Code || e?.code || "COS_MIGRATION_FAILED",
    }, 500);
  }
});

// 列出存储桶内容
function joinStoragePath(base: string = "", child: string = "") {
  const cleanedBase = base.trim().replace(/^\/+|\/+$/g, "");
  const cleanedChild = child.trim().replace(/^\/+|\/+$/g, "");
  return [cleanedBase, cleanedChild].filter(Boolean).join("/");
}

function stripBasePrefix(value = "", base = "") {
  const normalizedBase = base.replace(/^\/+/, "");
  if (!normalizedBase) return value.replace(/\/+$/g, "");
  return value.startsWith(normalizedBase)
    ? value.slice(normalizedBase.length).replace(/^\/+|\/+$/g, "")
    : value.replace(/\/+$/g, "");
}

export async function listBucketContents(
  storage: string,
  directoryPath: string = "",
  prefix: string = "",
) {
  try {
    const objectPath = joinStoragePath(directoryPath, prefix);

    switch (storage) {
      case "s3":
        return await listS3BucketContents(objectPath);
      case "r2":
        return await listR2BucketContents(objectPath);
      case "cos":
        return await listCosBucketContents(objectPath);
      case "alist":
        return await listAlistContents(prefix, directoryPath);
      default:
        throw new Error("不支持的存储类型");
    }
  } catch (error) {
    console.error("获取存储桶内容失败", error);
    throw error;
  }
}

// 列出S3存储桶内容
async function listS3BucketContents(directoryPath: string = "") {
  const findConfig = await fetchConfigsByKeys([
    "accesskey_id",
    "accesskey_secret",
    "region",
    "endpoint",
    "bucket",
    "storage_folder",
    "force_path_style",
    "s3_cdn",
    "s3_cdn_url",
  ]);

  const bucket =
    findConfig.find((item) => item.config_key === "bucket")?.config_value || "";
  const storageFolder =
    findConfig.find((item) => item.config_key === "storage_folder")
      ?.config_value || "";
  const endpoint =
    findConfig.find((item) => item.config_key === "endpoint")?.config_value ||
    "";
  const s3Cdn = findConfig.find(
    (item) => item.config_key === "s3_cdn",
  )?.config_value;
  const s3CdnUrl =
    findConfig.find((item) => item.config_key === "s3_cdn_url")?.config_value ||
    "";

  if (!bucket) {
    throw new Error("存储桶名称未配置");
  }

  const s3Client = getClient(findConfig);
  const folderPrefix = storageFolder
    ? storageFolder.endsWith("/")
      ? storageFolder
      : `${storageFolder}/`
    : "";
  const fullPrefix = directoryPath
    ? `${folderPrefix}${directoryPath}${directoryPath.endsWith("/") ? "" : "/"}`
    : folderPrefix;

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: fullPrefix,
    Delimiter: "/",
  });

  const response = await s3Client.send(command);

  // 提取目录
  const directories = (response.CommonPrefixes || [])
    .map((prefix) => stripBasePrefix(prefix.Prefix || "", folderPrefix))
    .filter(
      (prefix) =>
        prefix && prefix !== stripBasePrefix(fullPrefix, folderPrefix),
    ) as string[];

  // 提取文件
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".svg",
  ];
  const files = (response.Contents || [])
    .filter((item) => {
      const key = item.Key || "";
      const name = key.split("/").pop() || "";
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
      return imageExtensions.includes(ext) && key !== fullPrefix;
    })
    .map((item) => {
      const key = item.Key || "";
      // 生成访问URL
      let url = "";
      if (s3Cdn === "true") {
        url = `${s3CdnUrl}/${key}`;
      } else {
        url = `https://${bucket}.${endpoint}/${key}`;
      }

      return {
        name: key.split("/").pop(),
        url,
        key,
        size: item.Size,
        lastModified: item.LastModified,
      };
    });

  return {
    directories,
    files,
  };
}

// 列出R2存储桶内容
async function listR2BucketContents(directoryPath: string = "") {
  const findConfig = await fetchConfigsByKeys([
    "r2_accesskey_id",
    "r2_accesskey_secret",
    "r2_endpoint",
    "r2_bucket",
    "r2_storage_folder",
    "r2_public_domain",
  ]);

  const r2Bucket =
    findConfig.find((item) => item.config_key === "r2_bucket")?.config_value ||
    "";
  const r2StorageFolder =
    findConfig.find((item) => item.config_key === "r2_storage_folder")
      ?.config_value || "";
  const r2Endpoint =
    findConfig.find((item) => item.config_key === "r2_endpoint")
      ?.config_value || "";
  const r2PublicDomain =
    findConfig.find((item) => item.config_key === "r2_public_domain")
      ?.config_value || "";

  if (!r2Bucket) {
    throw new Error("存储桶名称未配置");
  }

  const r2Client = getR2Client(findConfig);
  const folderPrefix = r2StorageFolder
    ? r2StorageFolder.endsWith("/")
      ? r2StorageFolder
      : `${r2StorageFolder}/`
    : "";
  const fullPrefix = directoryPath
    ? `${folderPrefix}${directoryPath}${directoryPath.endsWith("/") ? "" : "/"}`
    : folderPrefix;

  const command = new ListObjectsV2Command({
    Bucket: r2Bucket,
    Prefix: fullPrefix,
    Delimiter: "/",
  });

  const response = await r2Client.send(command);

  // 提取目录
  const directories = (response.CommonPrefixes || [])
    .map((prefix) => stripBasePrefix(prefix.Prefix || "", folderPrefix))
    .filter(
      (prefix) =>
        prefix && prefix !== stripBasePrefix(fullPrefix, folderPrefix),
    ) as string[];

  // 提取文件
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".svg",
  ];
  const files = (response.Contents || [])
    .filter((item) => {
      const key = item.Key || "";
      const name = key.split("/").pop() || "";
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
      return imageExtensions.includes(ext) && key !== fullPrefix;
    })
    .map((item) => {
      const key = item.Key || "";
      // 生成访问URL
      const baseUrl = r2PublicDomain
        ? r2PublicDomain.includes("https://")
          ? r2PublicDomain
          : `https://${r2PublicDomain}`
        : r2Endpoint.includes("https://")
          ? r2Endpoint
          : `https://${r2Endpoint}`;

      return {
        name: key.split("/").pop(),
        url: `${baseUrl}/${key}`,
        key,
        size: item.Size,
        lastModified: item.LastModified,
      };
    });

  return {
    directories,
    files,
  };
}

// 列出COS存储桶内容（Node 环境使用 AWS S3 兼容 API，避免 cos-js-sdk-v5 的 XMLHttpRequest 报错）
async function listCosBucketContents(directoryPath: string = "") {
  const findConfig = await fetchConfigsByKeys([
    "cos_secret_id",
    "cos_secret_key",
    "cos_region",
    "cos_bucket",
    "cos_storage_folder",
    "cos_domain",
  ]);

  const cosSecretId = cleanTencentSecretId(
    findConfig.find((item) => item.config_key === "cos_secret_id")
      ?.config_value || "",
  );
  const cosSecretKey = cleanTencentSecretKey(
    findConfig.find((item) => item.config_key === "cos_secret_key")
      ?.config_value || "",
  );
  const cosBucket = cleanTencentBucket(
    findConfig.find((item) => item.config_key === "cos_bucket")?.config_value ||
      "",
  );
  const cosStorageFolder =
    findConfig.find((item) => item.config_key === "cos_storage_folder")
      ?.config_value || "";
  const cosRegion = cleanTencentRegion(
    findConfig.find((item) => item.config_key === "cos_region")?.config_value ||
      "",
  );
  const cosDomain =
    findConfig.find((item) => item.config_key === "cos_domain")?.config_value ||
    "";

  if (!cosSecretId || !cosSecretKey || !cosBucket || !cosRegion) {
    throw new Error(
      "腾讯云 COS 配置信息不完整，请检查 SecretId、SecretKey、Region、Bucket",
    );
  }

  if (!/^AKID[A-Za-z0-9]{20,}$/.test(cosSecretId)) {
    throw new Error(
      `腾讯云 COS SecretId 格式不正确：应以 AKID 开头。当前保存值开头为 ${cosSecretId.slice(0, 8) || "空"}，请不要把“ID”“SecretId:”等标签一起粘贴进去。`,
    );
  }

  const cosClient = new S3Client({
    region: cosRegion,
    endpoint: `https://cos.${cosRegion}.myqcloud.com`,
    credentials: {
      accessKeyId: cosSecretId,
      secretAccessKey: cosSecretKey,
    },
  });

  const folderPrefix = cosStorageFolder
    ? cosStorageFolder.endsWith("/")
      ? cosStorageFolder
      : `${cosStorageFolder}/`
    : "";
  const fullPrefix = directoryPath
    ? `${folderPrefix}${directoryPath}${directoryPath.endsWith("/") ? "" : "/"}`
    : folderPrefix;

  const response = await cosClient.send(
    new ListObjectsV2Command({
      Bucket: cosBucket,
      Prefix: fullPrefix,
      Delimiter: "/",
    }),
  );

  const directories = (response.CommonPrefixes || [])
    .map((prefix) => stripBasePrefix(prefix.Prefix || "", folderPrefix))
    .filter(
      (prefix) =>
        prefix && prefix !== stripBasePrefix(fullPrefix, folderPrefix),
    ) as string[];

  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".svg",
    ".avif",
    ".heic",
  ];
  const files = (response.Contents || [])
    .filter((item) => {
      const key = item.Key || "";
      const name = key.split("/").pop() || "";
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
      return imageExtensions.includes(ext) && key !== fullPrefix;
    })
    .map((item) => {
      const key = item.Key || "";
      const baseUrl = cosDomain
        ? cosDomain.includes("https://")
          ? cosDomain
          : `https://${cosDomain}`
        : `https://${cosBucket}.cos.${cosRegion}.myqcloud.com`;

      return {
        name: key.split("/").pop(),
        url: `${baseUrl.replace(/\/$/, "")}/${key}`,
        key,
        size: item.Size,
        lastModified: item.LastModified,
      };
    });

  return { directories, files };
}

// 列出Alist内容

function normalizeAlistUrl(baseUrl: string, value = "", filePath = "") {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const cleanedPath = String(filePath).replace(/^\/+/, "");
  if (value && /^https?:\/\//i.test(value)) return value;
  if (value && value.startsWith("/")) return `${normalizedBase}${value}`;
  if (value) return `${normalizedBase}/${value.replace(/^\/+/, "")}`;
  return `${normalizedBase}/d/${encodeURI(cleanedPath)}`;
}

function buildAlistFileUrl(baseUrl: string, item: any, filePath = "") {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const cleanedPath = String(filePath).replace(/^\/+/, "");
  const direct = item?.raw_url || item?.thumb_url || item?.url;
  if (direct)
    return normalizeAlistUrl(normalizedBase, String(direct), cleanedPath);
  const sign = item?.sign ? String(item.sign) : "";
  const downloadPath = `${normalizedBase}/d/${encodeURI(cleanedPath)}`;
  return sign
    ? `${downloadPath}${downloadPath.includes("?") ? "&" : "?"}sign=${encodeURIComponent(sign)}`
    : downloadPath;
}

async function listAlistContents(
  directoryPath: string = "",
  mountPath: string = "",
) {
  const findConfig = await fetchConfigsByKeys(["alist_url", "alist_token"]);

  const alistToken =
    findConfig.find((item) => item.config_key === "alist_token")
      ?.config_value || "";
  const alistUrl =
    findConfig.find((item) => item.config_key === "alist_url")?.config_value ||
    "";

  if (!alistToken || !alistUrl) {
    throw new Error("AList 配置信息不完整");
  }

  if (!mountPath) {
    throw new Error("AList 挂载路径不能为空");
  }

  const normalizedMountPath = mountPath.startsWith("/")
    ? mountPath
    : `/${mountPath}`;
  const normalizedDirectoryPath = directoryPath.replace(/^\/+|\/+$/g, "");
  const fullPath = normalizedDirectoryPath
    ? `${normalizedMountPath}${normalizedMountPath.endsWith("/") ? "" : "/"}${normalizedDirectoryPath}`
    : normalizedMountPath;

  // 获取目录内容
  const normalizedAlistUrl = alistUrl.replace(/\/$/, "");

  const response = await fetch(`${normalizedAlistUrl}/api/fs/list`, {
    method: "POST",
    headers: {
      Authorization: alistToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: fullPath }),
  }).then((res) => res.json());

  if (response.code !== 200) {
    throw new Error(response.message || "AList 获取目录内容失败");
  }

  const content = Array.isArray(response?.data?.content)
    ? response.data.content
    : [];

  // 提取目录
  const directories = content
    .filter((item: any) => item.is_dir)
    .map((item: any) => joinStoragePath(normalizedDirectoryPath, item.name));

  // 提取图片文件
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".svg",
    ".avif",
    ".heic",
  ];
  const files = content
    .filter((item: any) => {
      if (item.is_dir) return false;
      const name = item.name || "";
      const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
      return imageExtensions.includes(ext);
    })
    .map((item: any) => {
      return {
        name: item.name,
        url: buildAlistFileUrl(
          normalizedAlistUrl,
          item,
          `${fullPath}${fullPath.endsWith("/") ? "" : "/"}${item.name}`,
        ),
        key: `${fullPath}${fullPath.endsWith("/") ? "" : "/"}${item.name}`,
        size: item.size,
        lastModified: item.modified,
      };
    });

  // 如果文件的URL为空，则尝试获取实际URL
  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      if (!file.url) {
        try {
          const fileRes = await fetch(`${normalizedAlistUrl}/api/fs/get`, {
            method: "POST",
            headers: {
              Authorization: alistToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ path: file.key }),
          }).then((res) => res.json());

          if (fileRes.code === 200) {
            file.url =
              buildAlistFileUrl(
                normalizedAlistUrl,
                fileRes.data || {},
                file.key,
              ) || file.url;
          }
        } catch (e) {
          console.error("获取文件URL失败", e);
        }
      }
      if (!file.url) {
        file.url = normalizeAlistUrl(normalizedAlistUrl, "", file.key);
      }
      return file;
    }),
  );

  return {
    directories,
    files: filesWithUrls,
  };
}

export default app;
