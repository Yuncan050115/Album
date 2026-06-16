"use client";

import { Card } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import useSWR from "swr";
import { fetcher } from "~/lib/utils/fetcher";
import { toast } from "sonner";
import { useButtonStore } from "~/app/providers/button-store-providers";
import { Button } from "~/components/ui/button";
import { ReloadIcon, CircleIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import CosEditSheet from "~/components/admin/settings/storages/cos-edit-sheet";

const COS_CONFIG_FALLBACK = [
  { id: "cos_secret_id", config_key: "cos_secret_id", config_value: "", detail: "腾讯云 COS SecretId" },
  { id: "cos_secret_key", config_key: "cos_secret_key", config_value: "", detail: "腾讯云 COS SecretKey" },
  { id: "cos_region", config_key: "cos_region", config_value: "", detail: "地域 Region，如 ap-guangzhou" },
  { id: "cos_bucket", config_key: "cos_bucket", config_value: "", detail: "完整 Bucket 名称，如 xxx-1250000000" },
  { id: "cos_storage_folder", config_key: "cos_storage_folder", config_value: "", detail: "存储目录，可空" },
  { id: "cos_domain", config_key: "cos_domain", config_value: "", detail: "访问域名/CDN 域名，可空" },
];

async function readJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { code: res.status || 500, message: text || `HTTP ${res.status}` };
  }
}

export default function COSTabs() {
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "unconfigured" | null
  >(null);
  const [migrationLoading, setMigrationLoading] = useState(false);

  const { data, error, isValidating, mutate } = useSWR(
    "/api/v1/settings/cos-info",
    fetcher,
    { revalidateOnFocus: false },
  );
  const { setCosEdit, setCosEditData } = useButtonStore((state) => state);

  if (error) {
    toast.error("请求失败！");
  }

  const isConfigured = () => {
    if (!data || !Array.isArray(data)) return false;

    const requiredKeys = [
      "cos_secret_id",
      "cos_secret_key",
      "cos_region",
      "cos_bucket",
    ];
    return requiredKeys.every((key) =>
      data.some((item) => item.config_key === key && item.config_value),
    );
  };

  const testConnection = async () => {
    if (!isConfigured()) {
      toast.error("请先完成COS存储配置");
      setConnectionStatus("unconfigured");
      return;
    }

    setConnectionLoading(true);
    setConnectionStatus(null);

    try {
      const response = await fetch("/api/v1/storage/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storage: "cos" }),
      });
      const res = await readJsonResponse(response);

      if (response.ok && res?.code === 200) {
        toast.success("COS连接成功");
        setConnectionStatus("connected");
      } else {
        toast.error(res?.message || "COS连接失败，请检查 SecretId / SecretKey / Region / Bucket");
        setConnectionStatus("disconnected");
      }
    } catch (e) {
      console.error("测试连接失败", e);
      toast.error("COS连接失败，请检查控制台返回的具体原因");
      setConnectionStatus("disconnected");
    } finally {
      setConnectionLoading(false);
    }
  };

  const migrateAlistToCos = async () => {
    if (!isConfigured()) {
      toast.error("请先完成腾讯云 COS 配置");
      return;
    }
    if (
      !window.confirm(
        "确认把当前数据库中 AList / OpenList 来源的图片迁移到腾讯云 COS？迁移会复制文件并更新图片 URL，原 AList 文件不会被删除。",
      )
    )
      return;
    setMigrationLoading(true);
    try {
      const response = await fetch("/api/v1/storage/cos/migrate-alist-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includePreview: true }),
      });
      const res = await readJsonResponse(response);
      if (response.ok && res?.code === 200) {
        toast.success(
          `迁移完成：成功 ${res?.data?.migrated || 0} 张，跳过 ${res?.data?.skipped || 0} 张，失败 ${res?.data?.failed || 0} 张`,
        );
      } else {
        toast.error(res?.message || "迁移失败");
      }
    } catch (e) {
      console.error(e);
      toast.error("迁移失败，请先确认 COS 连接测试成功");
    } finally {
      setMigrationLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (connectionStatus === "connected") {
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-600 border-green-200"
        >
          已连接
        </Badge>
      );
    } else if (connectionStatus === "disconnected") {
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-600 border-red-200"
        >
          连接失败
        </Badge>
      );
    } else if (connectionStatus === "unconfigured") {
      return (
        <Badge
          variant="outline"
          className="bg-gray-50 text-gray-600 border-gray-200"
        >
          未配置
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <Card className="py-0">
        <div className="flex justify-between p-2">
          <div className="flex gap-2 items-center">
            <div className="flex flex-col gap-1 items-start justify-center">
              <div className="flex items-center space-x-2">
                <h4 className="text-small font-semibold leading-none text-default-600">
                  腾讯云 COS 配置
                </h4>
                {connectionStatus === "connected" && (
                  <CircleIcon className="h-4 w-4 text-green-500 fill-green-500" />
                )}
                {connectionStatus === "disconnected" && (
                  <CircleIcon className="h-4 w-4 text-red-500 fill-red-500" />
                )}
                {connectionStatus === "unconfigured" && (
                  <CircleIcon className="h-4 w-4 text-gray-400 fill-gray-400" />
                )}
                {getStatusBadge()}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={connectionLoading}
              onClick={testConnection}
              aria-label="测试连接"
            >
              {connectionLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              测试连接
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={migrationLoading || connectionLoading}
              onClick={migrateAlistToCos}
              aria-label="迁移 AList 图片到 COS"
            >
              {migrationLoading && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              AList → COS
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={isValidating}
              onClick={() => mutate()}
              aria-label="刷新"
            >
              {isValidating && (
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              )}
              刷新
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                const rows = Array.isArray(data) ? data : COS_CONFIG_FALLBACK;
                setCosEditData(rows.map((item: any) => ({ ...item })));
                setCosEdit(true);
              }}
              aria-label="编辑"
            >
              编辑
            </Button>
          </div>
        </div>
        <div className="px-2 pb-2 text-xs text-muted-foreground">
          SecretId 必须只填 AKID 开头的 CAM API 密钥 ID；不要粘贴“ID”“SecretId:”等标签。Bucket 要填完整桶名，例如 xxx-1250000000。
        </div>
      </Card>
      <CosEditSheet />
      {Array.isArray(data) && (
        <Card className="p-2">
          <Table aria-label="COS 设置">
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.config_key}
                  </TableCell>
                  <TableCell className="truncate max-w-48">
                    {item.config_value || "N&A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
