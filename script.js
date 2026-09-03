// ===== 简单交互脚本：自动更新年份 + 滚动高亮导航 =====

// 1. 页脚年份自动更新
document.getElementById("year").textContent = new Date().getFullYear();

// 2. 滚动时高亮当前所在 section 的导航链接
const sections = document.querySelectorAll("section[id]");
const navLinks = document.querySelectorAll(".nav-links a");

// 使用 IntersectionObserver 观察每个 section 是否进入视口
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const currentId = entry.target.id;
        navLinks.forEach((link) => {
          link.style.color = "";
          if (link.getAttribute("href") === `#${currentId}`) {
            link.style.color = "#2563eb";
          }
        });
      }
    });
  },
  { rootMargin: "-40% 0px -55% 0px" }
);

sections.forEach((section) => observer.observe(section));

// 3. 控制台提示（证明 JS 正常工作）
console.log("个人主页已加载 ✅");
