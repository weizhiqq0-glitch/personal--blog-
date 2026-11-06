import "./App.css";

function App() {
  return (
    <main className="page">
      <section className="search-box">
        🔍 搜索标题、描述或标签...
      </section>

      <section className="profile-card">
        <div className="avatar">🐶</div>

        <div>
          <h1>我的博客</h1>
          <p>淡淡的就会顺顺的.</p>
        </div>

        <button className="theme-button">☀️</button>

        <div className="stats">
          <div>
            <strong>12</strong>
            <span>文章</span>
          </div>

          <div>
            <strong>36</strong>
            <span>评论</span>
          </div>

          <div>
            <strong>8</strong>
            <span>照片</span>
          </div>
        </div>
      </section>

      <section className="article-card">
        <p className="label">LATEST ARTICLE</p>
        <h2>欢迎来到我的个人博客</h2>
        <p>
          这里会记录我的学习过程、生活感悟和一些有趣的事情。
        </p>
        <button>阅读文章 →</button>
      </section>
    </main>
  );
}

export default App;