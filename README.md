<h1 align="center">
<img width="28" src="./public/maskable-icon.png">
之江影集
</h1>

<p align="center">
  <a href="https://github.com/besscroft/PicImpact/blob/main/LICENSE"><img src="https://img.shields.io/github/license/besscroft/PicImpact?style=flat-square" alt="许可证"></a>
</p>

------

## 项目简介

**之江影集** 是一个为个人摄影、旅行记录和图像收藏而重构的自部署相册系统。

它不是一个单纯的图片列表，而是我自己的影像主页：前台保留沉浸式视觉、瀑布流浏览、图片预览、EXIF 信息与暗色模式；后台则用于管理相册、维护图片、配置存储源、批量导入与迁移图片。

项目基于 **Next.js 16 + HonoJS + Prisma 7 + PostgreSQL** 开发，支持 AList / OpenList、腾讯云 COS、S3 兼容存储等多种图片来源。

------

## 功能特性

### 前台展示

- 瀑布流图片展示，支持响应式布局。
- 支持暗色模式与远程动态背景。
- 点击图片进入沉浸式预览页。
- 预览页支持上一张 / 下一张切换、键盘方向键、Esc 退出。
- 相机参数默认隐藏，可手动展开查看。
- 支持 EXIF 信息展示，包括相机、镜头、焦距、光圈、快门、ISO、拍摄时间等。
- 支持标签浏览与相册筛选。
- 支持自定义光标与点击粒子动效。
- 顶部透明玻璃标题栏，适配个人主页视觉风格。

### 后台管理

- 图片资产维护。
- 图片上传。
- 相册管理。
- 图片绑定相册。
- 图片显示 / 隐藏。
- 首页展示控制。
- 存储配置管理。
- AList / OpenList 目录浏览与批量导入。
- 腾讯云 COS 配置、连接测试、上传与迁移。
- AList / OpenList 图片一键迁移至腾讯云 COS。
- 系统偏好设置。
- 账号与密码管理。
- TOTP 双因素认证。

------

## 技术栈

### 核心框架

- [Next.js 16](https://nextjs.org/)
- [React 19](https://react.dev/)
- [Hono](https://hono.dev/)
- [Prisma 7](https://www.prisma.io/)
- [PostgreSQL](https://www.postgresql.org/)

### UI 与交互

- [Tailwind CSS 4](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev/)

### 图片与存储

- 腾讯云 COS
- AList / OpenList API
- S3 Compatible API
- EXIF Reader
- Sharp

------

## 本地开发

### 安装依赖

```bash
pnpm install
```

至少要配置：

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
AUTH_SECRET="please-change-me"
NEXTAUTH_SECRET="please-change-me"
AUTH_TRUST_HOST=true
```

### 生成 Prisma Client

```bash
pnpm prisma:generate
```

### 启动开发环境

```bash
pnpm dev
```

默认访问：

```txt
http://localhost:3000
```

后台入口：

```txt
http://localhost:3000/admin
```

------

## 默认账号

首次初始化后可使用默认账号登录：

```txt
账号：admin@qq.com
密码：666666
```

登录后请立即进入后台修改账号密码，并开启双因素认证。

------

## 腾讯云 COS 配置说明

| 字段      | 说明                                         |
| --------- | -------------------------------------------- |
| SecretId  | 腾讯云 CAM 访问密钥 SecretId，以 `AKID` 开头 |
| SecretKey | 腾讯云 CAM 访问密钥 SecretKey                |
| Bucket    | 完整存储桶名称，例如 `album-1250000000`      |
| Region    | 地域，例如 `ap-guangzhou`                    |
| Folder    | 存储目录，例如 `images/`                     |
| Domain    | 自定义 CDN 域名，可选                        |

- `SecretId` 不要填写 Bucket ID、APPID 或临时链接。
- `Bucket` 必须是完整桶名，通常带有 APPID 后缀。
- 存储桶需要给当前密钥开通对应读写权限。
- 使用自定义 CDN 域名时，需要自行配置 HTTPS、缓存策略、防盗链和跨域。

------

## AList / OpenList 导入

支持探测挂载路径，浏览目录，扫描指定目录，批量导入图片，自动跳过重复 URL，自动绑定目标相册。

导入完成后，图片会写入数据库并出现在对应相册中。

------

## AList / OpenList 迁移到腾讯云 COS

进入：

```txt
后台 → 存储配置 → 腾讯云 COS → AList → COS
```

迁移逻辑：

1. 读取数据库中来自 AList / OpenList 的图片。
2. 下载原图。
3. 上传到腾讯云 COS。
4. 更新图片 URL。
5. 保留原图片记录与相册绑定关系。

适合从临时图床、AList、OpenList 逐步迁移到正式对象存储。



------

## Node.js 部署

```bash
pnpm install
pnpm prisma:generate
pnpm build
pnpm start
```

建议使用：

- Node.js 24 LTS 或更新稳定版本
- PostgreSQL / Neon / Supabase
- Nginx / Caddy 反向代理
- HTTPS 证书
- 对象存储 + CDN

本项目同时支持部署到vercel。

------

## 环境变量参考

| Key                                  | 说明                                       |
| ------------------------------------ | ------------------------------------------ |
| DATABASE_URL                         | PostgreSQL 数据库连接地址                  |
| AUTH_SECRET                          | 登录认证密钥                               |
| NEXTAUTH_SECRET                      | NextAuth 认证密钥，建议与 AUTH_SECRET 一致 |
| AUTH_TRUST_HOST                      | 部署在 Vercel / 反代环境时建议设为 true    |
| NEXT_PUBLIC_ENABLE_REMOTE_BACKGROUND | 是否启用远程动态背景                       |
| NODEJS_HELPERS                       | 部分部署环境兼容参数                       |

------

## 隐私与安全

本项目涉及对象存储、数据库、后台账号和图片直链，部署时请注意：

- 不要提交 `.env.local`。
- 不要把 SecretKey 写进 README 或公开仓库。
- 对象存储建议开启最小权限策略。
- 公开读写权限需要谨慎配置。
- 使用 CDN 时建议配置防盗链、缓存策略和 HTTPS。
- 后台账号上线后请立即修改默认密码。
- 建议开启 TOTP 双因素认证。

------

## 浏览器支持

建议使用较新的浏览器：

- Chrome
- Edge
- Firefox
- Safari

移动端和桌面端均已适配，但更推荐现代浏览器访问。

------

## TODO

-  地图足迹展示。
-  时间线模式。
-  图片故事 / 游记模式。
-  更完整的批量编辑。
-  COS 图片自动压缩与多尺寸生成。
-  更细的相册权限控制。
-  更完整的移动端后台体验。



欢迎提交 Issue，也欢迎直接 Fork 后提交 Pull Request。

------

## License

本项目基于 MIT License 开源。详见 [MIT](https://github.com/besscroft/PicImpact/blob/main/LICENSE).


