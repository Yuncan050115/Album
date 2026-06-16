import "server-only";
import { clearConfigCache } from "~/server/db/query/configs";
import { fetchUserById } from "~/server/db/query";
import { fetchConfigsByKeys, fetchSecretKey } from "~/server/db/query/configs";
import type { Config } from "~/types";
import { auth } from "~/server/auth";
import CryptoJS from "crypto-js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  updateAListConfig,
  updateCosConfig,
  updateCustomInfo,
  updateR2Config,
  updateS3Config,
} from "~/server/db/operate/configs";
import { updatePassword, updateUserInfo } from "~/server/db/operate";

const app = new Hono();

app.get("/get-custom-info", async (c) => {
  const data = await fetchConfigsByKeys([
    "custom_title",
    "custom_favicon_url",
    "custom_author",
    "rss_feed_id",
    "rss_user_id",
    "custom_index_style",
    "custom_index_download_enable",
    "preview_max_width_limit",
    "preview_max_width_limit_switch",
    "preview_quality",
  ]);
  return c.json(data);
});

app.get("/r2-info", async (c) => {
  const keys = [
    ["r2_accesskey_id", "Cloudflare R2 Access Key ID"],
    ["r2_accesskey_secret", "Cloudflare R2 Secret Access Key"],
    ["r2_endpoint", "R2 S3 API Endpoint"],
    ["r2_bucket", "R2 Bucket 名称"],
    ["r2_storage_folder", "存储目录，可空"],
    ["r2_public_domain", "公开访问域名/CDN 域名，可空"],
  ] as const;
  const results = await fetchConfigsByKeys(keys.map(([key]) => key));
  const byKey = new Map(results.map((item: any) => [item.config_key, item]));
  return c.json(
    keys.map(([key, detail]) =>
      byKey.get(key) || { id: key, config_key: key, config_value: "", detail },
    ),
  );
});

app.get("/get-user-info", async (c) => {
  const { user } = await auth();
  const data = await fetchUserById(user?.id);

  return c.json({
    id: data?.id,
    name: data?.name,
    email: data?.email,
    image: data?.image,
  });
});
app.get("/s3-info", async (c) => {
  const data = await fetchConfigsByKeys([
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
  return c.json(data);
});

app.get("/cos-info", async (c) => {
  try {
    const keys = [
      ["cos_secret_id", "腾讯云 COS SecretId"],
      ["cos_secret_key", "腾讯云 COS SecretKey"],
      ["cos_region", "腾讯云 COS 地域，如：ap-guangzhou / ap-hongkong"],
      ["cos_bucket", "腾讯云 COS 存储桶完整名称，如：yuncan-125xxxxxxx"],
      ["cos_storage_folder", "腾讯云 COS 存储目录，填 / 或留空表示根目录"],
      ["cos_domain", "腾讯云 COS 自定义域名 / CDN 域名，可留空"],
    ] as const;
    const results = await fetchConfigsByKeys(keys.map(([key]) => key));
    const byKey = new Map(results.map((item: any) => [item.config_key, item]));
    return c.json(
      keys.map(
        ([key, detail]) =>
          byKey.get(key) || {
            id: key,
            config_key: key,
            config_value: "",
            detail,
          },
      ),
    );
  } catch (e) {
    console.error(e);
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update-alist-info", async (c) => {
  const query = await c.req.json();

  const alistUrl = query?.find(
    (item: Config) => item.config_key === "alist_url",
  ).config_value;
  const alistToken = query?.find(
    (item: Config) => item.config_key === "alist_token",
  ).config_value;

  const data = await updateAListConfig({ alistUrl, alistToken });
  return c.json(data);
});

app.put("/update-r2-info", async (c) => {
  const query = await c.req.json();
  const pick = (key: string) =>
    query?.find((item: Config) => item.config_key === key)?.config_value || "";

  const data = await updateR2Config({
    r2AccesskeyId: pick("r2_accesskey_id"),
    r2AccesskeySecret: pick("r2_accesskey_secret"),
    r2Endpoint: pick("r2_endpoint"),
    r2Bucket: pick("r2_bucket"),
    r2StorageFolder: pick("r2_storage_folder"),
    r2PublicDomain: pick("r2_public_domain"),
  });
  return c.json(data);
});

app.put("/update-s3-info", async (c) => {
  const query = await c.req.json();

  const accesskeyId = query?.find(
    (item: Config) => item.config_key === "accesskey_id",
  ).config_value;
  const accesskeySecret = query?.find(
    (item: Config) => item.config_key === "accesskey_secret",
  ).config_value;
  const region = query?.find(
    (item: Config) => item.config_key === "region",
  ).config_value;
  const endpoint = query?.find(
    (item: Config) => item.config_key === "endpoint",
  ).config_value;
  const bucket = query?.find(
    (item: Config) => item.config_key === "bucket",
  ).config_value;
  const storageFolder = query?.find(
    (item: Config) => item.config_key === "storage_folder",
  ).config_value;
  const forcePathStyle = query?.find(
    (item: Config) => item.config_key === "force_path_style",
  ).config_value;
  const s3Cdn = query?.find(
    (item: Config) => item.config_key === "s3_cdn",
  ).config_value;
  const s3CdnUrl = query?.find(
    (item: Config) => item.config_key === "s3_cdn_url",
  ).config_value;

  const data = await updateS3Config({
    accesskeyId,
    accesskeySecret,
    region,
    endpoint,
    bucket,
    storageFolder,
    forcePathStyle,
    s3Cdn,
    s3CdnUrl,
  });
  return c.json(data);
});


function cleanConfigInput(value: unknown) {
  return String(value ?? "")
    .replace(/^﻿/, "")
    .trim()
    .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretId|SecretKey|AccessKeyId|AccessKeySecret|ID|KEY|密钥ID|密钥Key|访问密钥ID|访问密钥Key)\s*[:：=	 ]+/i, "")
    .trim();
}

function cleanCosSecretId(value: unknown) {
  const cleaned = cleanConfigInput(value).replace(/\s+/g, "");
  const match = cleaned.match(/AKID[A-Za-z0-9]{20,}/);
  return match ? match[0] : cleaned;
}

function cleanCosSecretKey(value: unknown) {
  return cleanConfigInput(value).replace(/\s+/g, "");
}

function cleanCosRegion(value: unknown) {
  return cleanConfigInput(value).toLowerCase();
}

function cleanCosBucket(value: unknown) {
  return cleanConfigInput(value).replace(/^https?:\/\//i, "").split("/")[0].trim();
}

function cleanCosFolder(value: unknown) {
  const cleaned = cleanConfigInput(value).replace(/\\/g, "/");
  if (!cleaned || cleaned === "/") return "";
  return cleaned.replace(/^\/+|\/+$/g, "");
}

function cleanCosDomain(value: unknown) {
  return cleanConfigInput(value).replace(/\/+$/g, "");
}

app.put("/update-cos-info", async (c) => {
  try {
    const query = await c.req.json();

    const pick = (key: string) =>
      query?.find((item: Config) => item.config_key === key)?.config_value ||
      "";
    const cosSecretId = cleanCosSecretId(pick("cos_secret_id"));
    const cosSecretKey = cleanCosSecretKey(pick("cos_secret_key"));
    const cosRegion = cleanCosRegion(pick("cos_region"));
    const cosBucket = cleanCosBucket(pick("cos_bucket"));
    const cosStorageFolder = cleanCosFolder(pick("cos_storage_folder"));
    const cosDomain = cleanCosDomain(pick("cos_domain"));

    const data = await updateCosConfig({
      cosSecretId,
      cosSecretKey,
      cosRegion,
      cosBucket,
      cosStorageFolder,
      cosDomain,
    });
    clearConfigCache();
    return c.json({ ...data, code: 200, message: "腾讯云 COS 配置已保存" });
  } catch (e) {
    console.error(e);
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update-custom-info", async (c) => {
  const query = (await c.req.json()) satisfies {
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
    customIndexRandomShow: boolean;
  };
  try {
    await updateCustomInfo(query);
    return c.json({
      code: 200,
      message: "Success",
    });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update-password", async (c) => {
  const { user } = await auth();
  const pwd = await c.req.json();
  const daUser = await fetchUserById(user?.id);
  const secretKey = await fetchSecretKey();
  if (!secretKey || !secretKey.config_value) {
    throw new HTTPException(500, { message: "Failed" });
  }
  const hashedOldPassword = CryptoJS.HmacSHA512(
    pwd.oldPassword,
    secretKey?.config_value,
  ).toString();

  try {
    if (daUser && hashedOldPassword === daUser.password) {
      const hashedNewPassword = CryptoJS.HmacSHA512(
        pwd.newPassword,
        secretKey?.config_value,
      ).toString();
      await updatePassword(user?.id, hashedNewPassword);
      return c.json({
        code: 200,
        message: "Success",
      });
    } else {
      return c.json({
        code: 500,
        message: "Old password does not match",
      });
    }
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update-user-info", async (c) => {
  const { user } = await auth();
  const { name, email, avatar } = await c.req.json();
  try {
    const updates: {
      name?: string;
      email?: string;
      image?: string;
    } = {};

    if (name) updates.name = name;
    if (email) updates.email = email;
    if (avatar) updates.image = avatar;
    if (Object.keys(updates).length > 0) {
      await updateUserInfo(user?.id, updates);
    }

    return c.json({
      code: 200,
      message: "Success",
    });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

export default app;
