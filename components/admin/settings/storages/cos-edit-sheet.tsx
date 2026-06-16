"use client";

import type { Config } from "~/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useButtonStore } from "~/app/providers/button-store-providers";
import React, { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "~/components/ui/button";


function sanitizeCosValue(key: string, value: string) {
  let next = String(value ?? "")
    .replace(/^﻿/, "")
    .trim();

  if (key === "cos_secret_id") {
    next = next
      .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretId|AccessKeyId|ID|密钥ID|访问密钥ID)\s*[:：=	 ]+/i, "")
      .replace(/\s+/g, "");
    const match = next.match(/AKID[A-Za-z0-9]{20,}/);
    return match ? match[0] : next;
  }

  if (key === "cos_secret_key") {
    return next
      .replace(/^([A-Za-z一-龥\s_-]{0,20})?(SecretKey|AccessKeySecret|KEY|密钥Key|访问密钥Key)\s*[:：=	 ]+/i, "")
      .replace(/\s+/g, "");
  }

  if (key === "cos_region") return next.toLowerCase();
  if (key === "cos_bucket") return next.replace(/^https?:\/\//i, "").split("/")[0].trim();
  if (key === "cos_storage_folder") {
    if (!next || next === "/") return "";
    return next.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  }
  if (key === "cos_domain") return next.replace(/\/+$/g, "");
  return next;
}

function sanitizeCosRows(rows: Config[] = []) {
  return rows.map((item) => ({
    ...item,
    config_value: sanitizeCosValue(item.config_key, item.config_value || ""),
  }));
}

const COS_FIELD_LABELS: Record<string, string> = {
  cos_secret_id: "SecretId",
  cos_secret_key: "SecretKey",
  cos_region: "地域 Region（如 ap-guangzhou / ap-hongkong）",
  cos_bucket: "存储桶 Bucket（完整名称，如 yuncan-125xxxxxxx）",
  cos_storage_folder: "存储目录（可空，填 / 表示根目录）",
  cos_domain: "访问域名/CDN 域名（可空）",
};

export default function CosEditSheet() {
  const [loading, setLoading] = useState(false);
  const { mutate } = useSWRConfig();
  const { cosEdit, setCosEdit, setCosEditData, cosData } = useButtonStore(
    (state) => state,
  );

  async function submit() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/settings/update-cos-info", {
        headers: {
          "Content-Type": "application/json",
        },
        method: "PUT",
        body: JSON.stringify(sanitizeCosRows(cosData || [])),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(result?.message || "更新失败");
      toast.success("更新成功！");
      mutate("/api/v1/settings/cos-info");
      setCosEdit(false);
      setCosEditData([] as Config[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新失败！");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      defaultOpen={false}
      open={cosEdit}
      onOpenChange={(open: boolean) => {
        if (!open) {
          setCosEdit(false);
          setCosEditData([] as Config[]);
        }
      }}
      modal={false}
    >
      <SheetContent
        side="left"
        className="w-full overflow-y-auto scrollbar-hide p-2"
        onInteractOutside={(event: any) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>编辑腾讯云 COS</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col space-y-2">
          {cosData?.map((config: Config) => (
            <label
              htmlFor="text"
              key={config.id}
              className="block overflow-hidden rounded-md border border-gray-200 px-3 py-2 shadow-sm focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600"
            >
              <span className="text-xs font-medium text-gray-700">
                {" "}
                {COS_FIELD_LABELS[config.config_key] || config.config_key}{" "}
              </span>

              <input
                type={config.config_key === "cos_secret_key" ? "password" : "text"}
                id={config.config_key}
                value={config.config_value || ""}
                placeholder={
                  config.config_key === "cos_secret_id"
                    ? "只填 AKID 开头的 SecretId，不要带 ID / SecretId:"
                    : `输入${COS_FIELD_LABELS[config.config_key] || config.config_key}`
                }
                onChange={(e) =>
                  setCosEditData(
                    cosData?.map((c: Config) => {
                      if (c.config_key === config.config_key) {
                        return { ...c, config_value: e.target.value };
                      }
                      return c;
                    }),
                  )
                }
                onBlur={(e) =>
                  setCosEditData(
                    cosData?.map((c: Config) => {
                      if (c.config_key === config.config_key) {
                        return {
                          ...c,
                          config_value: sanitizeCosValue(c.config_key, e.target.value),
                        };
                      }
                      return c;
                    }),
                  )
                }
                className="mt-1 w-full border-none p-0 focus:border-transparent focus:outline-none focus:ring-0 sm:text-sm"
              />
            </label>
          ))}
        </div>
        <Button
          className="cursor-pointer my-2"
          onClick={() => submit()}
          disabled={loading}
        >
          {loading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          提交
        </Button>
      </SheetContent>
    </Sheet>
  );
}
