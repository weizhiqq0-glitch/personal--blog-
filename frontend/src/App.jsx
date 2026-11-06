import { useMemo, useState } from "react";
import "./App.css";

const articles = [
  { id: 1, title: "欢迎来到我的个人博客", summary: "这里会记录我的学习过程、生活感悟和一些有趣的事情。", date: "2026-11-06", tags: ["随笔", "生活"], emoji: "🌱" },
  { id: 2, title: "从零开始搭建一个博客", summary: "记录第一次使用 React、Express 和数据库做项目的过程。", date: "2026-11-05", tags: ["编程", "学习"], emoji: "💻" },
  { id: 3, title: "保持好奇，慢慢成长", summary: "每天解决一个小问题，时间会把答案交到我们手里。", date: "2026-11-02", tags: ["思考"], emoji: "✨" },
];

function App() {
  const [keyword, setKeyword] = useState("");
  const [dark, setDark] = useState(false);
  const visibleArticles = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter((article) => [article.title, article.summary, ...article.tags].join(" ").toLowerCase().includes(query));
  }, [keyword]);

  return (
    <main className={dark ? "page dark" : "page"}>
      <div className="layout">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">✦</span><span>我的小站</span></div>
          <nav>
            <a href="#articles">文章</a><a href="#about">关于我</a>
            <button className="icon-button" onClick={() => setDark(!dark)}>{dark ? "☀️" : "🌙"}</button>
          </nav>
        </header>

        <section className="hero-card" id="about">
          <div className="hero-copy">
            <p className="eyebrow">HELLO, WORLD</p>
            <h1>淡淡的就会顺顺的.</h1>
            <p className="intro">这是我的个人博客，记录代码、生活、想法，以及一路上遇到的小惊喜。</p>
            <div className="hero-actions"><a className="primary-button" href="#articles">浏览文章</a><a className="text-button" href="mailto:hello@example.com">联系我 ↗</a></div>
          </div>
          <div className="hero-orb" aria-hidden="true"><span>🐶</span></div>
        </section>

        <section className="stats-row">
          <div><strong>12</strong><span>文章</span></div><div><strong>36</strong><span>评论</span></div><div><strong>8</strong><span>照片</span></div><div><strong>2026</strong><span>开始写作</span></div>
        </section>

        <section className="content-section" id="articles">
          <div className="section-heading">
            <div><p className="eyebrow">LATEST INSIGHT</p><h2>最近写了什么</h2></div>
            <label className="search"><span>⌕</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索文章或标签" /></label>
          </div>
          <div className="article-grid">
            {visibleArticles.map((article) => (
              <article className="article-card" key={article.id}>
                <div className="article-icon">{article.emoji}</div><p className="article-date">{article.date}</p><h3>{article.title}</h3>
                <p className="article-summary">{article.summary}</p>
                <div className="article-footer"><div className="tags">{article.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><button className="read-button">阅读 →</button></div>
              </article>
            ))}
          </div>
          {visibleArticles.length === 0 && <p className="empty">没有找到相关文章。</p>}
        </section>
        <footer>© 2026 我的个人博客 · 用心记录每一天</footer>
      </div>
    </main>
  );
}

export default App;

