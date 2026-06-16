import favicon from '~/public/favicon.svg'
import Image from 'next/image'
import Link from 'next/link'
import { GithubIcon } from '~/components/icons/github'

const links = [
  {
    title: 'CN-Yuncan / Album',
    desc: '当前相册项目仓库，准备提交 GitHub / Vercel 使用。',
    href: 'https://github.com/CN-Yuncan/Album',
    tag: 'Repository',
  },
  {
    title: 'CN-Yuncan',
    desc: '云灿的 GitHub 主页。',
    href: 'https://github.com/CN-Yuncan',
    tag: 'GitHub',
  },
  {
    title: 'yuncan.xyz',
    desc: '个人主页入口。',
    href: 'https://yuncan.xyz',
    tag: 'Website',
  },
  {
    title: '爱发电赞助',
    desc: '如果这个项目对你有帮助，可以在这里支持。',
    href: 'https://afdian.com/a/yuncan666',
    tag: 'Sponsor',
  },
]

export default async function About() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col gap-6 p-2 md:p-4">
      <section className="admin-glass-panel overflow-hidden rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link href="https://github.com/CN-Yuncan/Album" target="_blank" rel="noreferrer" aria-label="打开项目 GitHub 仓库">
              <Image className="select-none rounded-2xl" src={favicon} alt="Yuncan Album Logo" width={72} height={72} priority />
            </Link>
            <div>
              <div className="mb-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                v4.0 · Hotfix 7
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Yuncan 之江影集</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                一个更偏个人审美的相册系统：前台负责展示，后台负责资产维护、相册管理、AList / OpenList 导入与存储配置。
              </p>
            </div>
          </div>
          <Link
            href="https://github.com/CN-Yuncan/Album"
            target="_blank"
            rel="noreferrer"
            className="interactive-surface inline-flex items-center justify-center gap-2 rounded-full border border-border/60 bg-background/55 px-4 py-2 text-sm font-medium backdrop-blur-xl transition hover:bg-background/80"
          >
            <GithubIcon size={18} className="p-0 hover:bg-transparent" />
            打开 GitHub
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="interactive-surface group rounded-[1.75rem] border border-border/60 bg-background/58 p-5 shadow-sm backdrop-blur-xl transition hover:bg-background/80"
          >
            <div className="mb-4 inline-flex rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
              {item.tag}
            </div>
            <h2 className="text-lg font-semibold tracking-tight transition group-hover:text-primary">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.desc}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
