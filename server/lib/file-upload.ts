import "server-only";

import { fetchConfigsByKeys } from "~/server/db/query/configs";
import { getClient } from "~/server/lib/s3";
import { uploadSimpleObject } from "~/server/lib/s3api";
import { getR2Client } from "~/server/lib/r2";
import { HTTPException } from "hono/http-exception";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * S3 API 文件上传封装
 * @param file 文件
 * @param storage 存储类型
 * @param type 上传类型 '' | '/preview'
 * @param mountPath 挂载路径
 * @return {Promise<string>} 返回文件路径
 */
export async function s3Upload(file: any, type: string | any) {
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
    findConfig.find((item: any) => item.config_key === "bucket")
      ?.config_value || "";
  const storageFolder =
    findConfig.find((item: any) => item.config_key === "storage_folder")
      ?.config_value || "";
  const endpoint =
    findConfig.find((item: any) => item.config_key === "endpoint")
      ?.config_value || "";
  const forcePathStyle = findConfig.find(
    (item: any) => item.config_key === "force_path_style",
  )?.config_value;
  const s3Cdn = findConfig.find(
    (item: any) => item.config_key === "s3_cdn",
  )?.config_value;
  const s3CdnUrl =
    findConfig.find((item: any) => item.config_key === "s3_cdn_url")
      ?.config_value || "";
  // @ts-ignore
  const filePath =
    storageFolder && storageFolder !== "/"
      ? type && type !== "/"
        ? `${storageFolder}${type}/${file?.name}`
        : `${storageFolder}/${file?.name}`
      : type && type !== "/"
        ? `${type.slice(1)}/${file?.name}`
        : `${file?.name}`;
  // @ts-ignore
  const blob = new Blob([file]);
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const params = {
    Bucket: bucket,
    Key: filePath,
    Body: buffer,
    ContentLength: file?.size,
    ContentType: file?.type,
  };
  const s3 = getClient(findConfig);
  await uploadSimpleObject(s3, params);

  if (s3Cdn && s3Cdn === "true") {
    return `https://${
      s3CdnUrl.includes("https://") ? s3CdnUrl.split("//")[1] : s3CdnUrl
    }/${
      storageFolder && storageFolder !== "/"
        ? type && type !== "/"
          ? `${storageFolder}${type}/${encodeURIComponent(file?.name)}`
          : `${storageFolder}/${encodeURIComponent(file?.name)}`
        : type && type !== "/"
          ? `${type.slice(1)}/${encodeURIComponent(file?.name)}`
          : `${encodeURIComponent(file?.name)}`
    }`;
  } else {
    if (forcePathStyle && forcePathStyle === "true") {
      return `https://${
        endpoint.includes("https://") ? endpoint.split("//")[1] : endpoint
      }/${bucket}/${
        storageFolder && storageFolder !== "/"
          ? type && type !== "/"
            ? `${storageFolder}${type}/${encodeURIComponent(file?.name)}`
            : `${storageFolder}/${encodeURIComponent(file?.name)}`
          : type && type !== "/"
            ? `${type.slice(1)}/${encodeURIComponent(file?.name)}`
            : `${encodeURIComponent(file?.name)}`
      }`;
    }
  }
  return `https://${bucket}.${
    endpoint.includes("https://") ? endpoint.split("//")[1] : endpoint
  }/${
    storageFolder && storageFolder !== "/"
      ? type && type !== "/"
        ? `${storageFolder}${type}/${encodeURIComponent(file?.name)}`
        : `${storageFolder}/${encodeURIComponent(file?.name)}`
      : type && type !== "/"
        ? `${type.slice(1)}/${encodeURIComponent(file?.name)}`
        : `${encodeURIComponent(file?.name)}`
  }`;
}

/**
 * R2 API 文件上传封装
 * @param file 文件
 * @param storage 存储类型
 * @param type 上传类型 '' | '/preview'
 * @param mountPath 挂载路径
 * @return {Promise<string>} 返回文件路径
 */
export async function r2Upload(file: any, type: string | any) {
  const findConfig = await fetchConfigsByKeys([
    "r2_accesskey_id",
    "r2_accesskey_secret",
    "r2_endpoint",
    "r2_bucket",
    "r2_storage_folder",
    "r2_public_domain",
  ]);
  const r2Bucket =
    findConfig.find((item: any) => item.config_key === "r2_bucket")
      ?.config_value || "";
  const r2StorageFolder =
    findConfig.find((item: any) => item.config_key === "r2_storage_folder")
      ?.config_value || "";
  const r2Endpoint =
    findConfig.find((item: any) => item.config_key === "r2_endpoint")
      ?.config_value || "";
  const r2PublicDomain =
    findConfig.find((item: any) => item.config_key === "r2_public_domain")
      ?.config_value || "";

  // @ts-ignore
  const filePath =
    r2StorageFolder && r2StorageFolder !== "/"
      ? type && type !== "/"
        ? `${r2StorageFolder}${type}/${file?.name}`
        : `${r2StorageFolder}/${file?.name}`
      : type && type !== "/"
        ? `${type.slice(1)}/${file?.name}`
        : `${file?.name}`;

  // @ts-ignore
  const blob = new Blob([file]);
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const r2 = getR2Client(findConfig);
  const params = {
    Bucket: r2Bucket,
    Key: filePath,
    Body: buffer,
    ContentLength: file?.size,
    ContentType: file?.type,
  };
  await uploadSimpleObject(r2, params);
  return `${
    r2PublicDomain
      ? r2PublicDomain.includes("https://")
        ? r2PublicDomain
        : `https://${r2PublicDomain}`
      : r2Endpoint.includes("https://")
        ? r2Endpoint
        : `https://${r2Endpoint}`
  }/${
    r2StorageFolder && r2StorageFolder !== "/"
      ? type && type !== "/"
        ? `${r2StorageFolder}${type}/${encodeURIComponent(file?.name)}`
        : `${r2StorageFolder}/${encodeURIComponent(file?.name)}`
      : type && type !== "/"
        ? `${type.slice(1)}/${encodeURIComponent(file?.name)}`
        : `${encodeURIComponent(file?.name)}`
  }`;
}

/**
 * AList API 文件上传封装
 * @param file 文件
 * @param storage 存储类型
 * @param type 上传类型 '' | '/preview'
 * @param mountPath 挂载路径
 * @return {Promise<string>} 返回文件路径
 */
export async function alistUpload(
  file: any,
  type: string | any,
  mountPath: string | any,
) {
  const findConfig = await fetchConfigsByKeys(["alist_url", "alist_token"]);
  const alistToken =
    findConfig.find((item: any) => item.config_key === "alist_token")
      ?.config_value || "";
  const alistUrl = (
    findConfig.find((item: any) => item.config_key === "alist_url")
      ?.config_value || ""
  ).replace(/\/$/, "");
  if (!alistToken || !alistUrl) {
    throw new HTTPException(500, { message: "AList 配置信息不完整" });
  }
  if (!mountPath) {
    throw new HTTPException(500, { message: "AList 挂载路径不能为空" });
  }
  const filePath = encodeURIComponent(
    `${mountPath && mountPath.toString() === "/" ? "" : mountPath}${
      type && type !== "/" ? `${type}/${file?.name}` : `/${file?.name}`
    }`,
  );
  const data = await fetch(`${alistUrl}/api/fs/put`, {
    method: "PUT",
    headers: {
      Authorization: alistToken.toString(),
      "File-Path": filePath.toString(),
    },
    body: file,
  }).then((res) => res.json());
  if (data?.code !== 200) {
    throw new HTTPException(500, {
      message: data?.message || "AList 上传失败",
    });
  }

  const res = await fetch(`${alistUrl}/api/fs/get`, {
    method: "POST",
    headers: {
      Authorization: alistToken.toString(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: decodeURIComponent(filePath) }),
  }).then((res) => res.json());

  if (res?.code === 200) {
    return (
      res?.data.raw_url ||
      res?.data.thumb_url ||
      `${alistUrl}/d/${encodeURI(decodeURIComponent(filePath).replace(/^\/+/, ""))}`
    );
  }

  return `${alistUrl}/d/${encodeURI(decodeURIComponent(filePath).replace(/^\/+/, ""))}`;
}

function normalizeFolderPath(value = "") {
  return String(value || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

function normalizePublicBaseUrl(value = "") {
  const clean = String(value || "")
    .trim()
    .replace(/\/$/, "");
  if (!clean) return "";
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function encodeObjectKeyForUrl(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getCosValue(configs: any[], key: string) {
  return (
    configs.find((item: any) => item.config_key === key)?.config_value || ""
  );
}

function cleanCosConfigInput(value: unknown) {
  return String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretId|SecretKey|AccessKeyId|AccessKeySecret|ID|KEY|密钥ID|密钥Key|访问密钥ID|访问密钥Key)\s*[:：=	 ]+/i, "")
    .trim();
}

function cleanCosSecretId(value: unknown) {
  const cleaned = cleanCosConfigInput(value).replace(/\s+/g, "");
  const match = cleaned.match(/AKID[A-Za-z0-9]{20,}/);
  return match ? match[0] : cleaned;
}

function cleanCosSecretKey(value: unknown) {
  return cleanCosConfigInput(value).replace(/\s+/g, "");
}

function cleanCosRegion(value: unknown) {
  return cleanCosConfigInput(value).toLowerCase();
}

function cleanCosBucket(value: unknown) {
  return cleanCosConfigInput(value).replace(/^https?:\/\//i, "").split("/")[0].trim();
}

async function getCosUploadContext() {
  const findConfig = await fetchConfigsByKeys([
    "cos_secret_id",
    "cos_secret_key",
    "cos_region",
    "cos_bucket",
    "cos_storage_folder",
    "cos_domain",
  ]);
  const cosSecretId = cleanCosSecretId(getCosValue(findConfig, "cos_secret_id"));
  const cosSecretKey = cleanCosSecretKey(getCosValue(findConfig, "cos_secret_key"));
  const cosRegion = cleanCosRegion(getCosValue(findConfig, "cos_region"));
  const cosBucket = cleanCosBucket(getCosValue(findConfig, "cos_bucket"));
  const cosStorageFolder = normalizeFolderPath(
    getCosValue(findConfig, "cos_storage_folder"),
  );
  const cosDomain = getCosValue(findConfig, "cos_domain");

  if (!cosSecretId || !cosSecretKey || !cosRegion || !cosBucket) {
    throw new HTTPException(500, {
      message:
        "腾讯云 COS 配置信息不完整，请检查 SecretId、SecretKey、Region、Bucket",
    });
  }

  if (!/^AKID[A-Za-z0-9]{20,}$/.test(cosSecretId)) {
    throw new HTTPException(500, {
      message:
        `腾讯云 COS SecretId 格式不正确：应只保存 AKID 开头的 SecretId。当前保存值开头为 ${cosSecretId.slice(0, 8) || "空"}。请重新保存 COS 配置。`,
    });
  }

  const client = new S3Client({
    region: cosRegion,
    endpoint: `https://cos.${cosRegion}.myqcloud.com`,
    credentials: {
      accessKeyId: cosSecretId,
      secretAccessKey: cosSecretKey,
    },
  });

  const publicBaseUrl =
    normalizePublicBaseUrl(cosDomain) ||
    `https://${cosBucket}.cos.${cosRegion}.myqcloud.com`;
  return { client, cosBucket, cosStorageFolder, publicBaseUrl };
}

function buildCosObjectKey(
  fileName: string,
  type: string | any,
  storageFolder = "",
) {
  const cleanFolder = normalizeFolderPath(storageFolder);
  const cleanType = normalizeFolderPath(
    type && type !== "/" ? String(type) : "",
  );
  const cleanName = String(fileName || `image-${Date.now()}`).replace(
    /^\/+/,
    "",
  );
  return [cleanFolder, cleanType, cleanName].filter(Boolean).join("/");
}

export async function uploadBufferToCos(params: {
  buffer: Buffer;
  fileName: string;
  contentType?: string;
  type?: string;
}) {
  const { client, cosBucket, cosStorageFolder, publicBaseUrl } =
    await getCosUploadContext();
  const key = buildCosObjectKey(
    params.fileName,
    params.type || "",
    cosStorageFolder,
  );
  await client.send(
    new PutObjectCommand({
      Bucket: cosBucket,
      Key: key,
      Body: params.buffer,
      ContentLength: params.buffer.length,
      ContentType: params.contentType || "application/octet-stream",
    }),
  );
  return `${publicBaseUrl}/${encodeObjectKeyForUrl(key)}`;
}

/**
 * 腾讯云 COS API 文件上传封装
 * @param file 文件
 * @param storage 存储类型
 * @param type 上传类型 '' | '/preview'
 * @param mountPath 挂载路径
 * @return {Promise<string>} 返回文件路径
 */
export async function cosUpload(file: any, type: string | any) {
  const blob = new Blob([file]);
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return await uploadBufferToCos({
    buffer,
    fileName: file?.name || `image-${Date.now()}`,
    contentType: file?.type || "application/octet-stream",
    type: type && type !== "/" ? String(type) : "",
  });
}
