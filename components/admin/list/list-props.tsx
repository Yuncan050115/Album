"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Images,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Replace,
  Search,
  SquarePen,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";

import type { AlbumType, ImageType } from "~/types";
import { fetcher } from "~/lib/utils/fetcher";
import { useButtonStore } from "~/app/providers/button-store-providers";
import ImageEditSheet from "~/components/admin/list/image-edit-sheet";
import ImageView from "~/components/admin/list/image-view";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

const PAGE_SIZE = 48;

type ViewMode = "compact" | "dense";

function compactText(value?: string | null, fallback = "未命名图片") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function exifSummary(image: ImageType) {
  const exif: any = image.exif || {};
  const camera = [exif.make, exif.model].filter(Boolean).join(" ");
  const lens = exif.lens_model || exif.lens || "";
  const params = [
    exif.f_number ? `f/${exif.f_number}` : "",
    exif.exposure_time || "",
    exif.iso_speed_rating ? `ISO ${exif.iso_speed_rating}` : "",
    exif.focal_length ? `${exif.focal_length}mm` : "",
  ].filter(Boolean);
  return [camera, lens, params.join(" · ")].filter(Boolean).join(" / ");
}

function imageDate(image: ImageType) {
  const exif: any = image.exif || {};
  return exif.data_time || exif.DateTimeOriginal || "";
}

export default function ListProps() {
  const [pageNum, setPageNum] = useState(1);
  const [album, setAlbum] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [busyId, setBusyId] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [bindImage, setBindImage] = useState<ImageType | null>(null);
  const [targetAlbumId, setTargetAlbumId] = useState("");

  const listKey = `/api/v1/images/admin-list?page=${pageNum}&album=${encodeURIComponent(album || "all")}&pageSize=${PAGE_SIZE}`;
  const {
    data: listResponse,
    isLoading,
    isValidating,
    mutate,
  } = useSWR(listKey, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    dedupingInterval: 1800,
  });
  const { data: albums = [], isLoading: albumsLoading } = useSWR(
    "/api/v1/albums/get",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    },
  );
  const { setImageEdit, setImageEditData, setImageView, setImageViewData } =
    useButtonStore((state) => state);

  const data = Array.isArray(listResponse?.data) ? listResponse.data : [];
  const total = Number(listResponse?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedSet = useMemo(() => new Set(selectedImages), [selectedImages]);
  const filteredData = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return data;
    return data.filter((image: ImageType) =>
      [
        image.title,
        image.detail,
        image.album_name,
        image.url,
        exifSummary(image),
        imageDate(image),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [data, keyword]);

  function resetPage(nextAlbum = album) {
    setAlbum(nextAlbum);
    setPageNum(1);
    setSelectedImages([]);
  }

  function toggleImageSelection(id: string) {
    setSelectedImages((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function selectCurrentPage() {
    setSelectedImages((prev) =>
      Array.from(
        new Set([...prev, ...filteredData.map((image: ImageType) => image.id)]),
      ),
    );
  }

  function invertSelection() {
    setSelectedImages((prev) =>
      filteredData
        .map((image: ImageType) => image.id)
        .filter((id: string) => !prev.includes(id)),
    );
  }

  async function updateImageShow(id: string, show: number) {
    try {
      setBusyId(id);
      const res = await fetch("/api/v1/images/update-show", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, show }),
      });
      if (!res.ok) throw new Error("更新失败");
      await mutate();
      toast.success(show === 0 ? "已显示图片" : "已隐藏图片");
    } catch {
      toast.error("显示状态更新失败");
    } finally {
      setBusyId("");
    }
  }

  async function updateMainpage(imageIds: string[], showOnMainpage: number) {
    if (imageIds.length === 0) return toast.warning("请先选择图片");
    try {
      setBatchLoading(true);
      const res = await fetch("/api/v1/images/batch-update-mainpage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds, showOnMainpage }),
      });
      if (!res.ok) throw new Error("更新失败");
      await mutate();
      toast.success(showOnMainpage === 0 ? "已设为首页显示" : "已取消首页显示");
    } catch {
      toast.error("首页状态更新失败");
    } finally {
      setBatchLoading(false);
    }
  }

  async function deleteSelected() {
    if (selectedImages.length === 0) return toast.warning("请先选择图片");
    if (!window.confirm(`确认删除选中的 ${selectedImages.length} 张图片？`))
      return;
    try {
      setBatchLoading(true);
      const res = await fetch("/api/v1/images/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedImages),
      });
      if (!res.ok) throw new Error("删除失败");
      setSelectedImages([]);
      await mutate();
      toast.success("删除完成");
    } catch {
      toast.error("删除失败");
    } finally {
      setBatchLoading(false);
    }
  }

  async function updateImageAlbum() {
    if (!bindImage || !targetAlbumId) return toast.warning("请选择目标相册");
    try {
      setBatchLoading(true);
      const res = await fetch("/api/v1/images/update-Album", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: bindImage.id, albumId: targetAlbumId }),
      });
      if (!res.ok) throw new Error("绑定失败");
      setBindImage(null);
      setTargetAlbumId("");
      await mutate();
      toast.success("相册绑定已更新");
    } catch {
      toast.error("相册绑定失败");
    } finally {
      setBatchLoading(false);
    }
  }

  const tableSkeleton = Array.from({ length: 10 });

  return (
    <div className="space-y-4">
      <section className="admin-muted-card p-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/35 px-3 py-1 text-xs text-muted-foreground">
              <Images className="h-3.5 w-3.5" /> 图片资产维护台 · 小图表格 ·
              快速批量
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              照片维护
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              按“筛选 → 批量 →
              单图维护”重排：缩略图变小，状态直接改，编辑/预览/绑定相册集中在每一行。
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative min-w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索本页标题、相册、相机参数、URL"
                className="pl-9"
              />
            </div>
            <Select
              disabled={albumsLoading}
              value={album}
              onValueChange={resetPage}
            >
              <SelectTrigger className="min-w-56">
                <SelectValue placeholder="选择相册" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>相册</SelectLabel>
                  <SelectItem value="all">全部图片</SelectItem>
                  {albums.map((item: AlbumType) => (
                    <SelectItem key={item.album_value} value={item.album_value}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() =>
                setViewMode(viewMode === "compact" ? "dense" : "compact")
              }
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              {viewMode === "compact" ? "更紧凑" : "舒适"}
            </Button>
            <Button
              variant="outline"
              onClick={() => mutate()}
              disabled={isValidating}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", isValidating && "animate-spin")}
              />
              刷新
            </Button>
          </div>
        </div>
      </section>

      <section className="sticky top-3 z-30 rounded-2xl border bg-background/92 p-3 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">
              <ListFilter className="mr-1 h-3.5 w-3.5" />第 {pageNum}/
              {totalPages} 页
            </Badge>
            <span className="text-muted-foreground">
              共 {total} 张 · 本页 {filteredData.length} 张 · 已选{" "}
              {selectedImages.length} 张
            </span>
            {(isLoading || isValidating) && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={selectCurrentPage}>
              选中本页
            </Button>
            <Button variant="outline" size="sm" onClick={invertSelection}>
              反选本页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedImages([])}
            >
              清空
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={batchLoading || selectedImages.length === 0}
              onClick={() => updateMainpage(selectedImages, 0)}
            >
              <Star className="mr-1 h-4 w-4" />
              上首页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={batchLoading || selectedImages.length === 0}
              onClick={() => updateMainpage(selectedImages, 1)}
            >
              <StarOff className="mr-1 h-4 w-4" />
              下首页
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={batchLoading || selectedImages.length === 0}
              onClick={deleteSelected}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              删除
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-background/76 shadow-sm backdrop-blur-xl">
        <div className="grid grid-cols-[36px_72px_minmax(180px,1.4fr)_minmax(160px,1fr)_116px_116px_156px] items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div></div>
          <div>图</div>
          <div>标题 / 链接</div>
          <div>相册 / 参数</div>
          <div>展示</div>
          <div>首页</div>
          <div className="text-right">操作</div>
        </div>
        <div className="divide-y">
          {isLoading && data.length === 0 ? (
            tableSkeleton.map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[36px_72px_1fr] items-center gap-3 px-3 py-2"
              >
                <div className="h-4 w-4 rounded bg-muted" />
                <div className="relative h-12 w-16 overflow-hidden rounded-xl bg-muted">
                  <div className="image-skeleton" />
                </div>
                <div className="h-4 max-w-lg rounded bg-muted" />
              </div>
            ))
          ) : filteredData.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              没有符合条件的图片
            </div>
          ) : (
            filteredData.map((image: ImageType) => {
              const selected = selectedSet.has(image.id);
              const visible = image.show === 0;
              const main = image.show_on_mainpage === 0;
              const exif = exifSummary(image);
              return (
                <div
                  key={image.id}
                  className={cn(
                    "grid items-center gap-3 px-3 transition hover:bg-muted/22",
                    viewMode === "dense"
                      ? "grid-cols-[32px_56px_minmax(160px,1.4fr)_minmax(140px,1fr)_96px_96px_140px] py-1.5"
                      : "grid-cols-[36px_72px_minmax(180px,1.4fr)_minmax(160px,1fr)_116px_116px_156px] py-2",
                    selected && "bg-primary/5",
                  )}
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleImageSelection(image.id)}
                  />
                  <button
                    type="button"
                    className={cn(
                      "overflow-hidden rounded-xl border bg-muted",
                      viewMode === "dense" ? "h-10 w-14" : "h-12 w-16",
                    )}
                    onClick={() => {
                      setImageViewData(image);
                      setImageView(true);
                    }}
                  >
                    <img
                      src={image.preview_url || image.url}
                      alt={compactText(image.title)}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {compactText(image.title)}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {image.url}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="truncate font-medium">
                      {image.album_name || "未绑定相册"}
                    </div>
                    <div className="mt-0.5 truncate text-muted-foreground">
                      {exif ||
                        imageDate(image) ||
                        `${image.width || 0}×${image.height || 0}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      disabled={busyId === image.id}
                      checked={visible}
                      onCheckedChange={(checked) =>
                        updateImageShow(image.id, checked ? 0 : 1)
                      }
                    />
                    {visible ? "显示" : "隐藏"}
                  </div>
                  <Button
                    size="sm"
                    variant={main ? "default" : "outline"}
                    disabled={batchLoading}
                    onClick={() => updateMainpage([image.id], main ? 1 : 0)}
                  >
                    {main ? (
                      <Star className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <StarOff className="mr-1 h-3.5 w-3.5" />
                    )}
                    {main ? "已上" : "未上"}
                  </Button>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setImageViewData(image);
                        setImageView(true);
                      }}
                      title="预览"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setImageEditData(image);
                        setImageEdit(true);
                      }}
                      title="编辑"
                    >
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        setBindImage(image);
                        setTargetAlbumId("");
                      }}
                      title="绑定相册"
                    >
                      <Replace className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="flex items-center justify-center gap-3 py-4">
        <Button
          variant="outline"
          disabled={pageNum <= 1 || isValidating}
          onClick={() => setPageNum((value) => Math.max(1, value - 1))}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          上一页
        </Button>
        <div className="rounded-full border bg-background/70 px-4 py-2 text-sm text-muted-foreground">
          {pageNum} / {totalPages}
        </div>
        <Button
          variant="outline"
          disabled={pageNum >= totalPages || isValidating}
          onClick={() => setPageNum((value) => Math.min(totalPages, value + 1))}
        >
          下一页
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {bindImage && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setBindImage(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border bg-background p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">绑定相册</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {compactText(bindImage.title)}
            </p>
            <Select value={targetAlbumId} onValueChange={setTargetAlbumId}>
              <SelectTrigger className="mt-4">
                <SelectValue placeholder="选择目标相册" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>相册</SelectLabel>
                  {albums.map((item: AlbumType) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBindImage(null)}>
                取消
              </Button>
              <Button
                onClick={updateImageAlbum}
                disabled={batchLoading || !targetAlbumId}
              >
                确认绑定
              </Button>
            </div>
          </div>
        </div>
      )}

      <ImageEditSheet onDone={mutate} />
      <ImageView />
    </div>
  );
}
