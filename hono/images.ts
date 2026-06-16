import "server-only";
import {
  deleteBatchImage,
  deleteImage,
  insertImage,
  batchImportImages,
  updateImage,
  updateImageShow,
  updateImageAlbum,
  updateBatchImagesMainpage,
} from "~/server/db/operate/images";
import { Hono } from "hono";
import {
  fetchClientImagesListByAlbum,
  fetchClientImagesPageTotalByAlbum,
  fetchServerImagesListByAlbum,
  fetchServerImagesPageTotalByAlbum,
} from "~/server/db/query/images";
import { HTTPException } from "hono/http-exception";

const app = new Hono();

app.get("/admin-list", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const pageSize = Number(c.req.query("pageSize") || "24");
  const album = c.req.query("album") || "all";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(Math.max(pageSize, 12), 96)
    : 48;
  const [data, total] = await Promise.all([
    fetchServerImagesListByAlbum(safePage, album, safePageSize),
    fetchServerImagesPageTotalByAlbum(album),
  ]);
  return c.json({
    code: 200,
    message: "Success",
    data,
    total,
    pageSize: safePageSize,
  });
});

app.get("/client-list", async (c) => {
  const page = Number(c.req.query("page") || "1");
  const album = c.req.query("album") || "/";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  // 首页/相册瀑布流不再每页都 COUNT；靠“空页停止”结束无限滚动，明显减少 Neon 往返。
  const data = await fetchClientImagesListByAlbum(safePage, album);
  return c.json({ code: 200, message: "Success", data, totalPages: 9999 });
});

app.post("/add", async (c) => {
  const image = await c.req.json();
  if (!image.url) {
    throw new HTTPException(500, { message: "Image link cannot be empty" });
  }
  if (!image.height || image.height <= 0) {
    throw new HTTPException(500, {
      message: "Image height cannot be empty and must be greater than 0",
    });
  }
  if (!image.width || image.width <= 0) {
    throw new HTTPException(500, {
      message: "Image width cannot be empty and must be greater than 0",
    });
  }
  try {
    await insertImage(image);
    return c.json({ code: 200, message: "Success" });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.delete("/batch-delete", async (c) => {
  try {
    const data = await c.req.json();
    await deleteBatchImage(data);
    return c.json({ code: 200, message: "Success" });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.delete("/delete/:id", async (c) => {
  try {
    const { id } = c.req.param();
    await deleteImage(id);
    return c.json({ code: 200, message: "Success" });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update", async (c) => {
  const image = await c.req.json();
  if (!image.url) {
    throw new HTTPException(500, { message: "Image link cannot be empty" });
  }
  if (!image.height || image.height <= 0) {
    throw new HTTPException(500, {
      message: "Image height cannot be empty and must be greater than 0",
    });
  }
  if (!image.width || image.width <= 0) {
    throw new HTTPException(500, {
      message: "Image width cannot be empty and must be greater than 0",
    });
  }
  try {
    await updateImage(image);
    return c.json({ code: 200, message: "Success" });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/update-show", async (c) => {
  const image = await c.req.json();
  const data = await updateImageShow(image.id, image.show);
  return c.json(data);
});

app.put("/update-Album", async (c) => {
  const image = await c.req.json();
  try {
    await updateImageAlbum(image.imageId, image.albumId);
    return c.json({
      code: 200,
      message: "Success",
    });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.put("/batch-update-mainpage", async (c) => {
  const { imageIds, showOnMainpage } = await c.req.json();
  try {
    await updateBatchImagesMainpage(imageIds, showOnMainpage);
    return c.json({
      code: 200,
      message: "Success",
    });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

app.post("/import", async (c) => {
  try {
    const { images, album } = await c.req.json();

    if (!album) {
      throw new HTTPException(400, { message: "相册不能为空" });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new HTTPException(400, { message: "图片不能为空" });
    }

    const result = await batchImportImages(images, album);
    return c.json({
      code: 200,
      message: "Success",
      data: result.created,
      stats: result,
    });
  } catch (e) {
    throw new HTTPException(500, { message: "Failed", cause: e });
  }
});

export default app;
